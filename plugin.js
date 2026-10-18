export async function search({ query, signal }) {
  try {
    const result = await kino.fetch(
      "https://raw.githubusercontent.com/LifReizei/K-Av1improv/main/plugin.js",
      { signal }
    );
    
    const data = JSON.parse(result);
    const animeList = Array.isArray(data) ? data : (data.anime || data.results || []);
    
    if (!animeList || animeList.length === 0) {
      return { results: [], message: "No results found" };
    }
    
    const results = animeList.slice(0, 20).map(anime => ({
      id: anime.slug || anime.id || Math.random().toString(36).substr(2, 9),
      ref: anime.slug || anime.id,
      title: anime.title || anime.name || "Unknown Title",
      poster: anime.poster || anime.image || anime.cover || "",
      year: anime.year || anime.releaseDate || "",
      description: anime.description || anime.synopsis || "",
      episodes: anime.episodes?.length || 0,
      type: "series",
      genre: anime.genres || anime.category || [],
      rating: anime.rating || anime.score || ""
    }));
    
    return {
      results,
      message: `Buscando "${query}" en AnimeAV1`,
      rankBy: "relevance"
    };
  } catch (error) {
    kino.error(`Error in search: ${error.message}`);
    return { results: [], message: "Error searching" };
  }
}

export async function home() {
  try {
    const result = await kino.fetch(
      "https://raw.githubusercontent.com/LifReizei/K-Av1improv/main/plugin.js"
    );
    const data = JSON.parse(result);
    const animeList = Array.isArray(data) ? data : (data.anime || data.results || []);
    
    const rows = [];
    
    // Trending/popular anime
    if (animeList.length > 0) {
      rows.push({
        title: "Populares",
        cards: animeList.slice(0, 10).map(anime => ({
          id: anime.slug || anime.id || Math.random().toString(36).substr(2, 9),
          ref: anime.slug || anime.id,
          title: anime.title || anime.name || "Unknown Title",
          poster: anime.poster || anime.image || anime.cover || "",
          year: anime.year || anime.releaseDate || "",
          description: anime.description || anime.synopsis || "",
          episodes: anime.episodes?.length || 0,
          type: "series"
        }))
      });
    }
    
    // Recently added
    rows.push({
      title: "Recién agregados",
      cards: animeList.slice(0, 8).map(anime => ({
        id: anime.slug || anime.id || Math.random().toString(36).substr(2, 9),
        ref: anime.slug || anime.id,
        title: anime.title || anime.name || "Unknown Title",
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
  } catch (error) {
    kino.error(`Error in home: ${error.message}`);
    return { rows: [], message: "Error loading home" };
  }
}

export async function browse({ genre, sortBy, page = 1 }) {
  try {
    const result = await kino.fetch(
      "https://raw.githubusercontent.com/LifReizei/K-Av1improv/main/plugin.js"
    );
    const data = JSON.parse(result);
    let animeList = Array.isArray(data) ? data : (data.anime || data.results || []);
    
    // Filter by genre if specified
    if (genre && genre !== "Todos") {
      animeList = animeList.filter(anime => {
        const genres = anime.genres || anime.category || [];
        return genres.some(g => 
          g.toLowerCase().includes(genre.toLowerCase()) || 
          genre.toLowerCase().includes(g.toLowerCase())
        );
      });
    }
    
    // Sort
    animeList.sort((a, b) => {
      if (sortBy === "release_date") {
        return (b.year || b.releaseDate || "") > (a.year || a.releaseDate || "") ? 1 : -1;
      } else if (sortBy === "rating") {
        return (b.rating || b.score || 0) - (a.rating || a.score || 0);
      } else if (sortBy === "popular") {
        return (b.episodes?.length || 0) - (a.episodes?.length || 0);
      }
      return 0;
    });
    
    // Pagination
    const itemsPerPage = 20;
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedList = animeList.slice(startIndex, endIndex);
    
    const cards = paginatedList.map(anime => ({
      id: anime.slug || anime.id || Math.random().toString(36).substr(2, 9),
      ref: anime.slug || anime.id,
      title: anime.title || anime.name || "Unknown Title",
      poster: anime.poster || anime.image || anime.cover || "",
      year: anime.year || anime.releaseDate || "",
      description: anime.description || anime.synopsis || "",
      episodes: anime.episodes?.length || 0,
      type: "series",
      genre: anime.genres || anime.category || [],
      rating: anime.rating || anime.score || ""
    }));
    
    return {
      title: genre && genre !== "Todos" ? `Género: ${genre}` : "Explorar anime",
      cards,
      hasMore: endIndex < animeList.length,
      page: page
    };
  } catch (error) {
    kino.error(`Error in browse: ${error.message}`);
    return { title: "Error", cards: [], hasMore: false, page: 1 };
  }
}

export async function episodes({ ref }) {
  try {
    if (!ref) throw new Error("Reference is required");
    
    const result = await kino.fetch(
      "https://raw.githubusercontent.com/LifReizei/K-Av1improv/main/plugin.js"
    );
    const data = JSON.parse(result);
    const animeList = Array.isArray(data) ? data : (data.anime || data.results || []);
    
    // Find the anime by slug or id
    const anime = animeList.find(a => 
      a.slug === ref || a.id === ref || 
      (a.alternativeTitles && a.alternativeTitles.includes(ref))
    );
    
    if (!anime) {
      throw new Error("Anime not found");
    }
    
    // If the anime data already contains episodes grouped by season, use it
    if (anime.seasons && Array.isArray(anime.seasons)) {
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
        duration: anime.duration || "",
        totalSeasons: anime.seasons.length
      };
      
      const allEpisodes = anime.seasons.flatMap((season, seasonIndex) => 
        (season.episodes || []).map(ep => ({
          id: `${anime.slug || anime.id}-s${seasonIndex + 1}e${ep.number || ep.id}`,
          ref: `${anime.slug || anime.id}/${seasonIndex + 1}/${ep.number || ep.id}`,
          title: ep.title || ep.name || `Episodio ${ep.number || ep.id}`,
          season: seasonIndex + 1,
          number: ep.number || ep.id,
          description: ep.description || "",
          still: ep.image || ep.thumbnail || ep.poster || "",
          duration: ep.duration || "",
          releaseDate: ep.airDate || ep.releaseDate || "",
          type: "episode",
          rating: ep.rating || ep.score || ""
        }))
      ).sort((a, b) => {
        if (a.season !== b.season) return a.season - b.season;
        return a.number - b.number;
      });
      
      return {
        series: seriesInfo,
        episodes: allEpisodes,
        totalEpisodes: allEpisodes.length,
        currentSeason: allEpisodes.length > 0 ? allEpisodes[0].season : 1,
        totalSeasons: seriesInfo.totalSeasons
      };
    }
    
    // If episodes are flat list, group them by season (approximation)
    const episodes = anime.episodes || [];
    if (episodes.length === 0) {
      throw new Error("No episodes found for this anime");
    }
    
    // Group episodes into seasons (assuming 12 episodes per season as fallback)
    const episodesPerSeason = 12;
    const seasons = [];
    for (let i = 0; i < episodes.length; i += episodesPerSeason) {
      const seasonEpisodes = episodes.slice(i, i + episodesPerSeason);
      seasons.push({
        seasonNumber: Math.floor(i / episodesPerSeason) + 1,
        episodes: seasonEpisodes.map((ep, index) => ({
          id: `${anime.slug || anime.id}-s${Math.floor(i / episodesPerSeason) + 1}e${index + 1}`,
          ref: `${anime.slug || anime.id}/${Math.floor(i / episodesPerSeason) + 1}/${index + 1}`,
          title: ep.title || ep.name || `Episodio ${index + 1}`,
          season: Math.floor(i / episodesPerSeason) + 1,
          number: index + 1,
          description: ep.description || "",
          still: ep.image || ep.thumbnail || "",
          duration: ep.duration || "",
          releaseDate: ep.airDate || "",
          type: "episode",
          rating: ep.rating || ep.score || ""
        }))
      });
    }
    
    const allEpisodes = seasons.flatMap(season => season.episodes);
    
    const seriesInfo = {
      id: anime.id || anime.slug,
      ref: anime.slug || anime.id,
      title: anime.title || anime.name,
      poster: anime.poster || anime.image || anime.cover || "",
      year: anime.year || anime.releaseDate || "",
      description: anime.description || anime.synopsis || "",
      episodes: episodes.length,
      type: "series",
      genre: anime.genres || anime.category || [],
      rating: anime.rating || anime.score || "",
      status: anime.status || "",
      studios: anime.studios || anime.producer || "",
      duration: anime.duration || "",
      totalSeasons: seasons.length
    };
    
    return {
      series: seriesInfo,
      episodes: allEpisodes,
      totalEpisodes: allEpisodes.length,
      currentSeason: allEpisodes.length > 0 ? allEpisodes[0].season : 1,
      totalSeasons: seriesInfo.totalSeasons
    };
  } catch (error) {
    kino.error(`Error in episodes: ${error.message}`);
    throw error;
  }
}

export async function resolve({ ref, server = "voe" }) {
  try {
    if (!ref) throw new Error("Reference is required");
    
    const [slug, seasonStr, episodeStr] = String(ref || "").split("/");
    const seasonNum = parseInt(seasonStr) || 1;
    const episodeNum = parseInt(episodeStr) || 1;
    
    const result = await kino.fetch(
      "https://raw.githubusercontent.com/LifReizei/K-Av1improv/main/plugin.js"
    );
    const data = JSON.parse(result);
    const animeList = Array.isArray(data) ? data : (data.anime || data.results || []);
    
    const anime = animeList.find(a => 
      a.slug === slug || a.id === slug || 
      (a.alternativeTitles && a.alternativeTitles.includes(slug))
    );
    
    if (!anime) {
      throw new Error("Anime not found");
    }
    
    // Get the specific episode
    let episode = null;
    
    // Try to get from structured seasons data
    if (anime.seasons && Array.isArray(anime.seasons)) {
      const seasonData = anime.seasons[seasonNum - 1];
      if (seasonData && seasonData.episodes) {
        episode = seasonData.episodes.find(ep => 
          ep.number === episodeNum || ep.id === episodeNum
        );
      }
    }
    
    // Fallback: approximate from flat episodes list
    if (!episode && anime.episodes && anime.episodes.length > 0) {
      const episodesPerSeason = 12;
      const flatIndex = (seasonNum - 1) * episodesPerSeason + (episodeNum - 1);
      episode = anime.episodes[flatIndex];
    }
    
    if (!episode) {
      throw new Error(`Episode ${episodeNum} of season ${seasonNum} not found`);
    }
    
    // Server mapping
    const servers = {
      voe: { 
        base: "https://voe.sx/embed/", 
        idField: "voeId" || "fileId" || "vid",
        type: "video/mp4"
      },
      upnshare: { 
        base: "https://upnshare.com/embed/", 
        idField: "upnshareId" || "fileId" || "vid",
        type: "video/mp4"
      },
      mp4upload: { 
        base: "https://mp4upload.com/embed/", 
        idField: "mp4uploadId" || "fileId" || "vid",
        type: "video/mp4"
      },
      yourupload: { 
        base: "https://yourupload.com/embed/", 
        idField: "youruploadId" || "fileId" || "vid",
        type: "video/mp4"
      },
      streamtape: { 
        base: "https://streamtape.com/e/", 
        idField: "streamtapeId" || "fileId" || "vid",
        type: "video/mp4"
      }
    };
    
    const serverConfig = servers[server] || servers.voe;
    const fileId = episode[serverConfig.idField] || 
                   episode.fileId || 
                   episode.vid || 
                   episode.id || 
                   `${slug}_s${seasonNum}e${episodeNum}`;
    
    const resolvedUrl = `${serverConfig.base}${fileId}`;
    
    // Get subtitles if available
    const subtitles = [];
    if (episode.subtitles && Array.isArray(episode.subtitles)) {
      episode.subtitles.forEach(sub => {
        if (sub.url && sub.language) {
          subtitles.push({
            url: sub.url,
            label: `${sub.language.toUpperCase()} ${sub.type || ''}`.trim()
          });
        }
      });
    }
    
    return {
      source: resolvedUrl,
      type: serverConfig.type,
      subtitles,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Referer": "https://animeav1.com/"
      },
      duration: episode.duration || 0,
      quality: episode.quality || "720p",
      preview: episode.poster || episode.image || episode.thumbnail || ""
    };
  } catch (error) {
    kino.error(`Error in resolve: ${error.message}`);
    throw error;
  }
}

export async function download({ ref, server = "voe", format = "mp4" }) {
  try {
    if (!ref) throw new Error("Reference is required");
    
    const resolution = await resolve({ ref, server });
    const [slug, seasonStr, episodeStr] = String(ref || "").split("/");
    const episodeNum = episodeStr || "1";
    
    // Generate filename
    const cleanSlug = slug.replace(/[^\w\-]/g, '_');
    const filename = `${cleanSlug}_s${seasonStr || '01'}e${episodeNum.padStart(2, '0')}.${format}`;
    
    return {
      url: resolution.source,
      filename,
      type: resolution.type,
      size: null,
      quality: resolution.quality
    };
  } catch (error) {
    kino.error(`Error in download: ${error.message}`);
    throw error;
  }
}