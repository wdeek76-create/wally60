// Watches finished CSV downloads. A Tabs or Sharpr projections file gets a PropShop copy written next to it ("TABSPS2026-11-13.csv" / "SHARPRPS2026-11-13.csv").
importScripts("convert.js");

const clock = () => { const d = new Date(), h = d.getHours(), m = String(d.getMinutes()).padStart(2, "0"); return `${h % 12 || 12}.${m}${h < 12 ? "am" : "pm"}`; };   // 2.17pm
const ourOwn = name => /-(NBA|NFL) \d{1,2}\.\d{2}(?:am|pm)(?: \(\d+\))?\.csv$/i.test(name);   // never re-convert a file we wrote
const today = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };

chrome.downloads.onChanged.addListener(delta => {
  if (!delta.state || delta.state.current !== "complete") return;
  chrome.downloads.search({ id: delta.id }, async items => {
    const it = items && items[0]; if (!it) return;
    const name = (it.filename || "").split(/[\\/]/).pop();
    if (!/\.csv$/i.test(name) || ourOwn(name)) return;
    chrome.storage.local.get({ enabled: true, keepOriginal: false }, async cfg => {
      if (!cfg.enabled) return;
      let text;
      try { const r = await fetch("file://" + it.filename.replace(/\\/g, "/")); text = await r.text(); }
      catch (e) { try { const r = await fetch(it.url); text = await r.text(); } catch (e2) { note("Couldn't read " + name, "Chrome blocked reading the file — turn on 'Allow access to file URLs' for this extension."); return; } }
      let out;
      try { out = toPropShop(text, name); } catch (e) { note("Convert failed: " + name, String(e && e.message || e)); return; }
      if (!out) return;                                             // not a projections source we know: leave it alone
      if (!out.n) { note(`${out.src}: nothing to convert`, `${name} has no projections in it yet — re-download once ${out.src} publishes numbers.`); return; }
      // NFL sources come in parts (Stok pass / rush / rec, RotoWire master / RB-WR-TE / QB, FTN full / QB): the day's parts are merged per player, and the
      // PropShop file is rewritten with everything so far (the earlier combined file for that source is replaced).
      chrome.storage.local.get({ nflParts: {} }, st => {
        let csv = out.csv, n = out.n, merged = false, replaceId = null;
        const key = out.sport === "NFL" ? `${out.src}|${today()}` : null;
        if (key) {
          const prev = st.nflParts[key];
          if (prev && Array.isArray(prev.players) && prev.players.length) { const all = mergeNfl(prev.players, out.players); const o = nflCsv(all); csv = o.csv; n = o.n; merged = true; replaceId = prev.fileId || null; out.players = all; }
          const parts = {}; Object.keys(st.nflParts).forEach(k => { if (k.endsWith("|" + today())) parts[k] = st.nflParts[k]; });   // only today's parts are kept
          parts[key] = { players: out.players, at: Date.now() };
          chrome.storage.local.set({ nflParts: parts });
        }
        const fname = `${out.src}-${out.sport} ${clock()}.csv`;        // e.g. "RG-NBA 2.17pm.csv", "STOK-NFL 2.17pm.csv"
        const dataUrl = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
        chrome.downloads.download({ url: dataUrl, filename: fname, conflictAction: "uniquify", saveAs: false }, newId => {
          // the PropShop file is the one you keep: the raw export is removed (unless "keep original" is on in the popup)
          if (!cfg.keepOriginal && newId != null) removeOriginal(it.id, name);
          if (merged && replaceId != null && newId != null) removeOriginal(replaceId, "earlier " + out.src + " file");   // the combined file supersedes the earlier one
          if (key && newId != null) chrome.storage.local.get({ nflParts: {} }, s2 => { if (s2.nflParts[key]) { s2.nflParts[key].fileId = newId; chrome.storage.local.set({ nflParts: s2.nflParts }); } });
          chrome.storage.local.get({ log: [] }, s => { const log = [{ at: Date.now(), from: name, to: fname, src: out.src, sport: out.sport, n }].concat(s.log).slice(0, 20); chrome.storage.local.set({ log }); });
          note(`${out.src} ${out.sport} → PropShop`, `${n} players → ${fname}${merged ? " (parts merged)" : ""}${cfg.keepOriginal ? "" : " (original removed)"}`);
        });
      });
    });
  });
});
// Remove the raw export. Right after "complete" the file can still be held by the browser / a scanner, so retry a few times before giving up
// (and say so in the log + a notification instead of silently leaving two files).
function removeOriginal(id, name, attempt) {
  attempt = attempt || 1;
  chrome.downloads.removeFile(id, () => {
    const err = chrome.runtime.lastError;
    if (!err) { chrome.downloads.erase({ id }); return; }
    if (attempt < 5) { setTimeout(() => removeOriginal(id, name, attempt + 1), attempt * 1500); return; }
    chrome.storage.local.get({ log: [] }, s => { const log = [{ at: Date.now(), from: name, to: "", src: "", n: 0, err: "original not removed: " + (err.message || "blocked") }].concat(s.log).slice(0, 20); chrome.storage.local.set({ log }); });
    note("Original kept: " + name, "Chrome wouldn't delete the raw export (" + (err.message || "blocked") + "). Delete it by hand.");
  });
}
function note(title, message) {
  try { chrome.notifications.create({ type: "basic", iconUrl: "icon.png", title, message }); } catch (e) {}
}
