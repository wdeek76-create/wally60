// FD Enter to Bet: press Enter while FanDuel's bet slip is open and this clicks its "Place bet" button
// for you -- the same button you'd tap. It never sets a stake or picks a bet; it only presses the button
// that's already there. Alt+E turns it on / off (shown bottom-left). One press per 2 seconds max.
(() => {
  const store = { get:k=>{ try{ return localStorage.getItem(k); }catch(e){ return null; } }, set:(k,v)=>{ try{ localStorage.setItem(k,v); }catch(e){} } };
  let on = store.get('fdEnterOn') !== '0';
  let last = 0;

  const badge = document.createElement('div');
  badge.style.cssText = 'position:fixed;left:10px;bottom:10px;z-index:2147483647;padding:4px 9px;border-radius:999px;font:700 11px system-ui,sans-serif;color:#fff;pointer-events:none;opacity:.85';
  const paint = () => { badge.textContent = on ? '⏎ Enter bets: ON' : '⏎ Enter bets: OFF'; badge.style.background = on ? '#16a34a' : '#6b7280'; };
  const mount = () => { if (document.body && !badge.isConnected) document.body.appendChild(badge); };
  paint(); mount(); setInterval(mount, 2000);

  const visible = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; };
  const enabled = el => !el.disabled && el.getAttribute('aria-disabled') !== 'true';
  const label = el => (el.innerText || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim();

  // FanDuel's slip button reads like "Place bet $10.00", "Place 2 bets", or "Bet $25 to win $40"
  const PLACE = /^(place\b|bet \$|place bet)/i;
  const SKIP = /(remove|clear|cancel|share|login|log in|deposit)/i;

  function findPlace() {
    const btns = [...document.querySelectorAll('button, [role="button"]')].filter(el => visible(el) && enabled(el));
    return btns.find(el => PLACE.test(label(el)) && !SKIP.test(label(el))) || null;
  }

  document.addEventListener('keydown', e => {
    if (e.altKey && (e.key === 'e' || e.key === 'E')) { on = !on; store.set('fdEnterOn', on ? '1' : '0'); paint(); e.preventDefault(); return; }
    if (!on || e.key !== 'Enter' || e.shiftKey || e.ctrlKey || e.metaKey || e.repeat) return;
    const now = Date.now(); if (now - last < 2000) return;
    const btn = findPlace(); if (!btn) return;
    last = now; e.preventDefault(); e.stopPropagation();
    btn.click();
    badge.textContent = '⏎ Placed: ' + label(btn).slice(0, 40); setTimeout(paint, 2500);
  }, true);
})();
