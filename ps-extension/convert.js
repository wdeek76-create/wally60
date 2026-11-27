// PropShop CSV converter — same column reading as the NBA blender's parseSource, same output as its EXPORT PS button.
// Sources: TABS, SHARPR, STOK (Data Hub Stats), RG (projections-nba), SABER (DFS ID / Name ... PTS Min 2PT 3PT RB ... AST), RW (RotoWire, grouping row above the header), DIMERS (First Name / Last Name).
const PS_HEAD = ["Player", "Team", "Minutes", "Points", "Rebounds", "Assists", "Three Pointers"];

function splitLine(line) {
  const vals = []; let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') inQ = !inQ;
    else if (ch === "," && !inQ) { vals.push(cur.trim()); cur = ""; }
    else cur += ch;
  }
  vals.push(cur.trim());
  return vals.map(v => v.replace(/^"|"$/g, "").trim());
}
function parseCSV(raw) {
  const text = raw.charCodeAt(0) === 0xFEFF ? raw.slice(1) : raw;
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter(l => l.trim());
  if (!lines.length) return { headers: [], rows: [] };
  // RotoWire-style: a grouping row (",,,,Popular Stats,,,") above the real header — the header is the row with more filled cells.
  let hi = 0;
  if (lines.length >= 2) { const a = splitLine(lines[0]).filter(c => c).length, b = splitLine(lines[1]).filter(c => c).length; if (a < b && a < b / 2) hi = 1; }
  const headers = splitLine(lines[hi]);
  const rows = lines.slice(hi + 1).map(line => { const v = splitLine(line), r = {}; headers.forEach((h, i) => { r[h] = v[i] ?? ""; }); return r; }).filter(r => Object.values(r).some(x => x.trim()));
  return { headers, rows };
}
function findCol(headers, candidates) {
  const lc = headers.map(h => h.toLowerCase().trim());
  for (const c of candidates) { const i = lc.findIndex(h => h === c); if (i !== -1) return headers[i]; }
  for (const c of candidates) { const i = lc.findIndex(h => h.includes(c)); if (i !== -1) return headers[i]; }
  return null;
}
// Which source a CSV is, from its headers. null = not one we convert (left alone — PropShop's own sim exports, UA lists, anything else).
function detectSource(headers) {
  const lc = headers.map(h => h.toLowerCase().trim()), has = h => lc.includes(h);
  if (has("market") && has("roi (%)")) return null;                                              // PropShop sim export
  if (has("player") && has("tabs min") && has("pts") && has("reb") && has("ast")) return "TABS";
  if (has("player") && has("tip-off") && has("points") && has("rebounds") && has("assists")) return "SHARPR";
  if (has("player") && has("proj min") && has("exp pts") && has("exp reb")) return "STOK";
  if (has("playerid") && has("player") && has("minutes") && has("pts") && has("reb") && has("ast") && has("3pm")) return "RG";   // RG projections export
  // (the id/name/first_name/three_pointers_made shape is the UA player list, which the blender's UA TEMPLATE slot takes — not a projections source, so it is left alone)
  if (has("dfs id") && has("name") && has("pts") && has("rb") && has("ast")) return "SABER";
  if (has("name") && has("opp") && has("min") && has("pts") && has("reb") && has("ast") && has("3pm") && has("fga")) return "RW";
  if (has("first name") && has("last name") && has("pts") && has("reb") && has("ast")) return "DIMERS";
  return null;
}
function toPropShopNBA(text) {
  const { headers, rows } = parseCSV(text);
  const src = detectSource(headers);
  if (!src) return null;
  const fn = findCol(headers, ["first name"]), ln = findCol(headers, ["last name"]), split = !!(fn && ln);
  const C = {
    name: split ? null : findCol(headers, ["player", "name"]),
    team: findCol(headers, ["team", "tm"]),
    pts: findCol(headers, ["points", "pts", "exp pts"]),
    reb: findCol(headers, ["rebounds", "reb", "rb", "exp reb"]),
    ast: findCol(headers, ["assists", "ast", "exp ast"]),
    threepm: findCol(headers, ["three_pointers_made", "3pm", "3pt", "exp 3p", "threepm"]),
    min: findCol(headers, ["tabs min", "proj min", "minutes", "mins", "min"]),
  };
  if (split) { rows.forEach(r => { r.__name__ = `${(r[fn] || "").trim()} ${(r[ln] || "").trim()}`.trim(); }); C.name = "__name__"; }
  if (!C.name) return null;
  const g = (r, col) => { if (!col) return null; const v = parseFloat(r[col]); return isNaN(v) ? null : v; };
  const esc = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const f2 = v => (v != null && !isNaN(v) && v >= 0) ? Number(v).toFixed(2) : "";   // a real 0 (no threes) stays 0.00
  const players = rows.filter(r => (r[C.name] || "").trim() && /[a-zA-Z]/.test(r[C.name]))
    .map(r => ({ name: r[C.name].trim(), team: C.team ? (r[C.team] || "").trim() : "", min: g(r, C.min), pts: g(r, C.pts), reb: g(r, C.reb), ast: g(r, C.ast), threepm: g(r, C.threepm) }))
    .filter(p => p.pts != null || p.reb != null || p.ast != null)        // OUT players / empty rows carry no numbers
    .sort((a, b) => a.name.localeCompare(b.name));
  return { sport: "NBA", src, n: players.length, csv: nbaCsv(players), players };   // players: for the day's per-source merge (a source exported in several files, e.g. Saber by game)
}
function nbaCsv(players) {
  const esc = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const f2 = v => (v != null && !isNaN(v) && v >= 0) ? Number(v).toFixed(2) : "";
  const rows = players.slice().sort((a, b) => a.name.localeCompare(b.name));
  return "﻿" + [PS_HEAD.join(",")].concat(rows.map(p => [esc(p.name), esc(p.team), f2(p.min), f2(p.pts), f2(p.reb), f2(p.ast), f2(p.threepm)].join(","))).join("\n");
}
// NBA day merge, the way the blender's Saber combine worked: a new file REPLACES the teams it covers and keeps every other team from earlier files.
// (A later file for the same teams is an update; a file for other games adds to the day.) Players with no team are matched by name.
function mergeNba(prev, next) {
  const key = n => String(n || "").toLowerCase().replace(/[.'’]/g, "").replace(/\s+/g, " ").trim();
  const teams = new Set((next || []).map(p => String(p.team || "").toUpperCase()).filter(Boolean));
  const names = new Set((next || []).map(p => key(p.name)));
  const kept = (prev || []).filter(p => !teams.has(String(p.team || "").toUpperCase()) && !names.has(key(p.name)));
  return kept.concat(next || []);
}

// ── NFL ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// Same parsers as the NFL blender (Dimers, FTN, RotoWire / FantasyPts, 4for4, RTS, Stok Data Hub), same columns as its EXPORT PS button.
// A source that comes in several files (Stok pass / rush / rec, RotoWire master / RB-WR-TE / QB, FTN full / QB) is merged per player by the
// background script across the day, so the PropShop file always carries everything downloaded so far.
const NFL_PS_HEAD = ["Player", "Team", "Pass_Att", "Pass_Comp", "Pass_Yds", "Pass_TD", "Rush_Att", "Rush_TD", "Rush_Yds", "Rec", "Rec_TD", "Rec_Yds"];
const NFL_FIELDS = [["Pass_Att", "pass_att"], ["Pass_Comp", "pass_cmp"], ["Pass_Yds", "pass_yds"], ["Pass_TD", "pass_td"], ["Rush_Att", "rush_att"], ["Rush_TD", "rush_td"], ["Rush_Yds", "rush_yds"], ["Rec", "rec"], ["Rec_TD", "rec_td"], ["Rec_Yds", "rec_yds"]];
const normName = n => String(n || "").toLowerCase().replace(/[.'’]/g, "").replace(/\s+(jr|sr|ii|iii|iv|v)\.?$/, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
function numF(v) { if (v == null || v === "" || v === "-" || v === "--") return null; const n = parseFloat(String(v).replace(/[^0-9.\-]/g, "")); return isNaN(n) || n === 0 ? null : n; }
function rowsLower(text) {   // header row lower-cased → rows keyed by it (FTN / 4for4 / RTS / Stok shapes)
  const lines = text.replace(/^\uFEFF/, "").split(/\r\n|\r|\n/).filter(l => l.trim()); if (!lines.length) return { hdr: [], rows: [] };
  const hdr = splitLine(lines[0]).map(h => h.toLowerCase().trim());
  return { hdr, rows: lines.slice(1).map(l => { const c = splitLine(l), r = {}; hdr.forEach((h, i) => { r[h] = c[i] || ""; }); return r; }) };
}
const blankNfl = (name, team, pos) => ({ rawName: name, norm: normName(name), team: String(team || "").toUpperCase(), pos: pos || "", pass_att: null, pass_cmp: null, pass_yds: null, pass_td: null, rush_att: null, rush_yds: null, rush_td: null, rec: null, rec_yds: null, rec_td: null });
function nflDimers(text) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r\n|\r|\n/).filter(l => l.trim());
  const hdr = splitLine(lines[0]).map(h => h.toLowerCase());
  const yds = hdr.reduce((a, h, i) => { if (h === "yds") a.push(i); return a; }, []);
  return lines.slice(1).map(l => { const c = splitLine(l); const name = `${c[0] || ""} ${c[1] || ""}`.trim(); if (!name) return null;
    const o = blankNfl(name, c[2]); o.pass_cmp = numF(c[6]); o.pass_yds = yds[0] != null ? numF(c[yds[0]]) : null; o.rush_yds = yds[1] != null ? numF(c[yds[1]]) : null; o.rec = numF(c[9]); o.rec_yds = yds[2] != null ? numF(c[yds[2]]) : null; return o; }).filter(Boolean);
}
function nflFTN(text) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r\n|\r|\n/).filter(l => l.trim());
  const hi = lines.findIndex(l => /^player,/i.test(l.trim())); if (hi < 0) return [];
  const hdr = splitLine(lines[hi]).map(h => h.toLowerCase().replace(/\.$/, "").trim()), ci = n => hdr.indexOf(n), g = (c, i) => i >= 0 ? numF(c[i]) : null;
  return lines.slice(hi + 1).map(l => { const c = splitLine(l); const name = c[ci("player")] || ""; if (!name.trim()) return null;
    const o = blankNfl(name, c[ci("team")], (c[ci("position")] || "").toUpperCase());
    o.pass_cmp = g(c, ci("pacom")); o.pass_att = g(c, ci("paatt")); o.pass_yds = g(c, ci("payds")); o.pass_td = g(c, ci("patd")); o.rush_att = g(c, ci("ruatt")); o.rush_yds = g(c, ci("ruyds")); o.rush_td = g(c, ci("rutd")); o.rec = g(c, ci("rec")); o.rec_yds = g(c, ci("reyds")); o.rec_td = g(c, ci("retd")); return o; }).filter(Boolean);
}
function nflRW(text) {   // RotoWire / FantasyPts: section row (Passing / Rushing / Receiving) above the per-column header, or the legacy single header
  const lines = text.replace(/^\uFEFF/, "").split(/\r\n|\r|\n/).filter(l => l.trim());
  let hi = -1; for (let i = 0; i < Math.min(6, lines.length); i++) { const l = lines[i].toLowerCase(); if (l.includes("name") && l.includes("team")) { hi = i; break; } }
  if (hi < 0) return [];
  const hdr = splitLine(lines[hi]).map(h => h.toLowerCase().trim()); let sec = [];
  if (hi > 0) { const raw = splitLine(lines[hi - 1]).map(h => h.toLowerCase().trim()); let cur = ""; sec = hdr.map((_, i) => { const v = raw[i] || ""; if (/^(passing|rushing|receiving|fantasy)$/.test(v)) cur = v; return cur; }); }
  const col = {}; hdr.forEach((h, i) => { if (!h) return; const k = (sec[i] || "") + ":" + h; if (col[k] == null) col[k] = i; if (col[":" + h] == null) col[":" + h] = i; });
  const pick = (...ks) => { for (const k of ks) if (col[k] != null) return col[k]; return -1; };
  const iName = pick(":name"), iTeam = pick(":team"), iPos = pick(":pos", ":position"), noSec = !sec.some(Boolean), g = (c, i) => i >= 0 ? numF(c[i]) : null;
  const I = { pass_cmp: pick("passing:comp", "passing:cmp"), pass_att: pick("passing:att"), pass_yds: pick("passing:yds"), pass_td: pick("passing:td"), rush_att: pick("rushing:att"), rush_yds: pick("rushing:yds"), rush_td: pick("rushing:td"), rec: pick("receiving:rec", ":rec"), rec_yds: pick("receiving:yds"), rec_td: pick("receiving:td") };
  return lines.slice(hi + 1).map(l => { const c = splitLine(l); const name = c[iName] || ""; if (!name.trim() || /^rank$/i.test(c[0] || "")) return null;
    const o = blankNfl(name, c[iTeam], iPos >= 0 ? (c[iPos] || "").toUpperCase() : "");
    if (noSec) { o.pass_yds = numF(c[9]); o.pass_td = numF(c[10]); o.rush_att = numF(c[12]); o.rush_yds = numF(c[13]); o.rush_td = numF(c[14]); o.rec = numF(c[15]); o.rec_yds = numF(c[16]); o.rec_td = numF(c[17]); }
    else Object.keys(I).forEach(k => { o[k] = g(c, I[k]); });
    return o; }).filter(Boolean);
}
function nflFF4(text) {
  const { rows } = rowsLower(text);
  return rows.filter(r => (r["player"] || "").trim()).map(r => { const o = blankNfl(r["player"], "", (r["pos"] || "").toUpperCase()); o.pass_att = numF(r["pass att"]); o.pass_cmp = numF(r["pass comp"]); o.pass_yds = numF(r["pass yds"]); o.pass_td = numF(r["pass td"]); o.rush_att = numF(r["rush att"]); o.rush_yds = numF(r["rush yds"]); o.rec = numF(r["rec"]); o.rec_yds = numF(r["rec yds"]); return o; });
}
function nflRTS(text) {
  const { rows } = rowsLower(text), MK = { "passing yards": "pass_yds", "passing touchdowns": "pass_td", "passing attempts": "pass_att", "passing completions": "pass_cmp", "rushing yards": "rush_yds", "rushing attempts": "rush_att", "receiving yards": "rec_yds", "receiving receptions": "rec" }, out = {};
  rows.forEach(r => { const name = (r["player"] || "").trim(); if (!name) return; const key = MK[(r["market"] || "").toLowerCase().trim()], proj = numF(r["rts projection"]); const o = out[name] || (out[name] = blankNfl(name, "")); if (key && proj != null && o[key] == null) o[key] = proj; });
  return Object.values(out);
}
function nflStok(text) {
  const { hdr, rows } = rowsLower(text); const kind = hdr.includes("pass yds") ? "pass" : hdr.includes("rush yds") ? "rush" : hdr.includes("rec yds") ? "rec" : null; if (!kind) return [];
  return rows.filter(r => r["player"]).map(r => { const o = blankNfl(r["player"], r["team"], kind === "pass" ? "QB" : "");
    if (kind === "pass") { o.pass_att = numF(r["att"]); o.pass_cmp = numF(r["comp"]); o.pass_yds = numF(r["pass yds"]); o.pass_td = numF(r["td"]); }
    if (kind === "rush") { o.rush_att = numF(r["rush"]); o.rush_yds = numF(r["rush yds"]); o.rush_td = numF(r["td"]); }
    if (kind === "rec") { o.rec = numF(r["rec"]); o.rec_yds = numF(r["rec yds"]); o.rec_td = numF(r["td"]); }
    return o; });
}
// Which NFL source a file is (checked after the NBA shapes). fileName breaks the RotoWire / FantasyPts tie (same layout).
function detectNfl(text, fileName) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r\n|\r|\n/).filter(l => l.trim()).slice(0, 4).map(l => l.toLowerCase());
  const h0 = lines[0] || "", all = lines.join("\n");
  const cols = splitLine(h0).map(x => x.trim()), has = c => cols.includes(c);
  if (has("player") && has("market") && has("rts projection")) return "RTS";
  if (has("pos") && has("player") && has("pass yds") && has("rush att") && has("total td")) return "4FOR4";
  if (has("player") && has("team") && has("opp") && (has("pass yds") || has("rush yds") || has("rec yds"))) return "STOK";
  if (/^player,position,team/.test(all.replace(/^.*\n/, "")) || /(^|\n)player,position,team,opp/.test(all)) return "FTN";
  if (has("first name") && has("last name") && cols.filter(c => c === "yds").length >= 2) return "DIMERS";
  if (/name/.test(all) && /team/.test(all) && /(passing|rushing|receiving)/.test(all) && !/\bpts\b|\breb\b/.test(h0)) return /fantasy ?pts|fpts/i.test(fileName || "") ? "FPTS" : "RW";
  return null;
}
function parseNfl(src, text) {
  return src === "DIMERS" ? nflDimers(text) : src === "FTN" ? nflFTN(text) : src === "RW" || src === "FPTS" ? nflRW(text) : src === "4FOR4" ? nflFF4(text) : src === "RTS" ? nflRTS(text) : src === "STOK" ? nflStok(text) : [];
}
// Merge rows per player (a later file only fills what is still empty) → PropShop CSV
function mergeNfl(a, b) {
  const by = {}; [].concat(a || [], b || []).forEach(p => { if (!p || !p.norm) return; const ex = by[p.norm]; if (!ex) { by[p.norm] = { ...p }; return; } Object.keys(p).forEach(k => { if (p[k] != null && p[k] !== "" && (ex[k] == null || ex[k] === "")) ex[k] = p[k]; }); });
  return Object.values(by);
}
function nflCsv(players) {
  const esc = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = players.filter(p => NFL_FIELDS.some(([, k]) => p[k] != null && p[k] > 0)).sort((a, b) => a.rawName.localeCompare(b.rawName));
  const lines = [NFL_PS_HEAD.join(",")].concat(rows.map(p => [esc(p.rawName), esc(p.team || "")].concat(NFL_FIELDS.map(([, k]) => p[k] == null ? "" : Number(p[k]).toFixed(2))).join(",")));
  return { n: rows.length, csv: "﻿" + lines.join("\n") };
}
function toPropShop(text, fileName) {
  const nba = toPropShopNBA(text); if (nba) return nba;
  const { headers } = parseCSV(text); const lc = headers.map(h => h.toLowerCase().trim());
  if (lc.includes("market") && lc.includes("roi (%)")) return null;   // PropShop's own sim export
  const src = detectNfl(text, fileName); if (!src) return null;
  const players = parseNfl(src, text);
  const out = nflCsv(players);
  return { sport: "NFL", src, n: out.n, csv: out.csv, players };   // players: for the day's per-source merge in the background script
}
if (typeof module !== "undefined") module.exports = { toPropShop, detectSource, detectNfl, parseCSV, mergeNfl, nflCsv, mergeNba, nbaCsv };
