import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyApiAccess, checkRateLimit, getClientIp } from "@/lib/security";
import { logActivity } from "@/lib/analytics";
import { searchTmdb } from "@/lib/tmdb";

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
    const { searchParams } = new URL(req.url);
    const query = (searchParams.get("q") || "").trim();
    const type = searchParams.get("type"); // MOVIE, SERIES, or ALL

    if (!query) {
      return NextResponse.json({ success: true, data: [] });
    }

    logActivity("SEARCH", {
      value: query,
      ip,
      userAgent: req.headers.get("user-agent") || undefined,
    }).catch(() => {});

    const lowerQuery = query.toLowerCase();
    const queryTokens = lowerQuery.split(/\s+/).filter((t) => t.length >= 2);

    // Build case-insensitive conditions for Postgres
    const orConditions: any[] = [
      { title: { contains: query, mode: "insensitive" } },
      { description: { contains: query, mode: "insensitive" } },
      { director: { contains: query, mode: "insensitive" } },
      { tags: { contains: query, mode: "insensitive" } },
    ];

    // If multi-word, search each token in description and title
    if (queryTokens.length > 1) {
      queryTokens.forEach((token) => {
        orConditions.push({ description: { contains: token, mode: "insensitive" } });
        orConditions.push({ title: { contains: token, mode: "insensitive" } });
      });
    }

    // Search both local DB (title, description, director, tags) and TMDB concurrently
    const [dbResults, tmdbResults] = await Promise.all([
      db.movie.findMany({
        where: {
          status: "PUBLISHED",
          OR: orConditions,
          ...(type && type !== "ALL" ? { type: type as any } : {}),
        },
        take: 30,
        select: {
          id: true,
          title: true,
          slug: true,
          type: true,
          poster: true,
          backdrop: true,
          description: true,
          releaseYear: true,
          runtime: true,
          language: true,
          imdbRating: true,
          viewCount: true,
        },
      }).catch(() => []),
      searchTmdb(query, type || undefined),
    ]);

    const formattedDb = dbResults.map((m: any) => {
      const titleMatch = m.title.toLowerCase().includes(lowerQuery);
      const aboutMatch = !titleMatch && (m.description || "").toLowerCase().includes(lowerQuery);
      return {
        ...m,
        imdbRating: m.imdbRating ? Number(m.imdbRating) : null,
        matchedInAbout: aboutMatch,
      };
    });

    // Deduplicate by title
    const seenTitles = new Set(formattedDb.map((m: any) => m.title.toLowerCase().trim()));
    const filteredTmdb = tmdbResults
      .filter((m: any) => !seenTitles.has(m.title.toLowerCase().trim()))
      .map((m: any) => {
        const titleMatch = m.title.toLowerCase().includes(lowerQuery);
        const aboutMatch = !titleMatch && (m.description || "").toLowerCase().includes(lowerQuery);
        return {
          ...m,
          matchedInAbout: aboutMatch,
        };
      });

    const combined = [...formattedDb, ...filteredTmdb];

    return NextResponse.json({
      success: true,
      data: combined,
    });
  } catch (err: any) {
    console.error("Live search error:", err);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
