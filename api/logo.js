// Image proxy for the NBA blender's card pictures: the card is drawn onto a canvas, and a browser only lets a page read another site's image pixels
// when that site allows it (CORS). This fetches the logo server-side and hands it back with the header that allows it.
// Only https image URLs on public hosts, max 400 KB.
module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  try {
    const raw = String((req.query && req.query.url) || "");
    const u = new URL(raw);
    const h = u.hostname.toLowerCase();
    if (u.protocol !== "https:" || h === "localhost" || /^\d{1,3}(\.\d{1,3}){3}$/.test(h) || h.includes(":") || /\.(local|internal)$/.test(h)) { res.status(400).json({ error: "only https image URLs on public hosts" }); return; }
    const r = await fetch(u.toString(), { headers: { "User-Agent": "Mozilla/5.0 (compatible; NBA-blender-logo)" }, redirect: "follow" });
    if (!r.ok) { res.status(502).json({ error: "logo host answered " + r.status }); return; }
    const type = String(r.headers.get("content-type") || "");
    if (!/^image\//i.test(type)) { res.status(415).json({ error: "not an image (" + type.slice(0, 40) + ")" }); return; }
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > 400 * 1024) { res.status(413).json({ error: "image too large" }); return; }
    res.setHeader("Content-Type", type);
    res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=86400");
    res.status(200).send(buf);
  } catch (e) { res.status(400).json({ error: String(e && e.message || e).slice(0, 120) }); }
};
