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
  const feed = String((req.query && req.query.feed) || "");
  const paths = PATHS[feed];
  if (!paths) { res.status(400).json({ error: "unknown feed", feeds: Object.keys(PATHS) }); return; }

  let last = null;
  for (const path of paths) {
    const url = `${BASE}/${path}${path.includes("?") ? "&" : "?"}format=json&key=${encodeURIComponent(key)}`;
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
