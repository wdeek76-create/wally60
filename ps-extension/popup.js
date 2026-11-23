const on = document.getElementById("on"), keep = document.getElementById("keep"), logEl = document.getElementById("log");
chrome.storage.local.get({ enabled: true, keepOriginal: false, log: [] }, s => {
  on.checked = !!s.enabled; keep.checked = !!s.keepOriginal;
  logEl.innerHTML = s.log.length ? s.log.map(x => x.err ? `<div class="row"><span style="color:#f87171">\u26a0 ${x.err}</span><span class="m">${x.from}</span></div>` : `<div class="row"><span><span class="src ${x.src}">${x.src}</span> <span class="m">${x.n} players</span></span><span><b>${x.to}</b> <span class="m">${new Date(x.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span></span></div>`).join("") : `<div class="m" style="padding:6px 0">Nothing converted yet.</div>`;
});
on.addEventListener("change", () => chrome.storage.local.set({ enabled: on.checked }));
keep.addEventListener("change", () => chrome.storage.local.set({ keepOriginal: keep.checked }));
