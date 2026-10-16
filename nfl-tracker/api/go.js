// Deep-link redirector.
//
// Why this exists: some books (Novig, ProphetX, etc.) only give OpticOdds a bare custom
// URL scheme for their app (e.g. "novigapp://events/123"), with no https "universal link"
// equivalent. Chat apps (Discord, iMessage) will only render/tap a masked markdown link
// for a real https:// URL — a custom scheme just shows up as broken literal text. And even
// if it did render, the sender's device isn't the one opening it, so guessing ios-vs-android
// at share time is wrong half the time anyway.
//
// This endpoint gives you a real https:// URL to put in the pasted text (renders fine,
// taps fine, no broken markdown). When it's opened, it looks at the *visiting* device's
// user agent, picks the right app-scheme link for that device, tries to hand off to the
// native app, and falls back to the book's website after a short delay if that fails
// (app not installed, etc).
//
// Query params:
//   i = ios custom-scheme deep link (URL-encoded)
//   a = android custom-scheme deep link (URL-encoded)
//   w = https website fallback (URL-encoded, optional)
//   b = book name, for the on-screen message (optional)

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Only hand off to schemes we recognize — keeps this from being usable as a generic
// open redirector for anything else.
const ALLOWED_SCHEMES = [
  'novigapp', 'prophetx', 'draftkings', 'fanduel', 'betmgm', 'caesarssportsbook',
  'espnbet', 'fanaticsbet', 'fanatics', 'bet365', 'pointsbet', 'betrivers', 'hardrock',
  'onyxodds', 'bet105', 'betonline', 'bovada', 'mybookieag', 'kalshi'
];

function safeScheme(raw) {
  if (!raw) return null;
  let v;
  try { v = decodeURIComponent(raw); } catch { return null; }
  const m = /^([a-z][a-z0-9+.-]*):\/\//i.exec(v);
  if (!m) return null;
  const scheme = m[1].toLowerCase();
  if (scheme === 'http' || scheme === 'https') return null; // this endpoint is for app schemes only
  if (!ALLOWED_SCHEMES.includes(scheme)) return null;
  return v;
}

function safeHttpsUrl(raw) {
  if (!raw) return null;
  let v;
  try { v = decodeURIComponent(raw); } catch { return null; }
  return /^https:\/\//i.test(v) ? v : null;
}

export default function handler(req, res) {
  const { i, a, w, b } = req.query || {};
  const iosLink = safeScheme(i);
  const androidLink = safeScheme(a);
  const fallback = safeHttpsUrl(w) || '';
  const book = escapeHtml((b || 'the book').toString().slice(0, 60));

  if (!iosLink && !androidLink) return res.status(400).send('Missing or invalid deep link');

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).send(`<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Opening ${book}…</title>
<style>
  html,body{margin:0;height:100%;background:#0b0b0f;color:#fff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
  .wrap{display:flex;align-items:center;justify-content:center;height:100%;text-align:center;padding:24px;box-sizing:border-box}
  a.fb{color:#27c071;text-decoration:none;font-weight:700;display:none}
  #msg{font-size:15px;opacity:.9}
</style></head>
<body><div class="wrap"><div>
  <div id="msg">Opening ${book}…</div>
  <div style="margin-top:14px"><a id="fb" class="fb"></a></div>
</div></div>
<script>
  var iosLink = ${JSON.stringify(iosLink || '')};
  var androidLink = ${JSON.stringify(androidLink || '')};
  var fallback = ${JSON.stringify(fallback)};
  var book = ${JSON.stringify(book)};
  var ua = navigator.userAgent || '';
  var isAndroid = /Android/i.test(ua);
  var target = isAndroid ? (androidLink || iosLink) : (iosLink || androidLink);
  if (target) { try { window.location.replace(target); } catch (e) {} }
  setTimeout(function () {
    var msg = document.getElementById('msg');
    var fb = document.getElementById('fb');
    if (fallback) {
      msg.textContent = 'Still here? Tap below.';
      fb.href = fallback; fb.textContent = 'Open ' + book + ' website'; fb.style.display = 'inline';
    } else {
      msg.textContent = "Couldn't open " + book + " automatically — make sure the app is installed.";
    }
  }, 1200);
</script>
</body></html>`);
}
