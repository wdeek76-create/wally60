// OpticOdds proxy — runs on Vercel's servers, no CORS problems.
// Your API key lives here on the server, never in the browser.
// Also proxies logo/headshot images (as data URIs) so cards can render them.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const body = req.body || {};

  // ---- image proxy: { image_url } -> { data_uri } ----
  if (body.image_url) {
    let u;
    try { u = new URL(body.image_url); } catch { return res.status(400).json({ error: 'bad image_url' }); }
    const okHost = /(^|\.)(opticodds\.com|espncdn\.com)$/i.test(u.hostname);
    if (!okHost) return res.status(400).json({ error: 'host not allowed' });
    try {
      const r = await fetch(u.toString());
      if (!r.ok) return res.status(r.status).json({ error: `image ${r.status}` });
      const type = r.headers.get('content-type') || 'image/png';
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length > 3 * 1024 * 1024) return res.status(413).json({ error: 'image too large' });
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.status(200).json({ data_uri: `data:${type};base64,${buf.toString('base64')}` });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  // ---- OpticOdds API proxy ----
  const apiKey = process.env.OPTICODDS_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'OPTICODDS_API_KEY not set in Vercel env vars' });

  const { endpoint, params } = body;
  if (!endpoint || !endpoint.startsWith('/')) return res.status(400).json({ error: 'Missing endpoint' });

  try {
    const url = new URL(`https://api.opticodds.com/api/v3${endpoint}`);
    for (const [k, v] of Object.entries(params || {})) {
      if (Array.isArray(v)) v.forEach(x => url.searchParams.append(k, x));
      else if (v !== null && v !== undefined) url.searchParams.append(k, v);
    }
    const r = await fetch(url.toString(), { headers: { 'X-Api-Key': apiKey } });
    const text = await r.text();
    if (!r.ok) return res.status(r.status).json({ error: `OpticOdds ${r.status}`, body: text.slice(0, 500) });
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).send(text);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
