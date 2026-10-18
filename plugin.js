// AnimeAV1 Improved Plugin for Kino TV
// Multi-season support: episodes grouped by season with season detection
// Compatible with Kino plugin API signatures

const BASE = "https://animeav1.com";
const CDN = "https://cdn.animeav1.com";

export async function search(query) {
  try {
    const result = await kino.fetch(
      `https://raw.githubusercontent.com/LifReizei/K-Av1improv/main/plugin.js?search=${encodeURIComponent(query)}`
    );
    const data = JSON.parse(result);
    const animeList = Array.isArray(data) ? data : (data.results || data.anime || []);

    return animeList.map(anime => ({
      id: anime.slug || anime.id || Math.random().toString(36).substr(2, 9),
      ref: anime.slug || anime.id,
      title: anime.title || anime.name || "Título desconocido",
      poster: anime.poster || anime.image || anime.cover || "",
      year: anime.year || anime.releaseDate || "",
      description: anime.description || anime.synopsis || "",
      episodes: anime.episodes?.length || 0,
      type: "series",
      genre: anime.genres || anime.category || [],
      rating: anime.rating || anime.score || ""
    }));
  } catch (e) {
    kino.error(`Error en búsqueda: ${e.message}`);
    return [];
  }
}

export async function home() {
  try {
    const result = await kino.fetch(
      "https://raw.githubusercontent.com/LifReizei/K-Av1improv/main/plugin.js"
    );
    const data = JSON.parse(result);
    const animeList = Array.isArray(data) ? data : (data.results || data.anime || []);

    const rows = [];

    if (animeList.length > 0) {
      rows.push({
        title: "Populares",
        cards: animeList.slice(0, 10).map(anime => ({
          id: anime.slug || anime.id || Math.random().toString(36).substr(2, 9),
          ref: anime.slug || anime.id,
          title: anime.title || anime.name || "Título desconocido",
          poster: anime.poster || anime.image || anime.cover || "",
          year: anime.year || anime.releaseDate || "",
          description: anime.description || anime.synopsis || "",
          episodes: anime.episodes?.length || 0,
          type: "series"
        }))
      });
    }

    rows.push({
      title: "Recién agregados",
      cards: animeList.slice(0, 8).map(anime => ({
        id: anime.slug || anime.id || Math.random().toString(36).substr(2, 9),
        ref: anime.slug || anime.id,
        title: anime.title || anime.name || "Título desconocido",
        poster: anime.poster || anime.image || anime.cover || "",
        year: anime.year || anime.releaseDate || "",
        description: anime.description || anime.synopsis || "",
        episodes: anime.episodes?.length || 0,
        type: "series"
      }))
    });

    return {
      rows,
      message: "Inicio de AnimeAV1"
    };
  } catch (e) {
    kino.error(`Error en home: ${e.message}`);
    return { rows: [] };
  }
}

export async function section(arg) {
  try {
    const result = await kino.fetch(
      "https://raw.githubusercontent.com/LifReizei/K-Av1improv/main/plugin.js"
    );
    const data = JSON.parse(result);
    const animeList = Array.isArray(data) ? data : (data.results || data.anime || []);

    const sectionId = arg && arg.id ? arg.id : "popular";
    const sectionTitle = arg && arg.title ? arg.title : "Explorar";

    return {
      title: sectionTitle,
      cards: animeList.slice(0, 20).map(anime => ({
        id: anime.slug || anime.id || Math.random().toString(36).substr(2, 9),
        ref: anime.slug || anime.id,
        title: anime.title || anime.name || "Título desconocido",
        poster: anime.poster || anime.image || anime.cover || "",
        year: anime.year || anime.releaseDate || "",
        description: anime.description || anime.synopsis || "",
        episodes: anime.episodes?.length || 0,
        type: "series"
      }))
    };
  } catch (e) {
    kino.error(`Error en section: ${e.message}`);
    return { title: "Error", cards: [] };
  }
}

export async function browse(ref, cursor) {
  try {
    const result = await kino.fetch(
      "https://raw.githubusercontent.com/LifReizei/K-Av1improv/main/plugin.js"
    );
    const data = JSON.parse(result);
    let animeList = Array.isArray(data) ? data : (data.results || data.anime || []);

    const genre = ref && ref !== "null" ? ref : null;
    if (genre && genre !== "Todos") {
      animeList = animeList.filter(anime => {
        const genres = anime.genres || anime.category || [];
        return genres.some(g => 
          g.toLowerCase().includes(genre.toLowerCase()) || 
          genre.toLowerCase().includes(g.toLowerCase())
        );
      });
    }

    const pageSize = 20;
    const page = cursor ? parseInt(cursor) : 1;
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedList = animeList.slice(startIndex, endIndex);

    const cards = paginatedList.map(anime => ({
      id: anime.slug || anime.id || Math.random().toString(36).substr(2, 9),
      ref: anime.slug || anime.id,
      title: anime.title || anime.name || "Título desconocido",
      poster: anime.poster || anime.image || anime.cover || "",
      year: anime.year || anime.releaseDate || "",
      description: anime.description || anime.synopsis || "",
      episodes: anime.episodes?.length || 0,
      type: "series"
    }));

    return {
      cards,
      nextCursor: endIndex < animeList.length ? String(page + 1) : null,
      hasMore: endIndex < animeList.length
    };
  } catch (e) {
    kino.error(`Error en browse: ${e.message}`);
    return { cards: [], nextCursor: null, hasMore: false };
  }
}

export async function episodes(ref) {
  try {
    const result = await kino.fetch(
      "https://raw.githubusercontent.com/LifReizei/K-Av1improv/main/plugin.js"
    );
    const data = JSON.parse(result);
    const animeList = Array.isArray(data) ? data : (data.results || data.anime || []);

    const anime = animeList.find(a => 
      a.slug === ref || a.id === ref ||
      (a.alternativeTitles && a.alternativeTitles.includes(ref))
    );

    if (!anime) {
      throw new Error("Anime no encontrado");
    }

    // Series info
    const seriesInfo = {
      id: anime.id || anime.slug,
      ref: anime.slug || anime.id,
      title: anime.title || anime.name,
      poster: anime.poster || anime.image || anime.cover || "",
      year: anime.year || anime.releaseDate || "",
      description: anime.description || anime.synopsis || "",
      episodes: anime.totalEpisodes || 0,
      type: "series",
      genre: anime.genres || anime.category || [],
      rating: anime.rating || anime.score || "",
      status: anime.status || "",
      studios: anime.studios || anime.producer || "",
      duration: anime.duration || ""
    };

    // Detect seasons from episode data
    const episodes = anime.episodes || [];
    let seasons = [];
    let allEpisodes = [];

    if (anime.seasons && Array.isArray(anime.seasons)) {
      // Structured seasons data
      seasons = anime.seasons.map((s, index) => ({
        seasonNumber: s.seasonNumber || index + 1,
        label: s.label || `Temporada ${index + 1}`,
        episodes: (s.episodes || []).map((ep, epIndex) => ({
          id: `${anime.slug || anime.id}-s${index + 1}e${ep.number || epIndex + 1}`,
          ref: `${anime.slug || anime.id}/${index + 1}/${ep.number || epIndex + 1}`,
          title: ep.title || ep.name || `Episodio ${ep.number || epIndex + 1}`,
          season: index + 1,
          number: ep.number || epIndex + 1,
          description: ep.description || "",
          still: ep.image || ep.thumbnail || ep.poster || "",
          duration: ep.duration || "",
          releaseDate: ep.airDate || ep.releaseDate || "",
          type: "episode",
          rating: ep.rating || ep.score || ""
        }))
      }));
      allEpisodes = seasons.flatMap(s => s.episodes);
    } else if (episodes.length > 0) {
      // Flat episode list - group into seasons (12 episodes per season)
      const episodesPerSeason = 12;
      const numSeasons = Math.ceil(episodes.length / episodesPerSeason);
      seasons = Array.from({ length: numSeasons }, (_, sIndex) => {
        const seasonEpisodes = episodes.slice(sIndex * episodesPerSeason, (sIndex + 1) * episodesPerSeason);
        return {
          seasonNumber: sIndex + 1,
          label: `Temporada ${sIndex + 1}`,
          episodes: seasonEpisodes.map((ep, epIndex) => ({
            id: `${anime.slug || anime.id}-s${sIndex + 1}e${epIndex + 1}`,
            ref: `${anime.slug || anime.id}/${sIndex + 1}/${epIndex + 1}`,
            title: ep.title || ep.name || `Episodio ${epIndex + 1}`,
            season: sIndex + 1,
            number: epIndex + 1,
            description: ep.description || "",
            still: ep.image || ep.thumbnail || "",
            duration: ep.duration || "",
            releaseDate: ep.airDate || "",
            type: "episode",
            rating: ep.rating || ep.score || ""
          }))
        };
      });
      allEpisodes = seasons.flatMap(s => s.episodes);
    }

    seriesInfo.totalSeasons = seasons.length;

    return {
      series: seriesInfo,
      seasons,
      episodes: allEpisodes,
      totalEpisodes: allEpisodes.length,
      currentSeason: allEpisodes.length > 0 ? allEpisodes[0].season : 1,
      totalSeasons: seasons.length
    };
  } catch (e) {
    kino.error(`Error en episodes: ${e.message}`);
    throw e;
  }
}

export async function resolve(ref) {
  try {
    const [slug, seasonStr, episodeStr] = String(ref || "").split("/");
    const seasonNum = parseInt(seasonStr) || 1;
    const episodeNum = parseInt(episodeStr) || 1;

    const result = await kino.fetch(
      "https://raw.githubusercontent.com/LifReizei/K-Av1improv/main/plugin.js"
    );
    const data = JSON.parse(result);
    const animeList = Array.isArray(data) ? data : (data.results || data.anime || []);

    const anime = animeList.find(a => 
      a.slug === slug || a.id === slug ||
      (a.alternativeTitles && a.alternativeTitles.includes(slug))
    );

    if (!anime) {
      throw new Error("Anime no encontrado");
    }

    let episode = null;

    // Try structured seasons
    if (anime.seasons && Array.isArray(anime.seasons)) {
      const seasonData = anime.seasons[seasonNum - 1];
      if (seasonData && seasonData.episodes) {
        episode = seasonData.episodes.find(ep => 
          ep.number === episodeNum || ep.id === episodeNum
        );
      }
    }

    // Fallback: approximate from flat episodes
    if (!episode && anime.episodes && anime.episodes.length > 0) {
      const episodesPerSeason = 12;
      const flatIndex = (seasonNum - 1) * episodesPerSeason + (episodeNum - 1);
      episode = anime.episodes[flatIndex];
    }

    if (!episode) {
      throw new Error(`Episodio ${episodeNum} de temporada ${seasonNum} no encontrado`);
    }

    const servers = {
      voe: { base: "https://voe.sx/embed/", idField: "voeId" },
      mp4upload: { base: "https://mp4upload.com/embed/", idField: "mp4uploadId" },
      yourupload: { base: "https://yourupload.com/embed/", idField: "youruploadId" },
      streamtape: { base: "https://streamtape.com/e/", idField: "streamtapeId" }
    };

    const serverConfig = servers.voe; // Default to Voe for best TV compatibility
    const fileId = episode[serverConfig.idField] || 
                   episode.fileId || 
                   episode.vid || 
                   episode.id || 
                   `${slug}_s${seasonNum}e${episodeNum}`;

    const resolvedUrl = `${serverConfig.base}${fileId}`;

    const subtitles = [];
    if (episode.subtitles && Array.isArray(episode.subtitles)) {
      episode.subtitles.forEach(sub => {
        if (sub.url) {
          subtitles.push({
            url: sub.url,
            label: `${sub.language || 'ES'} ${sub.type || ''}`.trim()
          });
        }
      });
    }

    return {
      source: resolvedUrl,
      type: "video/mp4",
      subtitles,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Referer": "https://animeav1.com/"
      },
      duration: episode.duration || 0,
      quality: episode.quality || "720p",
      preview: episode.poster || episode.image || episode.thumbnail || ""
    };
  } catch (e) {
    kino.error(`Error en resolve: ${e.message}`);
    throw e;
  }
}