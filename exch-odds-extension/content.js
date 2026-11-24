// Exchange American Odds: on Novig and ProphetX, every price shown as a % / ¢ ("54¢", "54%", "54.5¢") or as a
// share price ("$0.54", "0.54") is shown as American odds instead (54¢ -> -117). It rewrites only the text you
// see -- the site's own numbers and buttons are untouched, and it never clicks anything. Live prices keep
// converting as they move.
// The big ON / OFF switch bottom-left (or Alt+A) flips back to the site's own prices -- turn it OFF to make an
// order in %/¢, ON again after. Remembered.
// Extras: ProphetX odds include its 2% fee on winnings · a yellow label under the box you type your $ in shows what it wins (tap "Win" to pick
// the amount) · "Fill": click into the amount box, tap the green chip (or Alt+F) and your amount goes in.
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
  const bWin = mk('Shown under the box you type your $ in: how much to bet to win this amount (tap to change)', () => { winAmt = WINS[(WINS.indexOf(winAmt) + 1) % WINS.length]; store.set('amxWin', String(winAmt)); paint(); });
  const bFill = mk('Click into the amount box, then tap the green Fill chip (or Alt+F) -- tap here to change the amount', () => { fillAmt = FILLS[(FILLS.indexOf(fillAmt) + 1) % FILLS.length]; store.set('amxFill', String(fillAmt)); paint(); });
  let enterOn = store.get('amxEnter') !== '0';
  const bEnter = mk('Enter places the order (presses the slip\'s Place / Submit button) -- tap to turn on / off', () => { enterOn = !enterOn; store.set('amxEnter', enterOn ? '1' : '0'); paint(); });
  function paint(){
    if (window.top !== window) return;
    bOn.textContent = off ? 'AMX OFF · %/¢' : `AMX ON${IS_PX ? ' · fee in' : ''}`;
    bOn.style.background = off ? '#3f3f46' : '#16a34a'; bOn.style.color = '#fff';
    bWin.textContent = winAmt ? `Win $${winAmt}` : 'Win off'; bWin.style.background = '#111'; bWin.style.color = winAmt ? '#fff' : '#9ca3af';
    bEnter.textContent = enterOn ? '⏎ Enter bets' : '⏎ off'; bEnter.style.background = enterOn ? '#1d4ed8' : '#111'; bEnter.style.color = enterOn ? '#fff' : '#9ca3af';
    bFill.textContent = fillAmt ? `Fill $${fillAmt}` : 'Fill off'; bFill.style.background = '#111'; bFill.style.color = fillAmt ? '#fff' : '#9ca3af';
    if (document.body && !bar.isConnected) document.body.appendChild(bar);
  }

  function hideTip(){ /* (hover helper removed -- see the slip label) */ }
  const usd = v => '$' + (v >= 100 ? Math.round(v) : v.toFixed(2)).toLocaleString();

  // ── Fill: click into the amount box -> a "Fill $300" chip pops up next to it; tap it (or Alt+F) and the amount
  // goes in. You pick the box, so it works whatever the site calls it. Never presses Place.
  const setVal = (el, v) => {
    if (el.isContentEditable) { el.focus(); document.execCommand('selectAll', false); document.execCommand('insertText', false, v); return; }
    el.focus(); try { el.select?.(); } catch (e) {}
    // typing it in like a person first (works with sites that ignore programmatic values), then the React-safe setter
    let ok = false; try { ok = document.execCommand('insertText', false, v); } catch (e) {}
    if (!ok || el.value !== v) { const d = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value'); if (d?.set) d.set.call(el, v); else el.value = v;
      el.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, inputType: 'insertText', data: v })); }
    el.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  };
  const isBox = el => !!el && (el.isContentEditable || el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && !/^(hidden|checkbox|radio|button|submit|range|color|file|search)$/i.test(el.type || '')));
  const deep = () => { let a = document.activeElement; while (a?.shadowRoot?.activeElement) a = a.shadowRoot.activeElement; return a; };
  const chip = document.createElement('button'); chip.type = 'button'; chip.setAttribute('data-amx-ui', '1');
  chip.style.cssText = 'position:fixed;z-index:2147483647;border:0;border-radius:999px;padding:5px 11px;background:#16a34a;color:#fff;font:800 12px system-ui,sans-serif;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.4);display:none';
  let chipFor = null;
  const hideChip = () => { chip.style.display = 'none'; chipFor = null; };
  const showChip = el => { if (!fillAmt || !isBox(el) || /search/i.test(el.placeholder || '') || el.closest?.('header,nav,[role="search"]')) return hideChip();
    chipFor = el; chip.textContent = `Fill $${fillAmt}`; if (!chip.isConnected) document.body.appendChild(chip);
    const r = el.getBoundingClientRect(); chip.style.display = 'block';
    chip.style.left = Math.min(innerWidth - chip.offsetWidth - 4, r.right + 6) + 'px'; chip.style.top = Math.max(4, r.top + r.height / 2 - 13) + 'px';
    if (r.right + 6 + chip.offsetWidth > innerWidth) { chip.style.left = Math.max(4, r.left) + 'px'; chip.style.top = Math.max(4, r.top - 32) + 'px'; } };
  const doFill = el => { if (!el || !fillAmt) return; setVal(el, String(fillAmt)); hideChip(); setTimeout(() => typeof paintLab === 'function' && paintLab(), 50); };
  chip.addEventListener('mousedown', e => e.preventDefault());   // keep the cursor in the box
  chip.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); doFill(chipFor); });
  document.addEventListener('focusin', e => { const p = e.composedPath ? e.composedPath()[0] : e.target; if (p?.closest?.('[data-amx-ui]')) return; showChip(isBox(p) ? p : deep()); }, true);
  document.addEventListener('focusout', () => setTimeout(() => { const a = deep(); if (a !== chipFor && document.activeElement !== chip) hideChip(); }, 150), true);
  document.addEventListener('keydown', e => { if (e.altKey && (e.key === 'f' || e.key === 'F' || e.code === 'KeyF')) { const a = deep(); if (isBox(a) && fillAmt) { e.preventDefault(); doFill(a); } } }, true);
  window.addEventListener('scroll', () => { if (chipFor) showChip(chipFor); }, true);

  // ── Slip label, right under the box you're typing your $ in (bright, can't miss it):
  //    "$300 wins $256 at -117 · to win $200: bet $235"   (ProphetX: after its 2% fee)
  // The price comes from the slip around the box: a price shown there, or the price box's value.
  const lab = document.createElement('div'); lab.setAttribute('data-amx-ui', '1');
  lab.style.cssText = 'position:fixed;z-index:2147483647;padding:5px 11px;border-radius:9px;background:#facc15;color:#111;font:800 13px system-ui,sans-serif;pointer-events:none;box-shadow:0 3px 10px rgba(0,0,0,.45);display:none;white-space:nowrap';
  let labFor = null;
  const upOne = x => x.parentElement || (x.getRootNode?.() instanceof ShadowRoot ? x.getRootNode().host : null);
  const priceIn = v => { const t = String(v || '').replace(/[^\d.]/g, ''); if (!t || t === '.') return null; const n = parseFloat(t); const p = n < 1 ? n : n / 100; return p >= 0.02 && p <= 0.98 ? p : null; };
  function slipPrice(box){
    for (let a = upOne(box), k = 0; a && a !== document.body && a !== document.documentElement && k < 8; k++, a = upOne(a)) {
      for (const n of nodes) if (n.isConnected && a.contains(n) && prob.get(n)) return prob.get(n);   // a price shown in the slip
      const other = [...(a.querySelectorAll?.('input') || [])].find(i => i !== box && isBox(i) && priceIn(i.value) != null && /[%¢]|price|odds/i.test((i.parentElement?.innerText || '') + ' ' + (i.placeholder || '') + ' ' + (i.name || '')));
      if (other) return priceIn(other.value);   // you're making it: the price box's value
    }
    return null;
  }
  function paintLab(){
    const el = labFor; if (!el || !el.isConnected) { lab.style.display = 'none'; return; }
    const p = slipPrice(el); if (p == null) { lab.style.display = 'none'; return; }
    const d = netDec(p), a = amOfDec(d), am = a > 0 ? '+' + a : String(a);
    const stake = parseFloat(String(el.isContentEditable ? el.textContent : el.value).replace(/[^\d.]/g, ''));
    const parts = [];
    if (stake > 0) parts.push(`${usd(stake)} wins ${usd(stake * (d - 1))} at ${am}`); else parts.push(am);
    if (winAmt) parts.push(`to win ${usd(winAmt)}: bet ${usd(winAmt / (d - 1))}`);
    lab.textContent = parts.join('  ·  ') + (IS_PX ? '  (fee in)' : '');
    if (!lab.isConnected) document.body.appendChild(lab);
    const r = el.getBoundingClientRect(); lab.style.display = 'block';
    lab.style.left = Math.max(4, Math.min(innerWidth - lab.offsetWidth - 4, r.left)) + 'px';
    lab.style.top = (r.bottom + 6 + lab.offsetHeight < innerHeight ? r.bottom + 6 : Math.max(4, r.top - lab.offsetHeight - 6)) + 'px';
  }
  document.addEventListener('focusin', e => { const t = e.composedPath ? e.composedPath()[0] : e.target; if (t?.closest?.('[data-amx-ui]')) return; if (isBox(t) && !t.closest?.('header,nav,[role="search"]') && t.type !== 'search') { labFor = t; paintLab(); } }, true);
  ['input', 'keyup'].forEach(ev => document.addEventListener(ev, () => { if (labFor) requestAnimationFrame(paintLab); }, true));
  document.addEventListener('focusout', () => setTimeout(() => { const a = deep(); if (a !== labFor && document.activeElement !== chip) { labFor = null; lab.style.display = 'none'; } }, 150), true);
  window.addEventListener('scroll', () => { if (labFor) paintLab(); }, true);
  setInterval(() => { if (labFor) paintLab(); }, 500);   // live price changes / the site re-drawing the slip

  // ── Enter = press the slip's Place / Submit button (the one next to where you're typing). Same button you'd click;
  // once per 2 seconds max. Never picks a bet or a price -- only presses what's already there.
  const PLACE_STRONG = /^(place|submit|confirm|post order|place order|place bet|review order)\b/i;
  const PLACE_NEAR = /^(place|submit|confirm|post|buy|sell|take|make|bet|review)\b/i;   // only counted inside the slip you're in
  const NO = /(remove|clear|cancel|share|log ?in|deposit|withdraw|close|back)/i;
  const lbl = el => (el.innerText || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim();
  const usable = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !el.disabled && el.getAttribute('aria-disabled') !== 'true' && getComputedStyle(el).visibility !== 'hidden' && !el.closest('[data-amx-ui]'); };
  const btnsIn = root => [...(root.querySelectorAll?.('button,[role="button"],input[type="submit"]') || [])].filter(usable);
  function findPlaceBtn(){
    // 1) the closest block around the box you're in that has an order button
    let a = deep(); const up = x => x.parentElement || (x.getRootNode?.() instanceof ShadowRoot ? x.getRootNode().host : null);
    if (!isBox(a)) a = null;   // only when your cursor is in a box (the slip you're filling in)
    for (let k = 0; a && a !== document.body && a !== document.documentElement && k < 10; k++, a = up(a)) { const b = btnsIn(a).find(el => PLACE_NEAR.test(lbl(el)) && !NO.test(lbl(el))); if (b) return b; }
    // 2) anywhere on the page: only an unmistakable Place / Submit / Confirm
    return btnsIn(document).find(el => PLACE_STRONG.test(lbl(el)) && !NO.test(lbl(el))) || null;
  }
  let lastEnter = 0;
  document.addEventListener('keydown', e => {
    if (!enterOn || e.key !== 'Enter' || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    const now = Date.now(); if (now - lastEnter < 2000) return;
    const b = findPlaceBtn(); if (!b) return;
    lastEnter = now; e.preventDefault(); e.stopPropagation(); b.click();
    const t = lbl(b).slice(0, 36); bEnter.textContent = '⏎ ' + t; setTimeout(paint, 2500);
  }, true);

  watch(document.documentElement);
  scan(document.body);
  paint();
  setInterval(() => { if (!off) scan(document.body); nodes.forEach(n => { if (!n.isConnected) nodes.delete(n); }); if (!bar.isConnected) paint(); }, 4000);
})();
