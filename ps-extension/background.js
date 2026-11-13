// Watches finished CSV downloads. A Tabs or Sharpr projections file gets a PropShop copy written next to it ("TABSPS2026-11-13.csv" / "SHARPRPS2026-11-13.csv").
importScripts("convert.js");

const psDate = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
const ourOwn = name => /PS\d{4}-\d{2}-\d{2}(?: \(\d+\))?\.csv$/i.test(name);   // never re-convert a file we wrote

chrome.downloads.onChanged.addListener(delta => {
  if (!delta.state || delta.state.current !== "complete") return;
  chrome.downloads.search({ id: delta.id }, async items => {
    const it = items && items[0]; if (!it) return;
    const name = (it.filename || "").split(/[\\/]/).pop();
    if (!/\.csv$/i.test(name) || ourOwn(name)) return;
    chrome.storage.local.get({ enabled: true }, async cfg => {
      if (!cfg.enabled) return;
      let text;
      try { const r = await fetch("file://" + it.filename.replace(/\\/g, "/")); text = await r.text(); }
      catch (e) { try { const r = await fetch(it.url); text = await r.text(); } catch (e2) { note("Couldn't read " + name, "Chrome blocked reading the file — turn on 'Allow access to file URLs' for this extension."); return; } }
      let out;
      try { out = toPropShop(text); } catch (e) { note("Convert failed: " + name, String(e && e.message || e)); return; }
      if (!out) return;                                             // not a projections source we know: leave it alone
      if (!out.n) { note(`${out.src}: nothing to convert`, `${name} has no projections in it yet — re-download once ${out.src} publishes numbers.`); return; }
      const fname = `${out.src}PS${psDate()}.csv`;
      const dataUrl = "data:text/csv;charset=utf-8," + encodeURIComponent(out.csv);
      chrome.downloads.download({ url: dataUrl, filename: fname, conflictAction: "uniquify", saveAs: false }, () => {
        chrome.storage.local.get({ log: [] }, s => { const log = [{ at: Date.now(), from: name, to: fname, src: out.src, n: out.n }].concat(s.log).slice(0, 20); chrome.storage.local.set({ log }); });
        note(`${out.src} → PropShop`, `${out.n} players → ${fname}`);
      });
    });
  });
});
function note(title, message) {
  try { chrome.notifications.create({ type: "basic", iconUrl: "icon.png", title, message }); } catch (e) {}
}
