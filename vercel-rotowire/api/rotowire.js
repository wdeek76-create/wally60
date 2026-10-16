// RotoWire feed proxy for the NBA blender (Vercel serverless function).
//
// The RotoWire API key never reaches the browser or this repo: it lives in the
// Vercel project's environment variable ROTOWIRE_FEED_URL, set to the exact
// RotoWire URL you already use, key included, but WITHOUT the &feed=... part.
// (The blender calls  /api/rotowire?feed=NBAInjuries  and this adds the feed.)
//
// Only NBA feeds are passed through, so the endpoint can't be used to pull
// anything else on your subscription.
const ALLOWED = new Set([
  "NBAInjuries", "NBANews", "NBALineups", "NBADepth", "NBADailyProj",
  "NBAPlayers", "NBACeilFloor", "nba-DFS-dk", "nba-DFS-fd",
]);

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.status(204).end(); return; }

  const base = process.env.ROTOWIRE_FEED_URL;
  if (!base) { res.status(500).json({ error: "ROTOWIRE_FEED_URL is not set on this Vercel project" }); return; }
  const feed = String((req.query && req.query.feed) || "");
  if (!ALLOWED.has(feed)) { res.status(400).json({ error: "feed not allowed", allowed: [...ALLOWED] }); return; }

  let url;
  try {
    url = new URL(base);
    url.searchParams.set("feed", feed);
    if (!url.searchParams.has("format")) url.searchParams.set("format", "json");
  } catch (e) { res.status(500).json({ error: "ROTOWIRE_FEED_URL is not a valid URL" }); return; }

  try {
    const r = await fetch(url.toString(), { headers: { Accept: "application/json" } });
    const text = await r.text();
    // Never echo the upstream URL back — it carries the key.
    res.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate=300");
    res.setHeader("Content-Type", r.headers.get("content-type") || "application/json");
    res.status(r.status).send(text);
  } catch (e) {
    res.status(502).json({ error: "RotoWire request failed", detail: String(e && e.message || e) });
  }
};
