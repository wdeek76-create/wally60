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
    const z = zoneOf(t); if (editZone === z) return; editZone = z;
    nodes.forEach(n => { if (n.isConnected && inEdit(n) && mine.get(n) === n.nodeValue && orig.has(n)) { const o = orig.get(n); mine.set(n, o); n.nodeValue = o; } }); };
  const endEdit = () => { const z = editZone; editZone = null; if (z && z.isConnected && !off) { mine = new WeakMap(); scan(document.body); } };
  document.addEventListener('focusin', e => { const t = realTarget(e); if (isTyping(t)) startEdit(t); }, true);
  // a price box the site built itself (not a real input): typing a number / . / backspace into it counts too
  document.addEventListener('keydown', e => { if (e.altKey || e.ctrlKey || e.metaKey) return; if (/^[0-9.,+-]$|^Backspace$|^Delete$/.test(e.key)) startEdit(realTarget(e)); }, true);

  // Type American odds in a price box: "-150" / "+120", then Enter or Tab -> the box gets the % / ¢ the site wants
  // (60 / 45.5). Enter only converts (press Enter again to submit), so nothing goes in at the wrong price.
  const AM_RE = /^\s*([+-])\s*(\d{3,5})\s*$/;
  const toPct = (sign, n) => { if (n < 100) return null; const p = sign === '-' ? n / (n + 100) : 100 / (n + 100); return Math.round(p * 1000) / 10; };
  const setVal = (el, v) => { const d = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value'); if (d?.set) d.set.call(el, v); else el.value = v;
    el.dispatchEvent(new Event('input', { bubbles: true, composed: true })); el.dispatchEvent(new Event('change', { bubbles: true, composed: true })); };
  const amFill = el => { if (!el || el.tagName !== 'INPUT') return false; const m = AM_RE.exec(el.value || ''); if (!m) return false;
    const pct = toPct(m[1], Number(m[2])); if (pct == null || pct <= 0 || pct >= 100) return false;
    setVal(el, String(pct).replace(/\.0$/, '')); hint(el, `${m[1]}${m[2]} → ${String(pct).replace(/\.0$/, '')}`); return true; };
  let hintEl = null;
  const hint = (el, t) => { try { hintEl?.remove(); const r = el.getBoundingClientRect(); hintEl = document.createElement('div'); hintEl.textContent = t;
    hintEl.style.cssText = `position:fixed;left:${Math.max(4, r.left)}px;top:${Math.max(4, r.top - 24)}px;z-index:2147483647;padding:2px 8px;border-radius:999px;background:#111;color:#fff;font:700 12px system-ui,sans-serif;pointer-events:none`;
    document.body.appendChild(hintEl); setTimeout(() => hintEl?.remove(), 2500); } catch (e) {} };
  document.addEventListener('keydown', e => { if (e.key !== 'Enter' && e.key !== 'Tab') return; const t = realTarget(e); if (amFill(t) && e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); } }, true);
  document.addEventListener('focusout', e => { amFill(realTarget(e)); }, true);
  document.addEventListener('beforeinput', e => startEdit(realTarget(e)), true);
  // clicking anywhere outside the form you were typing in: back to American odds there
  document.addEventListener('pointerdown', e => { if (editZone && !e.composedPath?.().includes(editZone) && !inEdit(realTarget(e))) setTimeout(endEdit, 150); }, true);
  document.addEventListener('focusout', e => { const t = realTarget(e); if (!isTyping(t)) return;
    setTimeout(() => { let a = document.activeElement; while (a?.shadowRoot?.activeElement) a = a.shadowRoot.activeElement; if (a && a !== document.body && inEdit(a)) return; endEdit(); }, 250); }, true);
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
  pill.onclick = () => { pill.remove(); store.set('amxPill','0'); };
  function paintPill(){ if (store.get('amxPill') === '0' || window.top !== window) return; pill.textContent = off ? 'AMX · off (Alt+A)' : paused ? 'AMX · paused (Make)' : `AMX · ${converted} converted`; if (document.body && !pill.isConnected) document.body.appendChild(pill); }

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
