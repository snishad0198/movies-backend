import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyApiAccess, checkRateLimit, getClientIp } from "@/lib/security";
import { getTrendingByRegion } from "@/lib/tmdb";
import { detectUserCountry } from "@/lib/geo";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  if (!checkRateLimit(ip, 120)) {
    return NextResponse.json({ success: false, error: "Rate limit exceeded" }, { status: 429 });
  }

  const access = await verifyApiAccess(req);
  if (!access.authorized) {
    return NextResponse.json({ success: false, error: access.reason }, { status: 403 });
  }

  try {
    const url = new URL(req.url);
    const explicitRegion = url.searchParams.get("region");
    let regionCode = "IN";
    let regionName = "India";
    if (explicitRegion && explicitRegion.toUpperCase() !== "IN") {
      const detected = detectUserCountry(req);
      regionCode = explicitRegion.toUpperCase();
      regionName = detected?.name || (regionCode === "US" ? "United States" : regionCode);
    }
    const limit = Math.min(100, Math.max(10, parseInt(url.searchParams.get("limit") || "60", 10)));

    // Fetch up to 5 pages in parallel to deliver a deep, comprehensive trending catalog (80-100+ items)
    const [page1, page2, page3, page4, page5, dbItems] = await Promise.all([
      getTrendingByRegion(regionCode, 1),
      getTrendingByRegion(regionCode, 2),
      getTrendingByRegion(regionCode, 3),
      getTrendingByRegion(regionCode, 4),
      getTrendingByRegion(regionCode, 5),
      db.movie
        .findMany({
          where: { status: "PUBLISHED", featured: true },
          include: { genres: { include: { genre: true } } },
        })
        .catch(() => []),
    ]);

    const formattedDb = dbItems.map((m: any) => ({
      ...m,
      imdbRating: m.imdbRating ? Number(m.imdbRating) : null,
      genres: m.genres ? m.genres.map((g: any) => g.genre) : [],
    }));

    const isIndia = regionCode === "IN";
    const rawList = isIndia
      ? [...formattedDb, ...page1, ...page2, ...page3, ...page4, ...page5]
      : [...page1, ...page2, ...page3, ...page4, ...page5];

    // De-duplicate by TMDB ID / title
    const seen = new Set<string>();
    const deduplicated: any[] = [];
    for (const item of rawList) {
      if (item.adult || item.isAdult) continue;
      const key = `${item.title.toLowerCase().trim()}-${item.releaseYear || ""}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduplicated.push(item);
      }
    }

    const combined = deduplicated.slice(0, limit).map((item, index) => ({
      ...item,
      rank: index + 1,
    }));

    return NextResponse.json({
      success: true,
      region: {
        code: regionCode,
        name: regionName,
      },
      count: combined.length,
      updatedAt: new Date().toISOString(),
      data: combined,
    });
  } catch (err: any) {
    console.error("Error fetching trending by region:", err);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
