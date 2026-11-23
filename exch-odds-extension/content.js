// Exchange American Odds: on Novig and ProphetX, every price shown as a % / ¢ ("54¢", "54%", "54.5¢") or as a
// share price ("$0.54", "0.54") is shown as American odds instead (54¢ -> -117). It rewrites only the text you
// see -- the site's own numbers and buttons are untouched, and it never clicks anything. Live prices keep
// converting as they move. Alt+A flips back to the site's own prices (remembered).
// A small "AMX" pill bottom-left shows it's running and how many prices it converted (tap it to hide the pill).
(() => {
  const store = { get:k=>{ try{ return localStorage.getItem(k); }catch(e){ return null; } }, set:(k,v)=>{ try{ localStorage.setItem(k,v); }catch(e){} } };
  let off = store.get('amxOff') === '1';
  let paused = false, pauseT = null;   // paused while you Make an order (see below)

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
  const decOfAm = a => { const n = Number(a); return n > 0 ? 1 + n / 100 : 1 + 100 / -n; };
  const probOf = s => { const x = s.replace(/[\s$¢%c]/g, ''); return x.startsWith('.') || x.startsWith('0.') ? parseFloat(x) : parseFloat(x) / 100; };

  let converted = 0;
  let mine = new WeakMap();    // text node -> the text this script put there (so its own edits aren't re-converted)
  const orig = new WeakMap();  // text node -> the site's text before converting
  const nodes = new Set();     // converted nodes, to flip back with Alt+A

  function convert(node){
    const txt = node.nodeValue; if (mine.get(node) === txt || inEdit(node)) return;
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
    if (off || paused) return;
    mine.set(node, out); node.nodeValue = out; converted++;
  }

  // only the box you type the price in stays as the site shows it: text inside an editable box (contenteditable,
  // role=textbox / spinbutton, whatever has focus) or sitting right inside the same wrapper as an <input>
  // (the ¢ / % next to the number). Everything else -- the order book, the ticket's other numbers -- converts.
  const BOX = '[contenteditable=""],[contenteditable="true"],[role="textbox"],[role="spinbutton"],[role="combobox"],[inputmode]';
  const DIRECT_INPUT = ':scope > input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]), :scope > textarea';
  const inOrder = el => {
    try { if (el.closest(BOX)) return true; } catch (e) {}
    const f = document.activeElement; if (f && f !== document.body && f.contains?.(el)) return true;
    for (let a = el, i = 0; a && i < 2; i++, a = a.parentElement) { try { if (a.querySelector(DIRECT_INPUT)) return true; } catch (e) {} }
    return false; };
  // While you're typing in a box (Make an order, a price, a size): the whole form around it is hands-off --
  // the site re-draws the price as you type (12 -> "12%"), and converting that mid-typing garbled it.
  let editZone = null;
  const isTyping = el => !!el && (el.isContentEditable || (el.tagName === 'INPUT' && !/^(hidden|checkbox|radio|button|submit|range|color|file)$/i.test(el.type || '')) || el.tagName === 'TEXTAREA' || /^(textbox|spinbutton)$/i.test(el.getAttribute?.('role') || ''));
  const zoneOf = el => { let z = el; try { const c = el.closest('form,[role="dialog"],[aria-modal="true"]'); if (c) return c; } catch (e) {}
    const up = x => x.parentElement || (x.getRootNode?.() instanceof ShadowRoot ? x.getRootNode().host : null);   // step out of web components
    for (let i = 0; i < 6 && up(z) && up(z) !== document.body; i++) z = up(z); return z; };
  const inEdit = el => { if (!editZone) return false; for (let n = el; n; n = n.parentNode || n.host) if (n === editZone) return true; return false; };
  const realTarget = e => { const p = e.composedPath ? e.composedPath() : []; return (p[0] && p[0].nodeType === 1 ? p[0] : e.target); };   // inside web components too
  const startEdit = t => { if (!t || t === document.body || t === document.documentElement || t.closest?.('header,nav,[role="search"]')) return;
    // v1.9: while you type anywhere, the WHOLE page goes back to the site's own %/¢ (simple + reliable)
    if (editZone) return; editZone = document.documentElement; revertAll(); paintPill(); };
  const endEdit = () => { if (!editZone) return; editZone = null; if (!off) { mine = new WeakMap(); scan(document.body); } paintPill(); };
  document.addEventListener('focusin', e => { const t = realTarget(e); if (isTyping(t)) startEdit(t); }, true);
  // a price box the site built itself (not a real input): typing a number / . / backspace into it counts too
  document.addEventListener('keydown', e => { if (e.altKey || e.ctrlKey || e.metaKey) return; if (/^[0-9.,+-]$|^Backspace$|^Delete$/.test(e.key)) startEdit(realTarget(e)); }, true);


  document.addEventListener('beforeinput', e => startEdit(realTarget(e)), true);
  // clicking anywhere outside the form you were typing in: back to American odds there
  document.addEventListener('pointerdown', e => { if (!editZone) return; const t = realTarget(e); if (isTyping(t)) return; setTimeout(() => { let a = document.activeElement; while (a?.shadowRoot?.activeElement) a = a.shadowRoot.activeElement; if (!isTyping(a)) endEdit(); }, 300); }, true);
  document.addEventListener('focusout', e => { const t = realTarget(e); if (!isTyping(t)) return;
    setTimeout(() => { let a = document.activeElement; while (a?.shadowRoot?.activeElement) a = a.shadowRoot.activeElement; if (isTyping(a)) return; endEdit(); }, 300); }, true);
  const okText = n => { if (inEdit(n)) return false; const p = n.parentElement || n.parentNode?.host; if (!p || SKIP.has(p.tagName) || p.isContentEditable) return false; if (mine.get(n) !== n.nodeValue && ANY.test(n.nodeValue) && inOrder(p)) return false; return mine.get(n) !== n.nodeValue && ANY.test(n.nodeValue); };
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
  // to-win helper: tap the pill to cycle $100 / $150 / $200 / $300 / $400 / off (remembered); Shift+tap hides the pill
  const WINS = [100, 150, 200, 300, 400, 0];
  let winAmt = Number(store.get('amxWin') ?? 0) || 0;
  pill.onclick = e => { if (e.shiftKey) { pill.remove(); store.set('amxPill','0'); return; }
    winAmt = WINS[(WINS.indexOf(winAmt) + 1) % WINS.length]; store.set('amxWin', String(winAmt)); paintPill(); hideTip(); paintBox(); };
  pill.title = 'Tap: to-win amount ($100 / $150 / $200 / $300 / $400 / off) · Shift+tap: hide · Alt+A: on/off';
  // hover a converted price -> "To win $200: bet $234"
  const tip = document.createElement('div');
  tip.style.cssText = 'position:fixed;z-index:2147483647;padding:4px 9px;border-radius:8px;background:#111;color:#fff;font:700 12px system-ui,sans-serif;pointer-events:none;box-shadow:0 2px 8px rgba(0,0,0,.4);display:none';
  const hideTip = () => { tip.style.display = 'none'; };
  const usd = v => '$' + (v >= 100 ? Math.round(v) : v.toFixed(2)).toLocaleString();
  document.addEventListener('mouseover', e => {
    if (!winAmt || off || editZone) return hideTip();
    const el = e.target; if (!el || el === pill || el === tip) return;
    const tn = [...(el.childNodes || [])].find(n => n.nodeType === 3 && nodes.has(n) && mine.get(n) === n.nodeValue);
    const m = tn && /([+-]\d{3,5})/.exec(tn.nodeValue); if (!m) return hideTip();
    const o = orig.get(tn), pm = o && /(\d{1,2}(?:\.\d{1,2})?)\s?(?:¢|%|c\b)|\$?(0?\.\d{2,3})/.exec(o), pr = pm ? (pm[1] ? parseFloat(pm[1]) / 100 : parseFloat(pm[2])) : null;
    const risk = winAmt / ((pr ? netDec(pr) : decOfAm(m[1])) - 1);   // the exact price, same as the box helper
    tip.textContent = `${m[1]} · to win ${usd(winAmt)}: bet ${usd(risk)}${IS_PX ? ' (after 2% fee)' : ''}`;
    if (!tip.isConnected) document.body.appendChild(tip);
    const r = el.getBoundingClientRect(); tip.style.left = Math.max(4, Math.min(innerWidth - 240, r.left)) + 'px'; tip.style.top = Math.max(4, r.top - 30) + 'px'; tip.style.display = 'block';
  }, true);
  document.addEventListener('scroll', hideTip, true);

  // the price you're typing / making: live "54 -> -117 · to win $200: bet $234" right above the box (PX: after the fee)
  const boxTip = document.createElement('div');
  boxTip.style.cssText = 'position:fixed;z-index:2147483647;padding:4px 10px;border-radius:8px;background:#111;color:#fff;font:800 13px system-ui,sans-serif;pointer-events:none;box-shadow:0 2px 8px rgba(0,0,0,.45);display:none;white-space:nowrap';
  let boxEl = null;
  const boxVal = el => String(el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' ? el.value : (el.textContent || '')).trim();
  const priceOf = raw => { const t = raw.replace(/[^\d.]/g, ''); if (!t || t === '.') return null; const v = parseFloat(t); if (!isFinite(v)) return null;
    const p = v < 1 ? v : v / 100; return p >= 0.01 && p <= 0.99 ? p : null; };
  function paintBox(){
    const el = boxEl; if (!el || !el.isConnected || off) { boxTip.style.display = 'none'; return; }
    const p = priceOf(boxVal(el)); if (p == null) { boxTip.style.display = 'none'; return; }
    const d = netDec(p), a = amOfDec(d), am = a > 0 ? '+' + a : String(a);
    boxTip.textContent = am + (winAmt ? ' · to win $' + winAmt + ': bet ' + usd(winAmt / (d - 1)) : '') + (IS_PX ? ' · 2% fee in' : '');
    if (!boxTip.isConnected) document.body.appendChild(boxTip);
    const r = el.getBoundingClientRect(); boxTip.style.display = 'block';
    boxTip.style.left = Math.max(4, Math.min(innerWidth - boxTip.offsetWidth - 4, r.left)) + 'px';
    boxTip.style.top = (r.top > 34 ? r.top - 30 : r.bottom + 6) + 'px';
  }
  const boxFrom = e => { const t = realTarget(e); return isTyping(t) ? t : null; };
  document.addEventListener('focusin', e => { const t = boxFrom(e); if (t) { boxEl = t; paintBox(); } }, true);
  ['input', 'keyup'].forEach(ev => document.addEventListener(ev, e => { const t = boxFrom(e) || (boxEl && boxEl.isConnected ? boxEl : null); if (t) { boxEl = t; requestAnimationFrame(paintBox); } }, true));
  document.addEventListener('focusout', e => { const t = boxFrom(e); if (t && t === boxEl) setTimeout(() => { let a = document.activeElement; while (a?.shadowRoot?.activeElement) a = a.shadowRoot.activeElement; if (a !== boxEl && (!boxEl || priceOf(boxVal(boxEl)) == null)) { boxEl = null; boxTip.style.display = 'none'; } }, 200); }, true);
  window.addEventListener('scroll', () => boxEl && paintBox(), true);

  // ── Fill: when the bet slip opens with an EMPTY amount box, type your default amount in (never presses Place).
  // Second pill: tap cycles off / $100 / $200 / $300 / $500 (remembered). If the slip shows a max / available
  // amount next to the box that's smaller, that's what goes in instead.
  const FILLS = [0, 100, 200, 300, 500];
  let fillAmt = Number(store.get('amxFill') ?? 0) || 0;
  const fillPill = document.createElement('div');
  fillPill.style.cssText = 'position:fixed;left:8px;bottom:34px;z-index:2147483647;padding:3px 8px;border-radius:999px;background:#111;color:#fff;font:700 11px system-ui,sans-serif;opacity:.8;cursor:pointer';
  fillPill.title = 'Tap: amount to drop into an empty bet slip (off / $100 / $200 / $300 / $500)';
  const paintFill = () => { if (store.get('amxPill') === '0' || window.top !== window) return; fillPill.textContent = fillAmt ? `Fill $${fillAmt}` : 'Fill off'; if (document.body && !fillPill.isConnected) document.body.appendChild(fillPill); };
  fillPill.onclick = () => { fillAmt = FILLS[(FILLS.indexOf(fillAmt) + 1) % FILLS.length]; store.set('amxFill', String(fillAmt)); paintFill(); };
  setTimeout(paintFill, 0);
  const labelOf = i => { const bits = [i.placeholder, i.name, i.id, i.getAttribute('aria-label')];
    try { if (i.id) { const l = document.querySelector(`label[for="${CSS.escape(i.id)}"]`); if (l) bits.push(l.textContent); } } catch (e) {}
    // just the box's own block: its parent's text (the label + unit next to it), not the whole ticket
    const par = i.parentElement; if (par) bits.push((par.innerText || '').slice(0, 80));
    if (par && !(par.innerText || '').trim() && par.parentElement) bits.push((par.parentElement.innerText || '').slice(0, 80));
    return bits.filter(Boolean).join(' ').toLowerCase(); };
  const isPriceBox = t => /\b(price|odds|limit price|probability|chance)\b|%|¢/.test(t);
  const isAmountBox = t => /\b(amount|stake|wager|risk|bet size|size|spend|cost|quantity|contracts|shares|buy for|\$)/.test(t) || /\$/.test(t);
  const maxNear = i => { let a = i.parentElement; for (let k = 0; k < 4 && a; k++, a = a.parentElement) { const m = /(?:max|available|avail\.?|up to|liquidity)[^$\d]{0,12}\$?\s?([\d,]+(?:\.\d+)?)/i.exec(a.innerText || ''); if (m) return parseFloat(m[1].replace(/,/g, '')); } return null; };
  const filled = new WeakSet();
  function tryFill(){
    if (!fillAmt || off) return;
    for (const i of allBoxes()) {
      if (filled.has(i) || !i.isConnected || i.disabled || i.readOnly || i.value) continue;
      if (i.type === 'search' || /search/i.test(i.placeholder || '') || i.closest?.('header,nav,[role="search"]')) continue;
      const r = i.getBoundingClientRect(); if (!r.width || !r.height) continue;
      const t = labelOf(i); if (isPriceBox(t) || !isAmountBox(t)) continue;
      filled.add(i);
      const mx = maxNear(i), amt = mx != null && mx > 0 && mx < fillAmt ? mx : fillAmt;
      setVal(i, String(amt)); hint(i, `Filled $${amt}${amt < fillAmt ? ' (max available)' : ''}`);
    }
  }
  const setVal = (el, v) => { const d = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value'); if (d?.set) d.set.call(el, v); else el.value = v;
    el.dispatchEvent(new Event('input', { bubbles: true, composed: true })); el.dispatchEvent(new Event('change', { bubbles: true, composed: true })); };
  let hintEl = null;
  const hint = (el, t) => { try { hintEl?.remove(); const r = el.getBoundingClientRect(); hintEl = document.createElement('div'); hintEl.textContent = t;
    hintEl.style.cssText = `position:fixed;left:${Math.max(4, r.left)}px;top:${Math.max(4, r.top - 24)}px;z-index:2147483647;padding:2px 8px;border-radius:999px;background:#14532d;color:#fff;font:700 12px system-ui,sans-serif;pointer-events:none`;
    document.body.appendChild(hintEl); setTimeout(() => hintEl?.remove(), 2500); } catch (e) {} };
  // check after clicks (opening the slip) and whenever the page adds things
  document.addEventListener('click', e => { if (e.target === fillPill || e.target === pill) return; [150, 500, 1200].forEach(ms => setTimeout(tryFill, ms)); }, true);
  new MutationObserver(() => { clearTimeout(tryFill._t); tryFill._t = setTimeout(tryFill, 250); }).observe(document.documentElement, { childList: true, subtree: true });

  // Clicking a price in the order book: the site fills the price box itself (no typing) -- find the box whose
  // value just changed and show the label for it. Then keep following that box (clicks, +/- buttons, typing).
  const allBoxes = () => { const out = []; const walk = root => { root.querySelectorAll?.('input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"])').forEach(i => out.push(i));
      root.querySelectorAll?.('*').forEach(el => { if (el.shadowRoot) walk(el.shadowRoot); }); }; walk(document); return out; };
  let snap = new Map();
  document.addEventListener('pointerdown', () => { snap = new Map(allBoxes().map(i => [i, i.value])); }, true);
  const findFilled = () => { for (const [i, v] of snap) if (i.isConnected && i.value !== v && priceOf(i.value) != null) return i; return null; };
  document.addEventListener('click', e => { if (e.target === pill) return;
    let found = false; const t = realTarget(e), onBox = boxEl && (t === boxEl || inBox(t)), onPrice = !!t?.closest?.('*') && [...(t.childNodes || [])].some(n => nodes.has(n));
    [120, 400, 900].forEach(ms => setTimeout(() => { const i = findFilled(); if (i) { found = true; boxEl = i; paintBox(); }
      // clicked somewhere else (not the box, not a price, and the box didn't change): put the label away
      else if (ms === 900 && !found && boxEl && !onBox && !onPrice) { let a = document.activeElement; while (a?.shadowRoot?.activeElement) a = a.shadowRoot.activeElement; if (a !== boxEl) { boxEl = null; boxTip.style.display = 'none'; } } }, ms)); }, true);
  const inBox = t => { for (let n = t; n; n = n.parentNode || n.host) if (n === boxEl) return true; return false; };
  // follow the box while it's showing (the site can change it without any event we'd see)
  let lastShown = '';
  setInterval(() => { if (!boxEl) return; if (!boxEl.isConnected) { boxEl = null; boxTip.style.display = 'none'; return; }
    const v = boxVal(boxEl) + '|' + winAmt; if (v !== lastShown) { lastShown = v; paintBox(); } }, 300);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && boxEl) { boxEl = null; boxTip.style.display = 'none'; } }, true);
  function paintPill(){ if (store.get('amxPill') === '0' || window.top !== window) return; pill.textContent = off ? 'AMX · off (Alt+A)' : editZone ? 'AMX · paused while typing' : `AMX${IS_PX ? ' · 2% fee in' : ''} · ${winAmt ? 'win $' + winAmt : 'win off'}`; if (document.body && !pill.isConnected) document.body.appendChild(pill); }

  watch(document.documentElement);
  scan(document.body);
  setInterval(() => { if (!off && !paused) scan(document.body); nodes.forEach(n => { if (!n.isConnected) nodes.delete(n); }); }, 4000);

  const revertAll = () => nodes.forEach(n => { if (n.isConnected && mine.get(n) === n.nodeValue && orig.has(n)) { const o = orig.get(n); mine.set(n, o); n.nodeValue = o; } });
  const resumeAll = () => { mine = new WeakMap(); scan(document.body); };

  // Alt+A: back to the site's own prices / American odds again
  document.addEventListener('keydown', e => {
    if (!(e.altKey && (e.key === 'a' || e.key === 'A' || e.code === 'KeyA'))) return;
    off = !off; store.set('amxOff', off ? '1' : '0'); e.preventDefault();
    if (off) revertAll(); else if (!paused) resumeAll();
    paintPill();
  }, true);

  const setPaused = () => {};   // (v1.5's pause-on-Make replaced by leaving just the typing box alone)
})();
