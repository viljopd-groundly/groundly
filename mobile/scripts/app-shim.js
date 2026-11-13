// Körs bara i appen. Webbappen ligger inbakad, men data (matchschema, kalendrar m.m.)
// hämtas färskt från webbplatsen så att appen inte behöver uppdateras varje dag.
(function () {
  var LIVE = "https://viljopd-groundly.github.io/groundly/";
  var REMOTE = /^(?:\.\/)?(data|cal|archive)\//;
  window.GROUNDLY_APP = true;
  var orig = window.fetch.bind(window);
  window.fetch = function (input, init) {
    var url = typeof input === "string" ? input : (input && input.url) || "";
    var rel = url.replace(location.origin + "/", "");
    if (typeof input === "string" && REMOTE.test(rel)) {
      // färskt från webben, annars den inbakade kopian
      return orig(LIVE + rel.replace(/^\.\//, ""), init).then(function (r) {
        if (r.ok) return r;
        return orig(input, init);
      }, function () { return orig(input, init); });
    }
    return orig(input, init);
  };
  // länkar till kalenderfiler och arkiv öppnas från webbplatsen
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a[href]");
    if (!a) return;
    var h = a.getAttribute("href");
    if (h && REMOTE.test(h)) a.setAttribute("href", LIVE + h.replace(/^\.\//, ""));
  }, true);
  // iPhone: webbvyn går ända upp under klockan/notchen, så toppraden får luft där
  var st = document.createElement("style");
  st.textContent = ".topbar{padding-top:calc(10px + env(safe-area-inset-top,0px))!important}" +
    ".wrap{padding-top:calc(16px + env(safe-area-inset-top,0px))!important}" +
    ".topbar{margin-top:calc(-16px - env(safe-area-inset-top,0px))!important}";
  document.documentElement.appendChild(st);
  // ingen service worker i appen (filerna ligger redan lokalt)
  if (navigator.serviceWorker) {
    try { navigator.serviceWorker.register = function () { return Promise.reject(new Error("app")); }; } catch (e) {}
  }
})();
