const on = document.getElementById("on"), logEl = document.getElementById("log");
chrome.storage.local.get({ enabled: true, log: [] }, s => {
  on.checked = !!s.enabled;
  logEl.innerHTML = s.log.length ? s.log.map(x => `<div class="row"><span><span class="src ${x.src}">${x.src}</span> <span class="m">${x.n} players</span></span><span><b>${x.to}</b> <span class="m">${new Date(x.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span></span></div>`).join("") : `<div class="m" style="padding:6px 0">Nothing converted yet.</div>`;
});
on.addEventListener("change", () => chrome.storage.local.set({ enabled: on.checked }));
