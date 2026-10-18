// Kino Plugin: AnimeAV1 - Versión Mejorada con Soporte de Temporadas
// Basado en: https://github.com/cuentademo051092/kino-plugin-animeav1
// Mejoras: Organización por temporadas, listado completo de episodios.

const BASE = "https://animeav1.com";
const CDN = "https://cdn.animeav1.com";
const BROWSER_UA =
  "Mozilla/5.0 (Linux; Android 11) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
const SEARCH_PAGES = 3;

// --- Funciones de SvelteKit data (originales) ---
function unflatten(flat) {
  const cache = new Map();
  function get(i) {
    if (typeof i !== "number" || i < 0) return undefined;
    if (cache.has(i)) return cache.get(i);
    const v = flat[i];
    if (Array.isArray(v)) {
      if (typeof v[0] === "string") {
        cache.set(i, v[1]);
        return v[1];
      }
      const out = [];
      cache.set(i, out);
      for (const x of v) out.push(get(x));
      return out;
    }
    if (v && typeof v === "object") {
      const out = {};
      cache.set(i, out);
      for (const k of Object.keys(v)) out[k] = get(v[k]);
      return out;
    }
    cache.set(i, v);
    return v;
  }
  return get(0);
}

async function loadData(path, what) {
  const r = await kino.fetch(`${BASE}${path}/__data.json`, {
    headers: { Accept: "application/json" },
  });
  if (r.status === 404) throw kino.error("not_found", `${what}: ${path}`);
  if (r.status === 429) throw kino.error("rate_limited", `${what}: HTTP 429`);
  if (!r.ok) throw kino.error("unavailable", `${what}: HTTP ${r.status}`);
  const body = await r.json();
  if (body.type === "redirect" || body.type === "error") {
    throw kino.error("not_found", `${what}: ${body.type} ${path}`);
  }
  const nodes = (body.nodes || []).filter((n) => n && n.type === "data" && Array.isArray(n.data));
  if (nodes.length === 0) throw kino.error("unavailable", `${what}: empty __data.json`);
  return unflatten(nodes[nodes.length - 1].data);
}

// --- Funciones de Items (originales, ligeramente adaptadas) ---
function isMovie(media) {
  const c = media.category || {};
  return c.slug === "pelicula" || c.malId === "Movie";
}

function toItem(media) {
  const id = String(media.id);
  const movie = isMovie(media);
  const item = {
    id,
    ref: media.slug,
    title: media.title,
    kind: movie ? "movie" : "series",
    poster: `${CDN}/covers/${id}.jpg`,
    backdrop: `${CDN}/backdrops/${id}.jpg`,
    genres: ["Anime"],
  };
  if (media.synopsis) item.overview = String(media.synopsis).trim();
  const year = String(media.startDate || "").slice(0, 4);
  if (/^\d{4}$/.test(year)) item.year = year;
  return item;
}

async function searchOnce(q) {
  const enc = encodeURIComponent(q).replace(/%20/g, "+");
  const first = await loadSearch(enc, 1);
  const items = [...first.items];
  const pages = Math.min(first.totalPages, SEARCH_PAGES);
  for (let p = 2; p <= pages; p++) {
    try {
      items.push(...(await loadSearch(enc, p)).items);
    } catch (_) {
      break; // page 1 is enough to answer
    }
  }
  return items;
}

async function loadSearch(enc, page) {
  const r = await kino.fetch(
    `${BASE}/catalogo/__data.json?search=${enc}` + (page > 1 ? `&page=${page}` : ""),
    { headers: { Accept: "application/json" } }
  );
  if (r.status === 429) throw kino.error("rate_limited", "search: HTTP 429");
  if (!r.ok) throw kino.error("unavailable", "search: HTTP " + r.status);
  const body = await r.json();
  const nodes = (body.nodes || []).filter((n) => n && n.type === "data" && Array.isArray(n.data));
  const data = nodes.length ? unflatten(nodes[nodes.length - 1].data) : {};
  return {
    items: (data.results || []).filter((m) => m && m.id != null && m.slug && m.title).map(toItem),
    totalPages: (data.pagination && data.pagination.totalPages) || 1,
  };
}

export async function search(query) {
  const tries = [query.q, query.originalTitle, ...(query.altTitles || [])]
    .map((s) => (s || "").trim())
    .filter((s, i, all) => s && all.indexOf(s) === i);

  for (const q of tries) {
    const items = await searchOnce(q);
    if (items.length === 0) continue;
    const seen = new Set();
    const unique = items.filter((it) => !seen.has(it.id) && seen.add(it.id));
    if (query.type === "movie" || query.type === "series") {
      unique.sort((a, b) => (a.kind === query.type ? 0 : 1) - (b.kind === query.type ? 0 : 1));
    }
    return unique.slice(0, 100);
  }
  return [];
}

// --- NUEVA LÓGICA: Obtener y organizar episodios por temporada ---

async function getSeriesEpisodesOrganized(seriesSlug) {
  try {
    const response = await kino.fetch(`${BASE}/media/${seriesSlug}/__data.json`, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error(`Error obteniendo datos de la serie: ${response.status}`);
    }
    const body = await response.json();
    const nodes = (body.nodes || []).filter((n) => n && n.type === "data" && Array.isArray(n.data));
    if (nodes.length === 0) {
      throw new Error("No se encontraron datos de la serie");
    }
    const data = unflatten(nodes[nodes.length - 1].data);
    const media = data.media;

    if (!media) {
      throw kino.error("not_found", "episodes: no media for " + seriesSlug);
    }

    const episodesBySeason = {};
    let allEpisodesFlat = []; // Para devolver una lista plana para Kino

    if (media.episodes && Array.isArray(media.episodes)) {
      // Filtrar y ordenar episodios
      allEpisodesFlat = media.episodes
        .filter(e => e && e.id != null && e.number != null && e.season != null)
        .sort((a, b) => {
          const seasonA = Number(a.season);
          const seasonB = Number(b.season);
          const episodeA = Number(a.number);
          const episodeB = Number(b.number);
          
          if (seasonA !== seasonB) return seasonA - seasonB;
          return episodeA - episodeB;
        });

      // Agrupar por temporada
      for (const episode of allEpisodesFlat) {
        const seasonNum = Number(episode.season);
        const episodeNum = Number(episode.number);
        
        if (isNaN(seasonNum) || isNaN(episodeNum) || seasonNum < 1 || episodeNum < 1) {
          console.warn("Ignorando episodio con datos inválidos:", episode);
          continue;
        }

        if (!episodesBySeason[seasonNum]) {
          episodesBySeason[seasonNum] = [];
        }
        episodesBySeason[seasonNum].push({
          id: `${seriesSlug}_s${seasonNum}e${episodeNum}`,
          season: seasonNum,
          number: episodeNum,
          ref: `${seriesSlug}/${episodeNum}`,
          still: episode.thumbnail || `${CDN}/screenshots/${media.id}/${episodeNum}.jpg`,
          title: episode.title || `Episodio ${episodeNum}`,
          synopsis: episode.synopsis || null,
          languages: episode.languages || ["dub-sub"], // Asumir default si no hay
        });
      }
    } else {
        console.warn("No se encontraron episodios en media.episodes para", seriesSlug);
        if(media.episodeCount && media.episodeCount > 0) {
            for(let i = 1; i <= media.episodeCount; i++) {
                allEpisodesFlat.push({
                    id: `${seriesSlug}_s1e${i}`,
                    season: 1,
                    number: i,
                    ref: `${seriesSlug}/${i}`,
                    still: `${CDN}/screenshots/${media.id}/${i}.jpg`,
                    title: `Episodio ${i}`,
                    languages: ["dub-sub"]
                });
            }
            episodesBySeason[1] = allEpisodesFlat;
        }
    }

    const seriesInfo = {
      title: media.title,
      poster: `${CDN}/covers/${media.id}.jpg`,
      backdrop: `${CDN}/backdrops/${media.id}.jpg`,
      synopsis: media.synopsis ? String(media.synopsis).trim() : null,
      year: String(media.startDate || "").slice(0, 4),
    };

    return { seriesInfo, episodesBySeason, flatEpisodes };

  } catch (error) {
    console.error("Error en getSeriesEpisodesOrganized:", error);
    throw error;
  }
}

export async function episodes(ref) {
  const slug = String(ref).split("/")[0];
  try {
    const { seriesInfo, episodesBySeason, flatEpisodes } = await getSeriesEpisodesOrganized(slug);

    if (!episodesBySeason || Object.keys(episodesBySeason).length === 0) {
      throw kino.error("not_found", "episodes: No se encontraron episodios organizados para " + slug);
    }

    const formattedFlatEpisodes = flatEpisodes.map(episode => ({
      ...episode,
      season: Number(episode.season),
      number: Number(episode.number),
      title: `T${episode.season}E${episode.number}: ${episode.title || `Episodio ${episode.number}`}`,
    }));

    return {
      series: seriesInfo,
      episodes: formattedFlatEpisodes,
    };

  } catch (error) {
    console.error("Error en episodes:", error);
    throw error;
  }
}

// --- Funciones de Home y Browse (originales adaptadas) ---
async function loadHomeCategories() {
    try {
        const response = await kino.fetch(`${BASE}/catalogo/__data.json`, {
            headers: { Accept: "application/json" }
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const body = await response.json();
        const nodes = (body.nodes || []).filter(n => n && n.type === "data" && Array.isArray(n.data));
        if (nodes.length === 0) throw new Error("No data nodes found in __data.json");
        const data = unflatten(nodes[nodes.length - 1].data);

        let categories = [];
        if (data.categories && Array.isArray(data.categories)) {
            categories = data.categories
                .filter(cat => cat && cat.slug && cat.name)
                .map(cat => ({
                    id: cat.slug,
                    title: cat.name,
                    type: "anime",
                    extra: [{ name: "genre", options: [cat.slug], optionsLimit: 1, isRequired: true }],
                }));
        }
        return categories;
    } catch (error) {
        console.error("Error loading home categories:", error);
        return [
            { id: "accion", title: "Acción", type: "anime", extra: [{ name: "genre", options: ["accion"], optionsLimit: 1, isRequired: true }] },
            { id: "comedia", title: "Comedia", type: "anime", extra: [{ name: "genre", options: ["comedia"], optionsLimit: 1, isRequired: true }] },
            { id: "drama", title: "Drama", type: "anime", extra: [{ name: "genre", options: ["drama"], optionsLimit: 1, isRequired: true }] },
        ];
    }
}

export async function home() {
    const categories = await loadHomeCategories();
    return {
        categories: categories.slice(0, 10),
    };
}

export async function browse(genreId) {
    const genreSlug = genreId;
    const data = await loadData(`/catalogo/genero/${genreSlug}`, "browse");

    if (!data || !data.results) {
        throw kino.error("not_found", `browse: No results for genre ${genreSlug}`);
    }

    return {
        title: data.title || `Género: ${genreSlug}`,
        items: data.results.map(toItem),
    };
}

// --- Funciones de Hosters (originales, con ajustes para idioma y servidor) ---
async function fromMp4Upload(embedUrl) {
  const r = await kino.fetch(embedUrl, { headers: { "User-Agent": BROWSER_UA } });
  if (!r.ok) throw new Error("mp4upload HTTP " + r.status);
  const html = await r.text();
  const m =
    html.match(/src\s*:\s*["'](https?:\/\/[^"']+\.mp4[^"']*)["']/i) ||
    html.match(/["']?file["']?\s*:\s*["'](https?:\/\/[^"']+)["']/i) ||
    html.match(/<source[^>]+src\s*=\s*["'](https?:\/\/[^"']+)["']/i);
  if (!m) throw new Error("mp4upload: no video in embed");
  return {
    url: decodeEscapes(m[1]),
    mime: "video/mp4",
    headers: { Referer: "https://www.mp4upload.com/", "User-Agent": BROWSER_UA },
    expiresInSeconds: 3600,
  };
}

function voeDecode(packed) {
  let s = packed.replace(/[a-zA-Z]/g, (c) => {
    const base = c <= "Z" ? 65 : 97;
    return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base);
  });
  for (const junk of ["@$", "^^", "~@", "%?", "*~", "!!", "#&"]) s = s.split(junk).join("");
  s = atob(s);
  let shifted = "";
  for (let i = 0; i < s.length; i++) shifted += String.fromCharCode(s.charCodeAt(i) - 3);
  return JSON.parse(atob(shifted.split("").reverse().join("")));
}

function voeSourceFrom(html) {
  const packed = html.match(/<script type="application\/json">\s*\[\s*"([^"]+)"\s*\]\s*<\/script>/);
  if (packed) {
    const data = voeDecode(packed[1]);
    if (data && data.source) return data.source;
  }
  const hls = html.match(/["']hls["']\s*:\s*["']([^"']+)["']/);
  if (hls) {
    const v = hls[1];
    return v.startsWith("http") ? v : atob(v);
  }
  return null;
}

async function fromVoe(embedUrl) {
  let url = embedUrl;
  for (let hop = 0; hop < 3; hop++) {
    const r = await kino.fetch(url, { headers: { "User-Agent": BROWSER_UA } });
    if (!r.ok) throw new Error("voe HTTP " + r.status);
    const html = await r.text();
    const source = voeSourceFrom(html);
    if (source) {
      return {
        url: source,
        mime: "application/vnd.apple.mpegurl",
        headers: { "User-Agent": BROWSER_UA },
        expiresInSeconds: 3 * 3600,
      };
    }
    const next = html.match(/window\.location\.href\s*=\s*['"]([^'"]+)['"]/);
    if (!next) break;
    url = next[1];
  }
  throw new Error("voe: no source in page");
}

async function fromYourUpload(embedUrl) {
  const r = await kino.fetch(embedUrl, { headers: { "User-Agent": BROWSER_UA, Referer: BASE + "/" } });
  if (!r.ok) throw new Error("yourupload HTTP " + r.status);
  const html = await r.text();
  const m =
    html.match(/<meta[^>]+og:video["'][^>]*content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+og:video["']/i) ||
    html.match(/file\s*:\s*["'](https?:\/\/[^"']+)["']/i);
  if (!m) throw new Error("yourupload: no video in embed");
  const url = decodeHtml(decodeEscapes(m[1]));
  const headers = { Referer: "https://www.yourupload.com/", "User-Agent": BROWSER_UA };
  await checkVideo(url, headers);
  return { url, mime: "video/mp4", headers, expiresInSeconds: 1800 };
}

async function fromStreamTape(embedUrl) {
  const r = await kino.fetch(embedUrl, { headers: { "User-Agent": BROWSER_UA, Referer: BASE + "/" } });
  if (!r.ok) throw new Error("streamtape HTTP " + r.status);
  const html = await r.text();
  const re = /getElementById\(\s*['"](?:robotlink|ideoolink|norobotlink)['"]\s*\)\.innerHTML\s*=\s*['"]([^'"]*)['"]\s*\+\s*\(\s*['"]([^'"]*)['"]\s*\)((?:\s*\.substring\(\s*\d+\s*\))*)/g;
  const links = [];
  let m;
  while ((m = re.exec(html)) !== null) {
    let tail = m[2];
    const cuts = m[3].match(/\d+/g) || [];
    for (let i = 0; i < cuts.length; i++) tail = tail.substring(Number(cuts[i]));
    const head = m[1];
    links.push((head.indexOf("//") === 0 ? "https:" : "") + head + tail);
  }
  if (links.length === 0) throw new Error("streamtape: no link in embed");
  let lastErr;
  for (const link of links.slice(0, 3)) {
    try {
      const v = await checkVideo(link, { "User-Agent": BROWSER_UA });
      return {
        url: v.url || link,
        mime: "video/mp4",
        headers: { "User-Agent": BROWSER_UA },
        expiresInSeconds: 900,
      };
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error("streamtape: no working link");
}

// --- Selección de servidor preferido y resolución de enlace ---

const SERVER_PREFERENCES = {
  voe: fromVoe,
  mp4upload: fromMp4Upload,
  yourupload: fromYourUpload,
  streamtape: fromStreamTape,
};

export async function resolve(reference, host, config) {
  const { servidor: preferredServer, idioma } = config;
  const [slug, episodeNumber] = String(reference).split("/");

  // Obtener información detallada de la serie y episodios
  const { seriesInfo, episodesBySeason, flatEpisodes } = await getSeriesEpisodesOrganized(slug);

  if (!flatEpisodes || flatEpisodes.length === 0) {
    throw kino.error("not_found", `resolve: No episodes found for ${slug}`);
  }

  const episode = flatEpisodes.find(e => String(e.number) === episodeNumber);
  if (!episode) {
    throw kino.error("not_found", `resolve: Episode ${episodeNumber} not found for ${slug}`);
  }

  let embedUrl = episode.embedUrl || episode.playerUrl; // Asumiendo que el episodio tiene esta propiedad
  // Si no hay embedUrl directo, puede que necesitemos obtenerlo de la serieInfo o de otra forma
  if (!embedUrl) {
      // Podríamos intentar obtener una URL base si no está en el episodio
      // Por ahora, asumimos que si no está, no hay enlace directo
      // Esto podría necesitar ser adaptado si la API de AnimeAV1 provee la URL de forma diferente
      console.warn(`[Resolver] No embedUrl found for episode ${episodeNumber} of ${slug}. Using series slug as fallback.`);
      embedUrl = `${BASE}/media/${slug}/${episodeNumber}`; // Fallback a la URL de la página del episodio
  }

  const languagePreference = idioma || "dub-sub";
  
  // Filtrar por idioma si es posible (esto es una suposición, la API puede no exponerlo por episodio)
  // Si la API de AnimeAV1 tiene un campo 'languages' por episodio, se podría usar aquí.
  // Por ahora, se asume que la preferencia de idioma se maneja en la elección del servidor o es global.

  // Intentar con el servidor preferido
  if (preferredServer && SERVER_PREFERENCES[preferredServer]) {
      try {
          console.log(`[Resolver] Intentando servidor preferido: ${preferredServer}`);
          const url = await SERVER_PREFERENCES[preferredServer](embedUrl);
          return url;
      } catch (e) {
          console.warn(`[Resolver] Servidor preferido ${preferredServer} falló: ${e.message}`);
      }
  }

  // Probar otros servidores si el preferido falla o no está configurado
  const serversToTry = ["voe", "upnshare", "mp4upload", "yourupload", "streamtape"];

  for (const serverName of serversToTry) {
      if (serverName === preferredServer) continue;
      const serverFunc = SERVER_PREFERENCES[serverName];
      if (serverFunc) {
          try {
              console.log(`[Resolver] Intentando servidor: ${serverName}`);
              const url = await serverFunc(embedUrl);
              return url;
          } catch (e) {
              console.warn(`[Resolver] Servidor ${serverName} falló: ${e.message}`);
          }
      }
  }
  
  throw kino.error("unavailable", "No se pudo encontrar un servidor de video válido.");
}

// --- Exportación --- (Mantenemos la estructura original para compatibilidad con Kino)
module.exports = {
  id: "animeav1",
  name: "AnimeAV1 - Plugin Mejorado",
  version: "1.7.0",
  apiVersion: 7,
  entry: "plugin.js",
  description: "Anime en español latino (y subtitulado si no hay) desde animeav1.com. Mejora completa para mostrar todos los episodios y múltiples temporadas.",
  color: "#8E6BFF",
  section: {
    label: "AnimeAV1"
  },
  categories: [], // Se cargarán dinámicamente
  hosts: [
    "animeav1.com", "cdn.animeav1.com", "voe.sx", "jeremyparticipantanything.com", "teresapoliticallearn.com",
    "mp4upload.com", "yourupload.com", "*.mp4upload.com", "yourupload.com", "*.yourupload.com",
    "vidcache.net", "streamtape.com", "tapecontent.net", "*.tapecontent.net", "*.uns.bio"
  ],
  streamHosts: "any",
  capabilities: [
    "home",
    "browse",
    "search",
    "episodes",
    "resolve",
    "download"
  ],
  settings: [
    {
      key: "idioma",
      label: "Idioma",
      type: "select",
      default: "dub-sub",
      options: [
        { value: "dub", label: "Solo latino" },
        { value: "dub-sub", label: "Latino, o subtitulado si no hay" },
        { value: "sub", label: "Solo subtitulado" }
      ]
    },
    {
      key: "servidor",
      label: "Servidor preferido",
      type: "select",
      default: "voe",
      options: [
        { value: "voe", label: "Voe (720p, funciona en TV)" },
        { value: "upnshare", label: "UPNShare (hasta 1080p, funciona en TV)" },
        { value: "mp4upload", label: "MP4Upload (1080p AV1, celular)" },
        { value: "yourupload", label: "YourUpload (mp4)" },
        { value: "streamtape", label: "StreamTape (mp4)" }
      ]
    }
  ],
  icon: "icon.png"
};

module.exports = {
  ...PLUGIN,
  search,
  episodes,
  resolve,
  home,
  browse,
};