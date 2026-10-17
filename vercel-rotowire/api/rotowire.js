// RotoWire proxy for the NBA blender (Vercel serverless function).
//
// RotoWire doesn't let browsers call api.rotowire.com directly (CORS), so the
// blender calls this instead:  /api/rotowire?feed=NBAInjuries
// The API key lives ONLY in this Vercel project's environment variable
// ROTOWIRE_API_KEY — never in the page, the browser, or the repo.
const BASE = "https://api.rotowire.com/Basketball/NBA";
// Blender feed name → RotoWire NBA endpoints, tried in order (plans differ).
const PATHS = {
  NBAInjuries:  ["Injuries.php"],
  NBANews:      ["News.php?hours=48", "News/Injuries.php?hours=48"],
  NBALineups:   ["Lineups.php", "ExpectedLineups.php", "DailyLineups.php"],
  NBADailyProj: ["DailyProjections.php"],
  NBADepth:     ["DepthCharts.php", "DepthChart.php"],
  NBAPlayers:   ["Players.php", "PlayerList.php"],
  NBACeilFloor: ["CeilFloor.php", "CeilingFloor.php", "DailyProjectionsCeilFloor.php"],
};

// RotoWire's second API style: one endpoint that takes  ?key=…&feed=NBACeilFloor  (the one that answers
// "Missing or invalid feed parameter" + a list of valid feeds). Its exact address isn't documented to us,
// so likely addresses are tried and the first that answers with real data (not that error) is remembered.
const FEED_HOSTS = ["https://api.rotowire.com", "https://www.rotowire.com", "https://rotowire.com"];
const FEED_FILES = ["feed.php", "feeds.php", "Feed.php", "api.php", "index.php", "feed", "api/feed.php", "Basketball/NBA/feed.php", "Basketball/NBA/Feed.php", "Basketball/feed.php"];
const PARAM_FEEDS = new Set(["NBACeilFloor", "nba-DFS-dk", "nba-DFS-fd", "NBALineups"]);
// RotoWire's own keyless proxy (they hold the key on their side): …/api/proxy?feed=NBACeilFloor.
// Serves every feed name RotoWire lists. Override with ROTOWIRE_PROXY_URL if they ever move it.
const RW_PROXY = (process.env.ROTOWIRE_PROXY_URL || "https://rotowire-secrets-ebgmaeh8ecc4huhf.canadaeast-01.azurewebsites.net/api/proxy").trim();
let proxyNote = null;   // what RotoWire's proxy last said — shown in errors so a block is visible
async function viaProxy(feed, date, link) {
  const base = (link && link.proxy) || RW_PROXY;
  const url = `${base}${base.includes("?") ? "&" : "?"}feed=${encodeURIComponent(feed)}${date}`;
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 12000);
  try {
    const r = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 (compatible; NBA-blender)", Referer: "https://www.rotowire.com/" }, signal: ctl.signal });
    const text = await r.text();
    let data; try { data = JSON.parse(text); } catch (e) { proxyNote = { status: r.status, body: text.slice(0, 160).replace(/\s+/g, " ") }; return null; }
    if (!r.ok || (data && !Array.isArray(data) && data.error)) { proxyNote = { status: r.status, body: String((data && data.error) || text).slice(0, 160) }; return null; }
    proxyNote = null;
    return text;
  } catch (e) { proxyNote = { status: 0, body: "could not reach RotoWire's proxy from Vercel: " + String(e && e.message || e).slice(0, 80) }; return null; } finally { clearTimeout(t); }
}
let feedBase = null;   // remembered between calls while the function stays warm
async function viaFeedParam(feed, key, date, link) {
  const tryOne = async (base) => {
    const url = `${base}?key=${encodeURIComponent(key)}&feed=${encodeURIComponent(feed)}${date}`;
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 9000);
    try {
      const r = await fetch(url, { headers: { Accept: "application/json" }, signal: ctl.signal });
      const text = await r.text();
      let data; try { data = JSON.parse(text); } catch (e) { return null; }
      if (!r.ok || (data && !Array.isArray(data) && data.error)) return null;
      return { base, text };
    } catch (e) { return null; } finally { clearTimeout(t); }
  };
  if (feedBase) { const hit = await tryOne(feedBase); if (hit) return hit.text; feedBase = null; }
  if (link && link.origin && link.path) { const hit0 = await tryOne(link.origin + link.path); if (hit0) { feedBase = hit0.base; return hit0.text; } }
  const hosts = link && link.origin && !FEED_HOSTS.includes(link.origin) ? [link.origin, ...FEED_HOSTS] : FEED_HOSTS;
  const results = await Promise.all(hosts.flatMap(h => FEED_FILES.map(f => tryOne(`${h}/${f}`))));
  const hit = results.find(Boolean);
  if (hit) { feedBase = hit.base; return hit.text; }
  return null;
}

// The blender can send a RotoWire link (or key) it saved in YOUR browser, in the x-rw-link header, so you
// can type it into the tool instead of Vercel. Only https://*.rotowire.com addresses are accepted; the key
// in it is used when no ROTOWIRE_API_KEY is set. The header is never logged or echoed.
function parseLink(h) {
  try {
    const raw = decodeURIComponent(String(h || "")).trim();
    if (!raw) return null;
    if (/^[A-Za-z0-9_\-]{6,}$/.test(raw)) return { key: raw, origin: null, path: null };      // just a key
    const u = new URL(raw);
    if (u.protocol === "https:" && /^rotowire-[a-z0-9-]+\.[a-z0-9.-]*azurewebsites\.net$/i.test(u.hostname)) return { key: null, origin: null, path: null, proxy: u.origin + u.pathname };
    if (u.protocol !== "https:" || !/(^|\.)rotowire\.com$/i.test(u.hostname)) return null;
    return { key: u.searchParams.get("key"), origin: u.origin, path: u.pathname };
  } catch (e) { return null; }
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.status(204).end(); return; }

  const link = parseLink(req.headers && req.headers["x-rw-link"]);
  const key = (link && link.key) || (process.env.ROTOWIRE_API_KEY || "").trim();
  // DIAGNOSTIC: /api/rotowire?probe=1 — tries likely RotoWire "feed=" endpoints with your key (no feed
  // parameter, so the right one answers "Missing or invalid feed parameter" + its feed list).
  // Results show the address pattern with the key hidden. Open it in a browser and copy the page.
  if (req.query && req.query.probe && key) {
    const hosts = ["https://api.rotowire.com", "https://www.rotowire.com", "https://rotowire.com"];
    const files = ["feed.php", "feeds.php", "Feed.php", "api.php", "index.php", "feed", "api/feed.php", "Basketball/NBA/feed.php", "Basketball/NBA/Feed.php", "Basketball/feed.php"];
    const out = [];
    const key0 = encodeURIComponent(key);
    await Promise.all(hosts.flatMap(h => files.map(async f => {
      const url = `${h}/${f}?key=${key0}`;
      const label = `${h}/${f}?key=•••`;
      try {
        const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 8000);
        const r = await fetch(url, { headers: { Accept: "application/json" }, signal: ctl.signal }); clearTimeout(t);
        const body = (await r.text()).split(key).join("•••").slice(0, 140).replace(/\s+/g, " ");
        out.push({ url: label, status: r.status, type: (r.headers.get("content-type") || "").split(";")[0], body, hit: /valid_feeds|Missing or invalid feed/i.test(body) });
      } catch (e) { out.push({ url: label, status: 0, body: String(e && e.message || e).slice(0, 60) }); }
    })));
    out.sort((a, b) => (b.hit ? 1 : 0) - (a.hit ? 1 : 0) || (b.status === 200 ? 1 : 0) - (a.status === 200 ? 1 : 0));
    res.setHeader("Content-Type", "application/json");
    res.status(200).send(JSON.stringify({ FOUND: out.filter(o => o.hit), others: out.filter(o => !o.hit && o.status && o.status !== 404).slice(0, 12) }, null, 1));
    return;
  }
  const feed = String((req.query && req.query.feed) || "");
  const paths = PATHS[feed] || [];
  if (!paths.length && !PARAM_FEEDS.has(feed)) { res.status(400).json({ error: "unknown feed", feeds: [...Object.keys(PATHS), ...PARAM_FEEDS] }); return; }

  const date = /^\d{4}-\d{2}-\d{2}$/.test(String((req.query && req.query.date) || "")) ? `&date=${req.query.date}` : "";
  const sendOk = (text) => { res.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate=300"); res.setHeader("Content-Type", "application/json"); res.status(200).send(text); };
  // Feeds the regular API has no address for (ceiling/floor, lineups, DFS) go straight to RotoWire's proxy.
  if (PARAM_FEEDS.has(feed)) { const t0 = await viaProxy(feed, date, link); if (t0) { sendOk(t0); return; } }
  let last = null;
  for (const path of key ? paths : []) {
    const url = `${BASE}/${path}${path.includes("?") ? "&" : "?"}format=json&key=${encodeURIComponent(key)}${date}`;
    try {
      const r = await fetch(url, { headers: { Accept: "application/json" } });
      const text = await r.text();
      if (r.ok) {
        res.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate=300");
        res.setHeader("Content-Type", "application/json");
        res.status(200).send(text);
        return;
      }
      last = { status: r.status, endpoint: path.split("?")[0], body: text.slice(0, 300).split(key).join("•••") };
    } catch (e) {
      last = { status: 502, endpoint: path.split("?")[0], body: String(e && e.message || e) };
    }
  }
  { const t1 = await viaProxy(feed, date, link); if (t1) { sendOk(t1); return; } }   // last resort for every feed
  if (!key) { res.status(500).json({ error: "RotoWire's proxy didn't answer and no key is saved — click ⚙ on the blender's Morning tab and type your key (or set ROTOWIRE_API_KEY on Vercel)" }); return; }
  if (PARAM_FEEDS.has(feed)) {
    const text = await viaFeedParam(feed, key, date, link);
    if (text) { res.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate=300"); res.setHeader("Content-Type", "application/json"); res.status(200).send(text); return; }
  }
  // Never echo the key back.
  res.status(last ? last.status : 502).json({ error: "RotoWire request failed", ...last, ...(proxyNote ? { rotowireProxy: proxyNote } : {}) });
};
