// Exchange American Odds: on Novig and ProphetX, every price shown as a % / ¢ ("54¢", "54%", "54.5¢") or as a
// share price ("$0.54", "0.54") is shown as American odds instead (54¢ -> -117). It rewrites only the text you
// see -- the site's own numbers and buttons are untouched, and it never clicks anything. Live prices keep
// converting as they move. Alt+A flips back to the site's own prices (remembered).
// A small "AMX" pill bottom-left shows it's running and how many prices it converted (tap it to hide the pill).
(() => {
  const store = { get:k=>{ try{ return localStorage.getItem(k); }catch(e){ return null; } }, set:(k,v)=>{ try{ localStorage.setItem(k,v); }catch(e){} } };
  let off = store.get('amxOff') === '1';

  // 3-97 cents / percent (skips fees like "2%"), not part of a bigger number
  const RE_C = /(^|[^\d.])(\d{1,2}(?:\.\d{1,2})?\s?(?:¢|%|c\b))/g;
  // share prices: "$0.54", "0.54", ".54"
  const RE_S = /(^|[^\d.$])(\$?0?\.\d{2,3})(?![\d%¢.])/g;
  const ANY = /\d\s?(¢|%|c\b)|(^|[^\d])\$?0?\.\d{2}/;
  const SKIP = new Set(['SCRIPT','STYLE','NOSCRIPT','TEXTAREA','INPUT','SELECT','OPTION','CODE','PRE']);

  const american = p => {               // p = win chance 0-1
    if (!(p >= 0.03 && p <= 0.97)) return null;
    const a = p >= 0.5 ? -Math.round(p / (1 - p) * 100) : Math.round((1 - p) / p * 100);
    return a > 0 ? '+' + a : String(a);
  };
  const probOf = s => { const x = s.replace(/[\s$¢%c]/g, ''); return x.startsWith('.') || x.startsWith('0.') ? parseFloat(x) : parseFloat(x) / 100; };

  let converted = 0;
  let mine = new WeakMap();    // text node -> the text this script put there (so its own edits aren't re-converted)
  const orig = new WeakMap();  // text node -> the site's text before converting
  const nodes = new Set();     // converted nodes, to flip back with Alt+A

  function convert(node){
    const txt = node.nodeValue; if (mine.get(node) === txt) return;
    if (!ANY.test(txt)) return;
    const hits = [];
    for (const re of [RE_C, RE_S]) { re.lastIndex = 0; let m;
      while ((m = re.exec(txt))) { const start = m.index + m[1].length, end = m.index + m[0].length, am = american(probOf(m[2])); if (am) hits.push({ start, end, am }); } }
    if (!hits.length) return;
    hits.sort((a, b) => a.start - b.start);
    let out = '', last = 0;
    hits.forEach(h => { if (h.start < last) return; out += txt.slice(last, h.start) + h.am; last = h.end; });
    out += txt.slice(last);
    if (out === txt) return;
    orig.set(node, txt); nodes.add(node);
    if (off) return;
    mine.set(node, out); node.nodeValue = out; converted++;
  }

  const okText = n => { const p = n.parentElement || n.parentNode?.host; if (!p || SKIP.has(p.tagName) || p.isContentEditable) return false; return mine.get(n) !== n.nodeValue && ANY.test(n.nodeValue); };
  function scan(root){
    if (!root) return;
    if (root.nodeType === 3) { if (okText(root)) convert(root); return; }
    if (root.nodeType !== 1 && root.nodeType !== 11) return;
    if (root.nodeType === 1 && SKIP.has(root.tagName)) return;
    const list = [];
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    let n = w.currentNode;
    while (n) {
      if (n.nodeType === 3) { if (okText(n)) list.push(n); }
      else if (n.shadowRoot && !n.shadowRoot._amx) { n.shadowRoot._amx = 1; watch(n.shadowRoot); scan(n.shadowRoot); }   // prices inside web components
      n = w.nextNode();
    }
    list.forEach(convert);
    paintPill();
  }

  // live prices: when the site rewrites a price, convert the new one (batched once per frame)
  let pending = new Set(), queued = false;
  const flush = () => { queued = false; const items = [...pending]; pending.clear(); items.forEach(n => n.isConnected && scan(n)); };
  function watch(root){
    new MutationObserver(muts => {
      muts.forEach(m => {
        if (m.type === 'characterData') { if (mine.get(m.target) !== m.target.nodeValue) pending.add(m.target); }
        m.addedNodes.forEach(n => { if (n !== pill) pending.add(n); });
      });
      if (!queued && pending.size) { queued = true; requestAnimationFrame(flush); }
    }).observe(root, { childList: true, subtree: true, characterData: true });
  }

  // "AMX · 12" pill: proof it's running on this page (tap = hide it)
  const pill = document.createElement('div');
  pill.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:2147483647;padding:3px 8px;border-radius:999px;background:#111;color:#fff;font:700 11px system-ui,sans-serif;opacity:.8;cursor:pointer';
  pill.onclick = () => { pill.remove(); store.set('amxPill','0'); };
  function paintPill(){ if (store.get('amxPill') === '0' || window.top !== window) return; pill.textContent = off ? 'AMX · off (Alt+A)' : `AMX · ${converted} converted`; if (document.body && !pill.isConnected) document.body.appendChild(pill); }

  watch(document.documentElement);
  scan(document.body);
  setInterval(() => { if (!off) scan(document.body); nodes.forEach(n => { if (!n.isConnected) nodes.delete(n); }); }, 4000);

  // Alt+A: back to the site's own prices / American odds again
  document.addEventListener('keydown', e => {
    if (!(e.altKey && (e.key === 'a' || e.key === 'A' || e.code === 'KeyA'))) return;
    off = !off; store.set('amxOff', off ? '1' : '0'); e.preventDefault();
    if (off) { nodes.forEach(n => { if (n.isConnected && mine.get(n) === n.nodeValue && orig.has(n)) { const o = orig.get(n); mine.set(n, o); n.nodeValue = o; } }); }
    else { mine = new WeakMap(); scan(document.body); }
    paintPill();
  }, true);
})();
