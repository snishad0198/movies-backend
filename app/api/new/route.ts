import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyApiAccess, checkRateLimit, getClientIp } from "@/lib/security";
import { fetchFromTmdb, formatTmdbItem, getGenreIdByName } from "@/lib/tmdb";

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
    const category = searchParams.get("category") || "all";
    const genre = searchParams.get("genre");
    const year = searchParams.get("year");
    const sort = searchParams.get("sort") || "latest";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));

    const genreId = genre ? getGenreIdByName(genre) : undefined;
    const today = new Date().toISOString().split("T")[0];

    const movieParams: Record<string, string> = {
      sort_by: "primary_release_date.desc",
      "primary_release_date.lte": today,
      include_adult: "false",
      page: String(page),
    };

    const tvParams: Record<string, string> = {
      sort_by: "first_air_date.desc",
      "first_air_date.lte": today,
      include_adult: "false",
      page: String(page),
    };

    if (year && year !== "all") {
      movieParams["primary_release_year"] = year;
      tvParams["first_air_date_year"] = year;
    }

    if (genreId) {
      movieParams["with_genres"] = String(genreId);
      tvParams["with_genres"] = String(genreId);
    }

    if (category === "bollywood") {
      movieParams["with_original_language"] = "hi";
      tvParams["with_original_language"] = "hi";
    } else if (category === "hollywood") {
      movieParams["with_original_language"] = "en";
      tvParams["with_original_language"] = "en";
    } else if (category === "south") {
      movieParams["with_original_language"] = "te|ta|ml|kn";
      tvParams["with_original_language"] = "te|ta|ml|kn";
    } else if (category === "anime") {
      tvParams["with_original_language"] = "ja";
      tvParams["with_genres"] = "16";
    }

    const shouldFetchMovies = category === "all" || category === "movies" || category === "bollywood" || category === "hollywood" || category === "south";
    const shouldFetchSeries = category === "all" || category === "series" || category === "anime" || category === "bollywood" || category === "hollywood";

    const [tmdbNewMovies, tmdbNewSeries] = await Promise.all([
      shouldFetchMovies
        ? fetchFromTmdb("discover/movie", movieParams).catch(() => ({ results: [] }))
        : Promise.resolve({ results: [] }),
      shouldFetchSeries
        ? fetchFromTmdb("discover/tv", tvParams).catch(() => ({ results: [] }))
        : Promise.resolve({ results: [] }),
    ]);

    const tmdbList = [
      ...(tmdbNewMovies.results || []).map((m: any) => formatTmdbItem(m, "MOVIE")),
      ...(tmdbNewSeries.results || []).map((s: any) => formatTmdbItem(s, "SERIES")),
    ].filter((item: any) => Boolean(item.poster || item.backdrop));

    // Sort according to requested sort option
    if (sort === "rating") {
      tmdbList.sort((a, b) => (b.imdbRating || 0) - (a.imdbRating || 0));
    } else if (sort === "popularity") {
      tmdbList.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
    } else {
      tmdbList.sort((a, b) => (b.releaseYear || 0) - (a.releaseYear || 0));
    }

    return NextResponse.json({
      success: true,
      data: tmdbList.slice(0, 36),
      pagination: {
        page,
        totalPages: 20,
        hasMore: tmdbList.length > 0,
      },
    });
  } catch (err: any) {
    console.error("Error fetching new releases:", err);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
