// Telegram bot for the NBA blender (Vercel serverless function).
//
// Two jobs:
//   1. POST /api/telegram?store=1  (from the blender, when you send to Nick): saves today's card — player, side, line, book, price, play-to.
//   2. Telegram webhook (POST /api/telegram): on /check (or the CHECK button under the chat) it pulls live prices from the same OpticOdds proxy
//      the blender uses, keeps every pick still at or better than its play-to, and replies with the list.
//
// Vercel env vars (Project → Settings → Environment Variables):
//   TELEGRAM_BOT_TOKEN   the bot token from @BotFather (required)
//   OO_BACKEND           the blender's OpticOdds proxy, default https://nfl-props-tracker-1.vercel.app/api/odds
//   TELEGRAM_SECRET      optional: a password the blender sends with the card so nobody else can overwrite it
// Then point Telegram at this function once (replace TOKEN and HOST):
//   https://api.telegram.org/botTOKEN/setWebhook?url=https://HOST/api/telegram
//
// The card is kept in the function's memory and also echoed back to the blender; Vercel may spin the function down between calls, so the
// blender re-sends the card on every Nick send and the bot keeps the last one it saw per day. If it has nothing, it says so.

const TOKEN = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
const OO = (process.env.OO_BACKEND || "https://nfl-props-tracker-1.vercel.app/api/odds").trim();
const SECRET = (process.env.TELEGRAM_SECRET || "").trim();
const BOOKS = ["FanDuel", "Prop Builder", "Props Builder", "Pinnacle", "bet105", "DraftKings", "Novig", "Prophet X", "Kalshi", "Fliff"];
const HEAD = new Set(["fanduel", "prop builder", "props builder", "pinnacle", "bet105"]);   // the card's headline books; exchanges need $500 at the price
const EXCH = new Set(["novig", "prophet x", "kalshi"]);
const LABEL = { fanduel: "FanDuel", "prop builder": "Prop Builder", "props builder": "Prop Builder", pinnacle: "Pinnacle", bet105: "Bet105", draftkings: "DraftKings", novig: "Novig", "prophet x": "ProphetX", kalshi: "Kalshi", fliff: "Fliff" };

let card = globalThis.__nbaCard || null;   // { day, at, picks: [{ player, team, stat, ou, line, book, odds, playTo }] }

const dec = o => o > 0 ? 1 + o / 100 : 1 + 100 / Math.abs(o);
const fo = o => o == null ? "—" : (o > 0 ? "+" + o : String(o));
const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\b(jr|sr|ii|iii|iv)\b/g, "").replace(/[^a-z]/g, "");
const STAT_RE = { PTS: /^player points$/i, REB: /^player rebounds$/i, AST: /^player assists$/i, "3PM": /^player (threes|3[- ]?pointers?( made)?)$/i, PRA: /^player (pts ?\+ ?rebs? ?\+ ?asts?|points ?\+ ?rebounds ?\+ ?assists)$/i };
const STAT_WORD = { PTS: "points", REB: "rebounds", AST: "assists", "3PM": "threes", PRA: "PRA" };

async function oo(endpoint, params) {
  const r = await fetch(OO, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint, params }) });
  const t = await r.text(); if (!r.ok) throw new Error(`OpticOdds ${r.status}: ${t.slice(0, 100)}`); return JSON.parse(t);
}
async function tg(method, body) {
  const r = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return r.json().catch(() => ({}));
}
// order book -> [{price, size}] best first
function levels(top, ob, topLiq) {
  const normP = v => { v = Number(v); return (v > 1 && v < 50) ? (v >= 2 ? Math.round((v - 1) * 100) : Math.round(-100 / (v - 1))) : v; };
  const rows = (Array.isArray(ob) ? ob : []).filter(l => Array.isArray(l) && l.length >= 2), out = [];
  if (rows.length) { const pf = Math.abs(normP(rows[0][0]) - Number(top)) <= Math.abs(normP(rows[0][1]) - Number(top)); rows.forEach(l => { const p = pf ? normP(l[0]) : normP(l[1]), s = pf ? Number(l[1]) : Number(l[0]); if (!isNaN(p) && s > 0) out.push({ price: p, size: s }); }); }
  else if (topLiq != null) out.push({ price: Number(top), size: Number(topLiq) });
  return out.sort((a, b) => b.price - a.price);
}
// live prices for today's picks → text
async function checkText() {
  if (!card || !card.picks || !card.picks.length) return "Nothing sent to Nick today yet.";
  const t0 = Date.now() - 6 * 3600e3, t1 = Date.now() + 30 * 3600e3, fixtures = [];
  for (let page = 1; page <= 20; page++) { const r = await oo("/fixtures", { sport: "basketball", league: "nba", page }); (r?.data || []).forEach(f => { const t = new Date(f.start_date).getTime(); if (t >= t0 && t <= t1 && f.status !== "completed") fixtures.push(f); }); if (!r?.has_more) break; }
  // every pick's team → fixture; one odds pull per fixture, player-prop markets only
  const teamOf = f => [f.home_competitors?.[0]?.abbreviation, f.away_competitors?.[0]?.abbreviation, f.home_team_display, f.away_team_display].map(x => String(x || "").toUpperCase());
  const byFix = new Map();
  card.picks.forEach(p => { const f = fixtures.find(f => teamOf(f).some(x => x.includes(String(p.team || "").toUpperCase()) || (p.game && String(p.game).toUpperCase().split("@").map(s => s.trim()).some(s => x.includes(s))))); if (f) { if (!byFix.has(f.id)) byFix.set(f.id, []); byFix.get(f.id).push(p); } else p._miss = "game not found"; });
  for (const [fid, picks] of byFix) {
    let odds = [];
    for (let i = 0; i < BOOKS.length; i += 5) { try { const r = await oo("/fixtures/odds", { fixture_id: [fid], sportsbook: BOOKS.slice(i, i + 5) }); (r?.data?.[0]?.odds || []).forEach(o => odds.push(o)); } catch (e) {} }
    picks.forEach(p => {
      const re = STAT_RE[p.stat]; if (!re) { p._miss = "market"; return; }
      const mine = odds.filter(o => re.test(String(o.market || "")) && String(o.selection_line || "").toLowerCase() === p.ou && Number(o.points) === Number(p.line) && norm(o.selection || o.name) === norm(p.player));
      const thr = dec(p.playTo), live = [];
      mine.forEach(o => {
        const bk = String(o.sportsbook || "").toLowerCase(), price = Number(o.price); if (isNaN(price) || dec(price) < thr) return;   // past the play-to = not a play
        if (EXCH.has(bk)) { const lv = levels(price, o.order_book, o.limits && o.limits.max), at = lv.filter(l => dec(l.price) >= thr).reduce((a, l) => a + l.size, 0); if (at < 500) return; live.push({ book: LABEL[bk] || o.sportsbook, odds: price, depth: at }); }
        else live.push({ book: LABEL[bk] || o.sportsbook, odds: price });
      });
      live.sort((a, b) => b.odds - a.odds); p._live = live;
    });
  }
  const ok = card.picks.filter(p => p._live && p._live.length), gone = card.picks.filter(p => !(p._live && p._live.length));
  const now = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });
  const byPl = {}; ok.forEach(p => { const k = norm(p.player); byPl[k] = (byPl[k] || 0) + 1; }); const same = Object.values(byPl).filter(n => n > 1).reduce((a, n) => a + n, 0);
  const L = [`NBA Model (${ok.length} Prop${ok.length === 1 ? "" : "s"}${same ? `, ${same} Same Player` : ""}) — still available ${now} ET${gone.length ? ` (${gone.length} of ${card.picks.length} gone)` : ""}`, ""];
  const byP = new Map(); ok.forEach(p => { const k = norm(p.player); if (!byP.has(k)) byP.set(k, []); byP.get(k).push(p); });
  byP.forEach(g => {
    const multi = g.length > 1, team = g[0].team ? ` (${g[0].team})` : "";
    if (multi) L.push(`${g[0].player}${team} (${g.length} Props)`);
    g.forEach((p, i) => { const best = p._live[0], rest = p._live.slice(1).map(b => `${b.book} ${fo(b.odds)}${b.depth ? ` $${Math.round(b.depth)}` : ""}`).join("  ");
      L.push(`${multi ? `  ${i + 1}. ` : `${p.player}${team}  `}${p.ou} ${p.line} ${STAT_WORD[p.stat] || p.stat} ${fo(best.odds)} ${best.book}${best.depth ? ` $${Math.round(best.depth)}` : ""}  play to ${fo(p.playTo)}`);
      if (rest) L.push(`${multi ? "     " : ""}${rest}`); });
    L.push("");
  });
  if (gone.length) L.push(`Gone (past play-to or pulled): ${gone.map(p => `${p.player} ${p.ou[0]}${p.line} ${p.stat}`).join(", ")}`);
  return L.join("\n").trimEnd();
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*"); res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (!TOKEN) return res.status(500).json({ error: "TELEGRAM_BOT_TOKEN is not set on this Vercel project" });
  let body = req.body; if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = {}; } } body = body || {};
  // 1) the blender storing today's card
  if (req.query && req.query.store) {
    if (SECRET && body.secret !== SECRET) return res.status(403).json({ error: "bad secret" });
    if (!Array.isArray(body.picks)) return res.status(400).json({ error: "picks[] missing" });
    card = globalThis.__nbaCard = { day: body.day || new Date().toISOString().slice(0, 10), at: Date.now(), picks: body.picks.map(p => ({ player: p.player, team: p.team, game: p.game, stat: p.stat, ou: String(p.ou || "").toLowerCase(), line: Number(p.line), book: p.book, odds: Number(p.odds), playTo: Number(p.playTo) })).filter(p => p.player && p.stat && p.line && p.playTo) };
    // the CHECK button under the chat, set once per store so it is always there
    if (body.chat) await tg("sendMessage", { chat_id: body.chat, text: `Card loaded: ${card.picks.length} picks. Tap CHECK any time for what is still available.`, reply_markup: { keyboard: [[{ text: "CHECK" }]], resize_keyboard: true, is_persistent: true } });
    return res.status(200).json({ ok: true, n: card.picks.length });
  }
  // 2) Telegram webhook
  const msg = body.message || body.channel_post || body.edited_message; if (!msg) return res.status(200).json({ ok: true });
  const text = String(msg.text || "").trim().toLowerCase(), chat = msg.chat && msg.chat.id;
  if (!chat) return res.status(200).json({ ok: true });
  if (/^\/?check\b|^\/start\b/.test(text)) {
    let out; try { out = await checkText(); } catch (e) { out = "Check failed: " + (e && e.message || e); }
    await tg("sendMessage", { chat_id: chat, text: out.slice(0, 4000), reply_markup: { keyboard: [[{ text: "CHECK" }]], resize_keyboard: true, is_persistent: true } });
  }
  return res.status(200).json({ ok: true });
};
