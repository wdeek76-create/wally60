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

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.status(204).end(); return; }

  const key = (process.env.ROTOWIRE_API_KEY || "").trim();
  if (!key) { res.status(500).json({ error: "ROTOWIRE_API_KEY is not set on this Vercel project (Settings → Environment Variables), then redeploy" }); return; }
  // DIAGNOSTIC: /api/rotowire?probe=1 — tries likely RotoWire "feed=" endpoints with your key (no feed
  // parameter, so the right one answers "Missing or invalid feed parameter" + its feed list).
  // Results show the address pattern with the key hidden. Open it in a browser and copy the page.
  if (req.query && req.query.probe) {
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
  const paths = PATHS[feed];
  if (!paths) { res.status(400).json({ error: "unknown feed", feeds: Object.keys(PATHS) }); return; }

  const date = /^\d{4}-\d{2}-\d{2}$/.test(String((req.query && req.query.date) || "")) ? `&date=${req.query.date}` : "";
  let last = null;
  for (const path of paths) {
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
  // Never echo the key back.
  res.status(last ? last.status : 502).json({ error: "RotoWire request failed", ...last });
};
