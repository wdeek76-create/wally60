// RotoWire proxy (Vercel serverless function).
//
// RotoWire doesn't let web pages call api.rotowire.com directly (CORS), so the
// blender calls this instead:  /api/rotowire?feed=NFLWeeklyProj&week=7
// The API key lives ONLY in this Vercel project's environment variable
// ROTOWIRE_API_KEY — never in the page, the browser, or the repo.
//
// Feed name -> [sport/league path, endpoints tried in order (plans differ)].
const FEEDS = {
  // NFL
  NFLWeeklyProj: ["Football/NFL", ["WeeklyProjections.php"]],
  // NBA (the NBA blender falls back to this project's helper when it isn't hosted itself)
  NBAInjuries:   ["Basketball/NBA", ["Injuries.php"]],
  NBANews:       ["Basketball/NBA", ["News.php?hours=48", "News/Injuries.php?hours=48"]],
  NBALineups:    ["Basketball/NBA", ["Lineups.php", "ExpectedLineups.php", "DailyLineups.php"]],
  NBADailyProj:  ["Basketball/NBA", ["DailyProjections.php"]],
  NBADepth:      ["Basketball/NBA", ["DepthCharts.php", "DepthChart.php"]],
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();

  const key = (process.env.ROTOWIRE_API_KEY || "").trim();
  if (!key) return res.status(500).json({ error: "ROTOWIRE_API_KEY is not set on this Vercel project (Settings → Environment Variables), then redeploy" });

  const q = req.query || {};
  const feed = String(q.feed || "");
  const cfg = FEEDS[feed];
  if (!cfg) return res.status(400).json({ error: "unknown feed", feeds: Object.keys(FEEDS) });
  const [base, paths] = cfg;

  // Pass-through params, digits only (week=7, season=2026)
  const extra = ["week", "season"]
    .filter(p => /^\d{1,4}$/.test(String(q[p] || "")))
    .map(p => `&${p}=${q[p]}`).join("");

  let last = null;
  for (const path of paths) {
    const url = `https://api.rotowire.com/${base}/${path}${path.includes("?") ? "&" : "?"}format=json${extra}&key=${encodeURIComponent(key)}`;
    try {
      const r = await fetch(url, { headers: { Accept: "application/json" } });
      const text = await r.text();
      if (r.ok) {
        res.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate=300");
        res.setHeader("Content-Type", "application/json");
        return res.status(200).send(text);
      }
      last = { status: r.status, endpoint: path.split("?")[0], body: text.slice(0, 300).split(key).join("•••") };
    } catch (e) {
      last = { status: 502, endpoint: path.split("?")[0], body: String((e && e.message) || e) };
    }
  }
  // Never echo the key back.
  return res.status(last ? last.status : 502).json({ error: "RotoWire request failed", ...last });
}
