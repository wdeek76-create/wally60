// Exchange American Odds: on Novig and ProphetX, every price shown as a % or ¢ (e.g. "54¢", "54%", "54.5¢")
// gets its American odds right next to it (54¢ -> -117). Only reads the page and adds a small tag; it never
// clicks or changes anything. Alt+A hides / shows the tags (remembered).
(() => {
  const store = { get:k=>{ try{ return localStorage.getItem(k); }catch(e){ return null; } }, set:(k,v)=>{ try{ localStorage.setItem(k,v); }catch(e){} } };
  if (store.get('amxOff') === '1') document.documentElement.classList.add('amx-off');

  // 3-97 cents / percent, optionally one or two decimals; not part of a bigger number
  const RE = /(^|[^\d.])(\d{1,2}(?:\.\d{1,2})?)\s?(¢|%|c\b)/g;
  const SKIP = new Set(['SCRIPT','STYLE','NOSCRIPT','TEXTAREA','INPUT','SELECT','OPTION','CODE','PRE']);

  const american = p => {               // p = win chance 0-1
    if (p <= 0 || p >= 1) return null;
    const a = p >= 0.5 ? -Math.round(p / (1 - p) * 100) : Math.round((1 - p) / p * 100);
    return a > 0 ? '+' + a : String(a);
  };

  const made = new WeakSet();   // text pieces this script created -- not re-tagged unless the site changes them
  function convert(node){
    const txt = node.nodeValue; RE.lastIndex = 0;
    if (!RE.test(txt)) return;
    RE.lastIndex = 0;
    const frag = document.createDocumentFragment(); let last = 0, m, hit = false;
    while ((m = RE.exec(txt))) {
      const v = parseFloat(m[2]); if (!(v >= 3 && v <= 97)) continue;   // skips fees like "2%"
      const am = american(v / 100); if (!am) continue;
      const end = m.index + m[0].length;
      { const t=document.createTextNode(txt.slice(last, end)); made.add(t); frag.appendChild(t); }
      const tag = document.createElement('span'); tag.className = 'amx ' + (am.startsWith('-') ? 'fav' : 'dog'); tag.textContent = am; tag.dataset.amx = '1';
      frag.appendChild(tag); last = end; hit = true;
    }
    if (!hit) return;
    { const t=document.createTextNode(txt.slice(last)); made.add(t); frag.appendChild(t); }
    node.parentNode.replaceChild(frag, node);
  }

  function scan(root){
    if (!root) return;
    if (root.nodeType === 3) { const p = root.parentElement; if (!p || SKIP.has(p.tagName) || p.closest('.amx') || made.has(root)) return;
      const nx = root.nextSibling; if (nx && nx.nodeType === 1 && nx.dataset && nx.dataset.amx) nx.remove(); convert(root); return; }
    if (root.nodeType !== 1 || SKIP.has(root.tagName) || root.classList?.contains('amx') || root.isContentEditable) return;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: n => {
      const p = n.parentElement; if (!p || SKIP.has(p.tagName) || p.closest('.amx') || p.isContentEditable) return NodeFilter.FILTER_REJECT;
      return !made.has(n) && /\d\s?(¢|%|c\b)/.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT; } });
    const list = []; while (w.nextNode()) list.push(w.currentNode);
    list.forEach(n => {
      // a price that changed in place: drop the old tag right after it, then re-tag
      const nx = n.nextSibling; if (nx && nx.nodeType === 1 && nx.dataset && nx.dataset.amx) nx.remove();
      convert(n);
    });
  }

  // live prices: re-tag whatever changes (batched once per frame)
  let pending = new Set(), queued = false;
  const flush = () => { queued = false; const items = [...pending]; pending.clear(); items.forEach(n => n.isConnected && scan(n)); };
  new MutationObserver(muts => {
    muts.forEach(m => {
      if (m.type === 'characterData') { made.delete(m.target); pending.add(m.target); }   // the site changed the price
      m.addedNodes.forEach(n => { if (made.has(n) || (n.nodeType === 1 && n.dataset && n.dataset.amx)) return; pending.add(n); });
    });
    if (!queued && pending.size) { queued = true; requestAnimationFrame(flush); }
  }).observe(document.documentElement, { childList: true, subtree: true, characterData: true });

  scan(document.body);

  document.addEventListener('keydown', e => {
    if (e.altKey && (e.key === 'a' || e.key === 'A')) {
      const off = document.documentElement.classList.toggle('amx-off'); store.set('amxOff', off ? '1' : '0'); e.preventDefault();
    }
  }, true);
})();
