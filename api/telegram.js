// Telegram relay for the NHL blender's Send to SALT (Vercel serverless function).
//
// The page posts straight to api.telegram.org first; if the browser can't reach it (blocked network, ad/tracker
// blocker, CORS), it posts the same thing here and this calls Telegram server-side:
//   POST /api/telegram   form or JSON: { token, method: "sendMessage" | "getUpdates", chat_id, text, parse_mode }
// The bot token comes from the page (saved only in the user's browser); nothing is stored here.
const ALLOWED = new Set(["sendMessage", "getUpdates"]);

async function readBody(req) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) return req.body;
  const raw = typeof req.body === "string" ? req.body : await new Promise(res => { let d = ""; req.on("data", c => { d += c; }); req.on("end", () => res(d)); });
  try { return JSON.parse(raw); } catch (e) {}
  return Object.fromEntries(new URLSearchParams(raw));
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ ok: false, description: "POST only" }); return; }

  const b = await readBody(req);
  const token = String(b.token || "").trim(), method = String(b.method || "sendMessage");
  if (!/^\d+:[\w-]{20,}$/.test(token)) { res.status(400).json({ ok: false, description: "missing or malformed bot token" }); return; }
  if (!ALLOWED.has(method)) { res.status(400).json({ ok: false, description: "method not allowed" }); return; }

  const params = new URLSearchParams();
  ["chat_id", "text", "parse_mode", "disable_web_page_preview", "limit"].forEach(k => { if (b[k] != null && b[k] !== "") params.append(k, String(b[k])); });
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: "POST", body: params });
    const j = await r.json();
    res.status(200).json(j);   // pass Telegram's own answer through ({ ok, description, result })
  } catch (e) {
    res.status(502).json({ ok: false, description: "relay couldn't reach Telegram: " + (e && e.message || e) });
  }
};
