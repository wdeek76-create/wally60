// Exchange American Odds: on Novig and ProphetX, every price shown as a % / ¢ ("54¢", "54%", "54.5¢") or as a
// share price ("$0.54", "0.54") is shown as American odds instead (54¢ -> -117). It rewrites only the text you
// see -- the site's own numbers and buttons are untouched, and it never clicks anything. Live prices keep
// converting as they move.
// The big ON / OFF switch bottom-left (or Alt+A) flips back to the site's own prices -- turn it OFF to make an
// order in %/¢, ON again after. Remembered.
// Extras: ProphetX odds include its 2% fee on winnings · hover a price for "to win $X: bet $Y" (tap "Win" to pick
// the amount) · "Fill" drops a default amount into an empty bet-slip amount box (never presses anything).
(() => {
  const store = { get:k=>{ try{ return localStorage.getItem(k); }catch(e){ return null; } }, set:(k,v)=>{ try{ localStorage.setItem(k,v); }catch(e){} } };
  let off = store.get('amxOff') === '1';

  // 3-97 cents / percent (skips fees like "2%"), not part of a bigger number
  const RE_C = /(^|[^\d.])(\d{1,2}(?:\.\d{1,2})?\s?(?:¢|%|c\b))/g;
  // share prices: "$0.54", "0.54", ".54"
  const RE_S = /(^|[^\d.$])(\$?0?\.\d{2,3})(?![\d%¢.])/g;
  const ANY = /\d\s?(¢|%|c\b)|(^|[^\d])\$?0?\.\d{2}/;
  const SKIP = new Set(['SCRIPT','STYLE','NOSCRIPT','TEXTAREA','INPUT','SELECT','OPTION','CODE','PRE']);

  // ProphetX takes 2% of what you win: on its pages the odds shown are what you actually get after the fee
  const IS_PX = /(^|\.)prophetx\.co$/i.test(location.hostname), PX_FEE = 0.02;
  const netDec = p => 1 + (1 / p - 1) * (IS_PX ? 1 - PX_FEE : 1);   // decimal odds after the fee
  const amOfDec = d => d >= 2 ? Math.round((d - 1) * 100) : -Math.round(100 / (d - 1));
  const american = p => {               // p = win chance 0-1
    if (!(p >= 0.03 && p <= 0.97)) return null;
    const a = amOfDec(netDec(p));
    return a > 0 ? '+' + a : String(a);
  };
  const probOf = s => { const x = s.replace(/[\s$¢%c]/g, ''); return x.startsWith('.') || x.startsWith('0.') ? parseFloat(x) : parseFloat(x) / 100; };

  let converted = 0;
  let mine = new WeakMap();    // text node -> the text this script put there (so its own edits aren't re-converted)
  const orig = new WeakMap();  // text node -> the site's text before converting
  const prob = new WeakMap();  // text node -> the (first) price in it, 0-1 (for the to-win helper)
  const nodes = new Set();     // converted nodes, to flip back

  function convert(node){
    const txt = node.nodeValue; if (mine.get(node) === txt) return;
    if (!ANY.test(txt)) return;
    const hits = [];
    for (const re of [RE_C, RE_S]) { re.lastIndex = 0; let m;
      while ((m = re.exec(txt))) { const start = m.index + m[1].length, end = m.index + m[0].length, p = probOf(m[2]), am = american(p); if (am) hits.push({ start, end, am, p }); } }
    if (!hits.length) return;
    hits.sort((a, b) => a.start - b.start);
    let out = '', last = 0;
    hits.forEach(h => { if (h.start < last) return; out += txt.slice(last, h.start) + h.am; last = h.end; });
    out += txt.slice(last);
    if (out === txt) return;
    orig.set(node, txt); prob.set(node, hits[0].p); nodes.add(node);
    if (off) return;
    mine.set(node, out); node.nodeValue = out; converted++;
  }

  const okText = n => { const p = n.parentElement || n.parentNode?.host; if (!p || SKIP.has(p.tagName) || p.isContentEditable) return false; if (p.closest?.('[data-amx-ui]')) return false; return mine.get(n) !== n.nodeValue && ANY.test(n.nodeValue); };
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
  }

  // live prices: when the site rewrites a price, convert the new one (batched once per frame)
  let pending = new Set(), queued = false;
  const flush = () => { queued = false; const items = [...pending]; pending.clear(); items.forEach(n => n.isConnected && scan(n)); };
  function watch(root){
    new MutationObserver(muts => {
      muts.forEach(m => {
        if (m.type === 'characterData') { if (mine.get(m.target) !== m.target.nodeValue) pending.add(m.target); }
        m.addedNodes.forEach(n => { if (!(n.nodeType === 1 && n.hasAttribute?.('data-amx-ui'))) pending.add(n); });
      });
      if (!queued && pending.size) { queued = true; requestAnimationFrame(flush); }
    }).observe(root, { childList: true, subtree: true, characterData: true });
  }

  // ── on / off ──
  const revertAll = () => nodes.forEach(n => { if (n.isConnected && mine.get(n) === n.nodeValue && orig.has(n)) { const o = orig.get(n); mine.set(n, o); n.nodeValue = o; } });
  function setOff(v){
    off = v; store.set('amxOff', off ? '1' : '0');
    if (off) revertAll(); else { mine = new WeakMap(); scan(document.body); }
    paint(); hideTip();
  }
  document.addEventListener('keydown', e => { if (e.altKey && (e.key === 'a' || e.key === 'A' || e.code === 'KeyA')) { e.preventDefault(); setOff(!off); } }, true);

  // ── bottom-left controls: [ AMX ON / OFF ]  [ Win $200 ]  [ Fill $300 ] ──
  const WINS = [0, 100, 150, 200, 300, 400], FILLS = [0, 100, 200, 300, 500];
  let winAmt = Number(store.get('amxWin') ?? 0) || 0, fillAmt = Number(store.get('amxFill') ?? 0) || 0;
  const bar = document.createElement('div'); bar.setAttribute('data-amx-ui', '1');
  bar.style.cssText = 'position:fixed;left:10px;bottom:10px;z-index:2147483647;display:flex;gap:6px;align-items:center;font:800 12px system-ui,sans-serif';
  const mk = (title, fn) => { const b = document.createElement('button'); b.type = 'button'; b.title = title; b.setAttribute('data-amx-ui', '1');
    b.style.cssText = 'border:0;border-radius:999px;padding:7px 12px;cursor:pointer;font:inherit;box-shadow:0 2px 8px rgba(0,0,0,.35)';
    b.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); fn(); }); bar.appendChild(b); return b; };
  const bOn = mk('American odds on / off (Alt+A) -- OFF to make an order in the site\'s %/¢', () => setOff(!off));
  const bWin = mk('Hover a price: how much to bet to win this amount (tap to change)', () => { winAmt = WINS[(WINS.indexOf(winAmt) + 1) % WINS.length]; store.set('amxWin', String(winAmt)); paint(); });
  const bFill = mk('Drop this amount into an empty bet-slip amount box (tap to change)', () => { fillAmt = FILLS[(FILLS.indexOf(fillAmt) + 1) % FILLS.length]; store.set('amxFill', String(fillAmt)); paint(); });
  function paint(){
    if (window.top !== window) return;
    bOn.textContent = off ? 'AMX OFF · %/¢' : `AMX ON${IS_PX ? ' · fee in' : ''}`;
    bOn.style.background = off ? '#3f3f46' : '#16a34a'; bOn.style.color = '#fff';
    bWin.textContent = winAmt ? `Win $${winAmt}` : 'Win off'; bWin.style.background = '#111'; bWin.style.color = winAmt ? '#fff' : '#9ca3af';
    bFill.textContent = fillAmt ? `Fill $${fillAmt}` : 'Fill off'; bFill.style.background = '#111'; bFill.style.color = fillAmt ? '#fff' : '#9ca3af';
    if (document.body && !bar.isConnected) document.body.appendChild(bar);
  }

  // ── hover a converted price: "-117 · to win $200: bet $235" ──
  const tip = document.createElement('div'); tip.setAttribute('data-amx-ui', '1');
  tip.style.cssText = 'position:fixed;z-index:2147483647;padding:4px 9px;border-radius:8px;background:#111;color:#fff;font:700 12px system-ui,sans-serif;pointer-events:none;box-shadow:0 2px 8px rgba(0,0,0,.4);display:none';
  function hideTip(){ tip.style.display = 'none'; }
  const usd = v => '$' + (v >= 100 ? Math.round(v) : v.toFixed(2)).toLocaleString();
  document.addEventListener('mouseover', e => {
    if (!winAmt || off) return hideTip();
    const el = e.target; if (!el || el.closest?.('[data-amx-ui]')) return;
    const tn = [...(el.childNodes || [])].find(n => n.nodeType === 3 && nodes.has(n) && mine.get(n) === n.nodeValue);
    const m = tn && /([+-]\d{3,5})/.exec(tn.nodeValue); if (!m) return hideTip();
    const p = prob.get(tn); if (!p) return hideTip();
    tip.textContent = `${m[1]} · to win ${usd(winAmt)}: bet ${usd(winAmt / (netDec(p) - 1))}${IS_PX ? ' (after 2% fee)' : ''}`;
    if (!tip.isConnected) document.body.appendChild(tip);
    const r = el.getBoundingClientRect(); tip.style.left = Math.max(4, Math.min(innerWidth - 260, r.left)) + 'px'; tip.style.top = Math.max(4, r.top - 30) + 'px'; tip.style.display = 'block';
  }, true);
  document.addEventListener('scroll', hideTip, true);

  // ── Fill: an EMPTY amount box in the bet slip gets your default amount (or the smaller max shown). Never the
  // price box, never over something you typed, never presses Place.
  const allBoxes = () => { const out = []; const walk = root => { root.querySelectorAll?.('input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"])').forEach(i => out.push(i));
      root.querySelectorAll?.('*').forEach(el => { if (el.shadowRoot) walk(el.shadowRoot); }); }; walk(document); return out; };
  const labelOf = i => { const bits = [i.placeholder, i.name, i.id, i.getAttribute('aria-label')];
    try { if (i.id) { const l = document.querySelector(`label[for="${CSS.escape(i.id)}"]`); if (l) bits.push(l.textContent); } } catch (e) {}
    const par = i.parentElement; if (par) bits.push((par.innerText || '').slice(0, 80));
    if (par && !(par.innerText || '').trim() && par.parentElement) bits.push((par.parentElement.innerText || '').slice(0, 80));
    return bits.filter(Boolean).join(' ').toLowerCase(); };
  const isPriceBox = t => /\b(price|odds|limit price|probability|chance)\b|%|¢/.test(t);
  const isAmountBox = t => /\b(amount|stake|wager|risk|bet size|size|spend|cost|quantity|contracts|shares|buy for)\b/.test(t) || /\$/.test(t);
  const maxNear = i => { let a = i.parentElement; for (let k = 0; k < 4 && a; k++, a = a.parentElement) { const m = /(?:max|available|avail\.?|up to|liquidity)[^$\d]{0,12}\$?\s?([\d,]+(?:\.\d+)?)/i.exec(a.innerText || ''); if (m) return parseFloat(m[1].replace(/,/g, '')); } return null; };
  const setVal = (el, v) => { const d = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value'); if (d?.set) d.set.call(el, v); else el.value = v;
    el.dispatchEvent(new Event('input', { bubbles: true, composed: true })); el.dispatchEvent(new Event('change', { bubbles: true, composed: true })); };
  const filled = new WeakSet();
  function tryFill(){
    if (!fillAmt) return;
    for (const i of allBoxes()) {
      if (filled.has(i) || !i.isConnected || i.disabled || i.readOnly || i.value) continue;
      if (i.type === 'search' || /search/i.test(i.placeholder || '') || i.closest?.('header,nav,[role="search"]')) continue;
      const r = i.getBoundingClientRect(); if (!r.width || !r.height) continue;
      const t = labelOf(i); if (isPriceBox(t) || !isAmountBox(t)) continue;
      filled.add(i);
      const mx = maxNear(i), amt = mx != null && mx > 0 && mx < fillAmt ? mx : fillAmt;
      setVal(i, String(amt));
    }
  }
  document.addEventListener('click', e => { if (e.target.closest?.('[data-amx-ui]')) return; [150, 500, 1200].forEach(ms => setTimeout(tryFill, ms)); }, true);
  new MutationObserver(() => { clearTimeout(tryFill._t); tryFill._t = setTimeout(tryFill, 250); }).observe(document.documentElement, { childList: true, subtree: true });

  watch(document.documentElement);
  scan(document.body);
  paint();
  setInterval(() => { if (!off) scan(document.body); nodes.forEach(n => { if (!n.isConnected) nodes.delete(n); }); if (!bar.isConnected) paint(); }, 4000);
})();
