// Exchange American Odds: on Novig and ProphetX, every price shown as a % / ¢ ("54¢", "54%", "54.5¢") or as a
// share price ("$0.54", "0.54") gets its American odds right next to it (54¢ -> -117). Only reads the page and
// adds a small tag; it never clicks or changes anything. Alt+A hides / shows the tags (remembered).
// A small "AMX" pill bottom-left shows it's running and how many prices it tagged (tap it to hide the pill).
(() => {
  const store = { get:k=>{ try{ return localStorage.getItem(k); }catch(e){ return null; } }, set:(k,v)=>{ try{ localStorage.setItem(k,v); }catch(e){} } };
  if (store.get('amxOff') === '1') document.documentElement.classList.add('amx-off');

  // 3-97 cents / percent (skips fees like "2%"), not part of a bigger number
  const RE_C = /(^|[^\d.])(\d{1,2}(?:\.\d{1,2})?)\s?(¢|%|c\b)/g;
  // share prices: "$0.54", "0.54", ".54"
  const RE_S = /(^|[^\d.$])(\$?0?\.(\d{2,3}))(?![\d%¢.])/g;
  const ANY = /\d\s?(¢|%|c\b)|(^|[^\d])\$?0?\.\d{2}/;
  const SKIP = new Set(['SCRIPT','STYLE','NOSCRIPT','TEXTAREA','INPUT','SELECT','OPTION','CODE','PRE']);

  const american = p => {               // p = win chance 0-1
    if (!(p >= 0.03 && p <= 0.97)) return null;
    const a = p >= 0.5 ? -Math.round(p / (1 - p) * 100) : Math.round((1 - p) / p * 100);
    return a > 0 ? '+' + a : String(a);
  };

  let tagged = 0;
  const made = new WeakSet();   // text pieces this script created -- not re-tagged unless the site changes them
  function convert(node){
    const txt = node.nodeValue; if (!ANY.test(txt)) return;
    const hits = [];
    RE_C.lastIndex = 0; let m;
    while ((m = RE_C.exec(txt))) hits.push({ end: m.index + m[0].length, p: parseFloat(m[2]) / 100 });
    RE_S.lastIndex = 0;
    while ((m = RE_S.exec(txt))) hits.push({ end: m.index + m[0].length, p: parseFloat('0.' + m[3]) });
    const ok = hits.map(h => ({ ...h, am: american(h.p) })).filter(h => h.am).sort((a, b) => a.end - b.end);
    if (!ok.length) return;
    const frag = document.createDocumentFragment(); let last = 0;
    ok.forEach(h => {
      if (h.end <= last) return;
      const t = document.createTextNode(txt.slice(last, h.end)); made.add(t); frag.appendChild(t);
      const fav = h.am.startsWith('-');
      const tag = document.createElement('span'); tag.className = 'amx ' + (fav ? 'fav' : 'dog'); tag.textContent = h.am; tag.dataset.amx = '1';
      // inline too, so it looks the same inside web components the page's stylesheet can't reach
      tag.style.cssText = `display:${document.documentElement.classList.contains('amx-off')?'none':'inline-block'};margin-left:4px;padding:0 5px;border-radius:5px;font-weight:800;font-size:.85em;line-height:1.35;color:#fff;white-space:nowrap;font-variant-numeric:tabular-nums;vertical-align:baseline;background:${fav?'#3a0d0d':'#0d2a17'};border:1px solid ${fav?'#7f1d1d':'#166534'}`;
      frag.appendChild(tag); last = h.end; tagged++;
    });
    const t = document.createTextNode(txt.slice(last)); made.add(t); frag.appendChild(t);
    node.parentNode.replaceChild(frag, node);
  }

  const okText = n => { const p = n.parentElement || n.parentNode?.host; if (!p || SKIP.has(p.tagName) || (p.closest && p.closest('.amx')) || p.isContentEditable) return false; return !made.has(n) && ANY.test(n.nodeValue); };
  function retag(n){ const nx = n.nextSibling; if (nx && nx.nodeType === 1 && nx.dataset && nx.dataset.amx) nx.remove(); convert(n); }
  function scan(root){
    if (!root) return;
    if (root.nodeType === 3) { if (okText(root)) retag(root); return; }
    if (root.nodeType !== 1 && root.nodeType !== 11) return;
    if (root.nodeType === 1 && (SKIP.has(root.tagName) || root.classList?.contains('amx'))) return;
    const list = [];
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    let n = w.currentNode;
    while (n) {
      if (n.nodeType === 3) { if (okText(n)) list.push(n); }
      else if (n.shadowRoot && !n.shadowRoot._amx) { n.shadowRoot._amx = 1; watch(n.shadowRoot); scan(n.shadowRoot); }   // prices inside web components
      n = w.nextNode();
    }
    list.forEach(retag);
    paintPill();
  }

  // live prices: re-tag whatever changes (batched once per frame)
  let pending = new Set(), queued = false;
  const flush = () => { queued = false; const items = [...pending]; pending.clear(); items.forEach(n => n.isConnected && scan(n)); };
  function watch(root){
    new MutationObserver(muts => {
      muts.forEach(m => {
        if (m.type === 'characterData') { made.delete(m.target); pending.add(m.target); }   // the site changed the price
        m.addedNodes.forEach(n => { if (made.has(n) || (n.nodeType === 1 && n.dataset && n.dataset.amx) || n === pill) return; pending.add(n); });
      });
      if (!queued && pending.size) { queued = true; requestAnimationFrame(flush); }
    }).observe(root, { childList: true, subtree: true, characterData: true });
  }

  // "AMX · 12" pill: proof it's running on this page (tap = hide it)
  const pill = document.createElement('div');
  pill.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:2147483647;padding:3px 8px;border-radius:999px;background:#111;color:#fff;font:700 11px system-ui,sans-serif;opacity:.8;cursor:pointer';
  pill.onclick = () => { pill.remove(); store.set('amxPill','0'); };
  function paintPill(){ if (store.get('amxPill') === '0' || window.top !== window) return; pill.textContent = `AMX · ${tagged} tagged${document.documentElement.classList.contains('amx-off') ? ' · hidden (Alt+A)' : ''}`; if (document.body && !pill.isConnected) document.body.appendChild(pill); }

  watch(document.documentElement);
  scan(document.body);
  setInterval(() => scan(document.body), 4000);   // catch-all for prices drawn without a DOM change we saw

  document.addEventListener('keydown', e => {
    if (e.altKey && (e.key === 'a' || e.key === 'A' || e.code === 'KeyA')) {
      const off = document.documentElement.classList.toggle('amx-off'); store.set('amxOff', off ? '1' : '0'); document.querySelectorAll('[data-amx]').forEach(t=>t.style.display=off?'none':'inline-block'); paintPill(); e.preventDefault();
    }
  }, true);
})();
