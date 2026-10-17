import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyApiAccess, checkRateLimit, getClientIp } from "@/lib/security";

export const dynamic = "force-dynamic";

interface ServerCandidate {
  id: string;
  name: string;
  tag: string;
  quality: string;
  color: string;
  provider: string;
  url: string;
  isCustom?: boolean;
}

const DEFAULT_PLAYER_SERVERS = [
  {
    id: "server-vidcore",
    name: "VidCore 4K (Ultra Fast)",
    tag: "Ultra HD • 4K",
    quality: "4K / 1080p",
    color: "#22c55e",
    provider: "vidcore",
    movieUrl: "https://vidcore.net/movie/{tmdbId}?autoPlay=true&theme=E50914&title=true&poster=true",
    seriesUrl: "https://vidcore.net/tv/{tmdbId}/{season}/{episode}?autoPlay=true&theme=E50914&title=true&poster=true&nextButton=true&autoNext=true",
    enabled: true,
  },
  {
    id: "server-vidsrcpro",
    name: "VidSrc Pro (Dual Audio)",
    tag: "Dual Audio • Multi",
    quality: "1080p",
    color: "#3b82f6",
    provider: "vidsrcpro",
    movieUrl: "https://vidsrc.pro/embed/movie/{tmdbId}",
    seriesUrl: "https://vidsrc.pro/embed/tv/{tmdbId}/{season}/{episode}",
    enabled: true,
  },
  {
    id: "server-vidsrcto",
    name: "VidSrc To (Ultra Cloud)",
    tag: "Auto-Stream • High Speed",
    quality: "1080p",
    color: "#06b6d4",
    provider: "vidsrcto",
    movieUrl: "https://vidsrc.to/embed/movie/{tmdbId}",
    seriesUrl: "https://vidsrc.to/embed/tv/{tmdbId}/{season}/{episode}",
    enabled: true,
  },
  {
    id: "server-embedflix",
    name: "EmbedFlix (Multi-Language)",
    tag: "Full HD • Fast",
    quality: "1080p / 720p",
    color: "#a855f7",
    provider: "embedflix",
    movieUrl: "https://embedflix.in/embed/movie/{tmdbId}",
    seriesUrl: "https://embedflix.in/embed/tv/{tmdbId}/{season}/{episode}",
    enabled: true,
  },
  {
    id: "server-vidlink",
    name: "VidLink (Subtitles Pro)",
    tag: "Multi-Sub • 1080p",
    quality: "1080p",
    color: "#ec4899",
    provider: "vidlink",
    movieUrl: "https://vidlink.pro/movie/{tmdbId}",
    seriesUrl: "https://vidlink.pro/tv/{tmdbId}/{season}/{episode}",
    enabled: true,
  },
  {
    id: "server-multiembed",
    name: "MultiEmbed (VIP Fallback)",
    tag: "Auto Fallback • VIP",
    quality: "HD Auto",
    color: "#e50914",
    provider: "multiembed",
    movieUrl: "https://multiembed.mov/?video_id={tmdbId}&tmdb=1",
    seriesUrl: "https://multiembed.mov/?video_id={tmdbId}&tmdb=1&s={season}&e={episode}",
    enabled: true,
  },
  {
    id: "server-autoembed",
    name: "AutoEmbed (Bufferless)",
    tag: "High Bandwidth • Fast",
    quality: "1080p",
    color: "#f59e0b",
    provider: "autoembed",
    movieUrl: "https://player.autoembed.cc/embed/movie/{tmdbId}",
    seriesUrl: "https://player.autoembed.cc/embed/tv/{tmdbId}/{season}/{episode}",
    enabled: true,
  },
  {
    id: "server-smashystream",
    name: "SmashyStream (Cinema Stream)",
    tag: "Multi Server • Clean",
    quality: "1080p",
    color: "#10b981",
    provider: "smashystream",
    movieUrl: "https://embed.smashystream.com/playere.php?tmdb={tmdbId}",
    seriesUrl: "https://embed.smashystream.com/playere.php?tmdb={tmdbId}&season={season}&episode={episode}",
    enabled: true,
  },
  {
    id: "server-2embed",
    name: "2Embed (Global Fast)",
    tag: "Global Mirror • 1080p",
    quality: "1080p / 720p",
    color: "#6366f1",
    provider: "2embed",
    movieUrl: "https://www.2embed.cc/embed/{tmdbId}",
    seriesUrl: "https://www.2embed.cc/embedtv/{tmdbId}&s={season}&e={episode}",
    enabled: true,
  },
  {
    id: "server-moviesapi",
    name: "MoviesAPI Club",
    tag: "Direct Stream • HD",
    quality: "1080p",
    color: "#84cc16",
    provider: "moviesapi",
    movieUrl: "https://moviesapi.club/movie/{tmdbId}",
    seriesUrl: "https://moviesapi.club/tv/{tmdbId}-{season}-{episode}",
    enabled: true,
  },
  {
    id: "server-videasy",
    name: "Videasy Cloud",
    tag: "Responsive • Light",
    quality: "1080p",
    color: "#14b8a6",
    provider: "videasy",
    movieUrl: "https://player.videasy.net/movie/{tmdbId}",
    seriesUrl: "https://player.videasy.net/tv/{tmdbId}/{season}/{episode}",
    enabled: true,
  },
  {
    id: "server-rivestream",
    name: "RiveStream HD",
    tag: "Ultra Mirror • VIP",
    quality: "1080p",
    color: "#d946ef",
    provider: "rivestream",
    movieUrl: "https://rivestream.live/embed?type=movie&id={tmdbId}",
    seriesUrl: "https://rivestream.live/embed?type=tv&id={tmdbId}&season={season}&episode={episode}",
    enabled: true,
  },
];

/**
 * Fast network ping to test if a candidate server is alive and responding
 * - Considers 200, 3xx redirects, and 403 (Cloudflare browser challenges) as active
 * - Filters out 404 (Not Found), 500/502/503 (Crashed/Unavailable), DNS errors, and timeouts (>2.5s)
 */
async function checkServerAlive(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(2200),
      cache: "no-store",
    });

    if (res.status === 404 || res.status === 500 || res.status === 502 || res.status === 503) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

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
    const tmdbIdParam = searchParams.get("tmdbId") || searchParams.get("id") || "";
    const type = (searchParams.get("type") || "MOVIE").toUpperCase();
    const season = Math.max(1, parseInt(searchParams.get("season") || "1", 10));
    const episode = Math.max(1, parseInt(searchParams.get("episode") || "1", 10));
    const slug = searchParams.get("slug") || "";

    const cleanTmdbId = tmdbIdParam.trim();
    if (!cleanTmdbId) {
      return NextResponse.json(
        { success: false, error: "Missing required 'tmdbId' query parameter." },
        { status: 400 }
      );
    }

    const isSeries = type === "SERIES";

    // 1. Gather custom stream sources from local DB if available
    const customCandidates: ServerCandidate[] = [];
    try {
      let localMovie: any = null;
      if (slug) {
        localMovie = await db.movie.findFirst({
          where: { OR: [{ slug }, { tmdbId: cleanTmdbId }] },
          include: {
            streamSources: { orderBy: { sortOrder: "asc" } },
            seasons: {
              where: { seasonNumber: season },
              include: {
                episodes: {
                  where: { episodeNumber: episode },
                  include: { streamSources: { orderBy: { sortOrder: "asc" } } },
                },
              },
            },
          },
        });
      }

      if (localMovie) {
        if (isSeries) {
          const epSources = localMovie.seasons?.[0]?.episodes?.[0]?.streamSources || [];
          epSources.forEach((cs: any, idx: number) => {
            if (cs.url) {
              customCandidates.push({
                id: `custom_ep_${cs.id || idx}`,
                name: cs.serverName || `Server ${idx + 1} (VIP)`,
                tag: cs.quality || "Ultra HD",
                quality: cs.quality || "1080p",
                color: "#22c55e",
                provider: "custom_db",
                url: cs.url,
                isCustom: true,
              });
            }
          });
        } else {
          const movieSources = localMovie.streamSources || [];
          movieSources.forEach((cs: any, idx: number) => {
            if (cs.url) {
              customCandidates.push({
                id: `custom_mv_${cs.id || idx}`,
                name: cs.serverName || `Server ${idx + 1} (VIP)`,
                tag: cs.quality || "Ultra HD",
                quality: cs.quality || "1080p",
                color: "#22c55e",
                provider: "custom_db",
                url: cs.url,
                isCustom: true,
              });
            }
          });
        }
      }
    } catch (dbErr) {
      console.warn("[Watch Servers API] Local DB stream sources lookup error:", dbErr);
    }

    // 2. Fetch admin-configured server templates from SiteSetting, or use comprehensive defaults
    let configuredServers = DEFAULT_PLAYER_SERVERS;
    try {
      const setting = await db.siteSetting.findUnique({
        where: { id: "1" },
        select: { playerServers: true },
      });
      if (setting?.playerServers) {
        const parsed = JSON.parse(setting.playerServers);
        if (Array.isArray(parsed) && parsed.length > 0) {
          configuredServers = parsed;
        }
      }
    } catch {
      // Fallback to DEFAULT_PLAYER_SERVERS
    }

    // Build candidate list by interpolating {tmdbId}, {season}, {episode} placeholders
    const globalCandidates: ServerCandidate[] = configuredServers
      .filter((s: any) => s.enabled !== false)
      .map((s: any, idx: number) => {
        const template = isSeries ? (s.seriesUrl || s.movieUrl) : (s.movieUrl || s.seriesUrl);
        const resolvedUrl = (template || "")
          .replace(/\{tmdbId\}/g, cleanTmdbId)
          .replace(/\{id\}/g, cleanTmdbId)
          .replace(/\{season\}/g, String(season))
          .replace(/\{episode\}/g, String(episode));

        return {
          id: s.id || `server-${idx + 1}`,
          name: s.name || `Server ${idx + 1}`,
          tag: s.tag || "HD Stream",
          quality: s.quality || "1080p",
          color: s.color || "#e50914",
          provider: s.provider || "embed",
          url: resolvedUrl,
        };
      })
      .filter((s) => Boolean(s.url));

    const allCandidates = [...customCandidates, ...globalCandidates];

    // 3. Fast parallel health verification: filter to ONLY working servers ("jo support kare jsime available ho wahi show ho")
    const verificationResults = await Promise.allSettled(
      allCandidates.map(async (candidate) => {
        const isAlive = await checkServerAlive(candidate.url);
        return { candidate, isAlive };
      })
    );

    const workingServers: ServerCandidate[] = [];
    verificationResults.forEach((res) => {
      if (res.status === "fulfilled" && res.value.isAlive) {
        workingServers.push(res.value.candidate);
      }
    });

    // In the rare scenario that strict pings timed out simultaneously,
    // ensure at least reliable fallback servers are provided so playback is never blocked
    const finalServers = workingServers.length > 0 ? workingServers : globalCandidates.slice(0, 4);

    // 4. Fetch same-category fallback recommendations if needed
    let categoryRecommendations: any[] = [];
    try {
      categoryRecommendations = await db.movie.findMany({
        where: {
          status: "PUBLISHED",
          ...(slug ? { slug: { not: slug } } : {}),
          ...(isSeries ? { type: "SERIES" } : { type: "MOVIE" }),
        },
        orderBy: [{ imdbRating: "desc" }, { viewCount: "desc" }],
        take: 8,
        include: {
          genres: { include: { genre: true } },
        },
      });
    } catch {
      // Non-fatal fallback
    }

    return NextResponse.json({
      success: true,
      tmdbId: cleanTmdbId,
      type,
      season: isSeries ? season : undefined,
      episode: isSeries ? episode : undefined,
      totalChecked: allCandidates.length,
      workingCount: finalServers.length,
      hasWorkingServers: finalServers.length > 0,
      servers: finalServers.map((s, idx) => ({
        ...s,
        name: s.isCustom ? s.name : (s.name.startsWith("Server") ? s.name : `Server ${idx + 1} (${s.name})`),
      })),
      categoryRecommendations,
    });
  } catch (err: any) {
    console.error("[Watch Servers API Error]:", err);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
