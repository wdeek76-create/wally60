// PropShop CSV converter — same column reading as the NBA blender's parseSource, same output as its EXPORT PS button.
// Sources handled: Tabs (Player, ID, Pos, Team, ..., Tabs Min, ..., PTS, REB, AST, 3PM, ...) and Sharpr (Player, Team, Opponent, Tip-off, Points, ..., Rebounds, ..., Assists, ..., 3PM, ...).
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
  const headers = splitLine(lines[0]);
  const rows = lines.slice(1).map(line => { const v = splitLine(line), r = {}; headers.forEach((h, i) => { r[h] = v[i] ?? ""; }); return r; }).filter(r => Object.values(r).some(x => x.trim()));
  return { headers, rows };
}
function findCol(headers, candidates) {
  const lc = headers.map(h => h.toLowerCase().trim());
  for (const c of candidates) { const i = lc.findIndex(h => h === c); if (i !== -1) return headers[i]; }
  for (const c of candidates) { const i = lc.findIndex(h => h.includes(c)); if (i !== -1) return headers[i]; }
  return null;
}
// Which source a CSV is, from its headers. null = not one we convert (left alone).
function detectSource(headers) {
  const lc = headers.map(h => h.toLowerCase().trim());
  const has = h => lc.includes(h);
  if (has("player") && has("tabs min") && has("pts") && has("reb") && has("ast")) return "TABS";
  if (has("player") && has("team") && has("tip-off") && has("points") && has("rebounds") && has("assists")) return "SHARPR";
  return null;
}
function toPropShop(text) {
  const { headers, rows } = parseCSV(text);
  const src = detectSource(headers);
  if (!src) return null;
  const C = {
    name: findCol(headers, ["player", "name"]),
    team: findCol(headers, ["team", "tm"]),
    pts: findCol(headers, ["points", "pts"]),
    reb: findCol(headers, ["rebounds", "reb"]),
    ast: findCol(headers, ["assists", "ast"]),
    threepm: findCol(headers, ["three_pointers_made", "3pm", "3pt", "threepm"]),
    min: findCol(headers, ["tabs min", "proj min", "minutes", "mins", "min"]),
  };
  const g = (r, col) => { if (!col) return null; const v = parseFloat(r[col]); return isNaN(v) ? null : v; };
  const esc = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const f2 = v => (v != null && !isNaN(v) && v >= 0) ? Number(v).toFixed(2) : "";   // a real 0 (no threes) stays 0.00
  const players = rows.filter(r => (r[C.name] || "").trim() && /[a-zA-Z]/.test(r[C.name]))
    .map(r => ({ name: r[C.name].trim(), team: C.team ? (r[C.team] || "").trim() : "", min: g(r, C.min), pts: g(r, C.pts), reb: g(r, C.reb), ast: g(r, C.ast), threepm: g(r, C.threepm) }))
    .filter(p => p.pts != null || p.reb != null || p.ast != null)        // OUT players carry no numbers
    .sort((a, b) => a.name.localeCompare(b.name));
  const lines = [PS_HEAD.join(",")].concat(players.map(p => [esc(p.name), esc(p.team), f2(p.min), f2(p.pts), f2(p.reb), f2(p.ast), f2(p.threepm)].join(",")));
  return { src, n: players.length, csv: "﻿" + lines.join("\n") };
}
if (typeof module !== "undefined") module.exports = { toPropShop, detectSource, parseCSV };
