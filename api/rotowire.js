// RotoWire proxy for the NBA + NHL blenders (Vercel serverless function).
//
// RotoWire doesn't let browsers call api.rotowire.com directly (CORS), so the
// blenders call this instead:  /api/rotowire?feed=NHLDailyProj
// The API key lives ONLY in the Vercel project's environment variable
// ROTOWIRE_API_KEY — never in the page, the browser, or the repo.
// Blender feed name → [RotoWire sport base, endpoints tried in order (plans differ)].
const FEEDS = {
  NBAInjuries:  ["Basketball/NBA", ["Injuries.php"]],
  NBANews:      ["Basketball/NBA", ["News.php?hours=48", "News/Injuries.php?hours=48"]],
  NBALineups:   ["Basketball/NBA", ["Lineups.php", "ExpectedLineups.php", "DailyLineups.php"]],
  NBADailyProj: ["Basketball/NBA", ["DailyProjections.php"]],
  NBADepth:     ["Basketball/NBA", ["DepthCharts.php", "DepthChart.php"]],
  NHLDailyProj: ["Hockey/NHL", ["DailyProjections.php", "Projections/Daily.php"]],
  NHLInjuries:  ["Hockey/NHL", ["Injuries.php"]],
  NHLLineups:   ["Hockey/NHL", ["Lineups.php", "ExpectedLineups.php", "DailyLineups.php"]],
};

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.status(204).end(); return; }

  const key = (process.env.ROTOWIRE_API_KEY || "").trim();
  if (!key) { res.status(500).json({ error: "ROTOWIRE_API_KEY is not set on this Vercel project (Settings → Environment Variables), then redeploy" }); return; }
  const feed = String((req.query && req.query.feed) || "");
  const def = FEEDS[feed];
  if (!def) { res.status(400).json({ error: "unknown feed", feeds: Object.keys(FEEDS) }); return; }
  const [sport, paths] = def;

  let last = null;
  for (const path of paths) {
    const url = `https://api.rotowire.com/${sport}/${path}${path.includes("?") ? "&" : "?"}format=json&key=${encodeURIComponent(key)}`;
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
