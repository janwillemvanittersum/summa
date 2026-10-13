(function () {
  var body = document.body;

  // Reader preferences (theme, Latin/Dutch view) must survive clicking to another
  // page. localStorage is not available everywhere (e.g. sandboxed frames, some
  // file:// pages), so the choice is also kept in window.name, which stays with
  // the tab or frame across navigations.
  function getPref(key) {
    try { var v = localStorage.getItem("summa-" + key); if (v) return v; } catch (e) {}
    var m = (window.name || "").match(new RegExp("(?:^|;)summa-" + key + "=([a-z]+)"));
    return m ? m[1] : null;
  }
  function setPref(key, value) {
    try { localStorage.setItem("summa-" + key, value); } catch (e) {}
    var parts = (window.name || "").split(";").filter(function (p) {
      return p && p.indexOf("summa-" + key + "=") !== 0;
    });
    parts.push("summa-" + key + "=" + value);
    try { window.name = parts.join(";"); } catch (e) {}
  }

  // Some browsers treat every folder of a local (file://) copy as a separate origin and
  // clear window.name between them; so the choices also travel in the link's query string
  // (?theme=dark&view=nl), read on arrival.
  var KEYS = ["theme", "view", "host", "spelling"];
  var q = new URLSearchParams(location.search);
  KEYS.forEach(function (k) {
    var v = q.get(k);
    if (v && /^[a-z]+$/.test(v)) setPref(k, v);
  });
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a[href]");
    if (!a) return;
    var href = a.getAttribute("href");
    if (/^([a-z]+:|#|\/\/)/i.test(href)) return;   // external, or an anchor on this page
    var hash = "", i = href.indexOf("#");
    if (i >= 0) { hash = href.slice(i); href = href.slice(0, i); }
    var params = [];
    KEYS.forEach(function (k) { var v = getPref(k); if (v) params.push(k + "=" + v); });
    if (params.length) a.setAttribute("href", href.split("?")[0] + "?" + params.join("&") + hash);
  }, true);

  // Latin / both / Dutch
  function setView(v) {
    body.setAttribute("data-view", v);
    document.querySelectorAll(".view button").forEach(function (b) {
      b.classList.toggle("on", b.getAttribute("data-view") === v);
    });
    setPref("view", v);
  }
  setView(getPref("view") || "both");
  document.querySelectorAll(".view button").forEach(function (b) {
    b.addEventListener("click", function () {
      var anchor = currentSection;           // keep the reader's place
      setView(b.getAttribute("data-view"));
      if (anchor) anchor.scrollIntoView();
    });
  });

  // dark / light mode (default: the host's or the system's theme). Our own choice
  // lives in data-summa-theme, which the CSS lets win over data-theme: a host page
  // (such as the Artifact viewer) may set data-theme on every page load.
  var root = document.documentElement;
  var own = getPref("theme");
  if (own) root.setAttribute("data-summa-theme", own);
  // The host wraps only the main page and sets data-theme there; the other pages are
  // served bare and would fall back to the system theme. So remember the host's theme
  // and apply it (as a default, below the reader's own choice) on every page.
  function syncHost() {
    var ht = root.getAttribute("data-theme");
    if (ht !== "dark" && ht !== "light") return;
    setPref("host", ht);
    if (!getPref("theme")) root.setAttribute("data-summa-theme", ht);
  }
  syncHost();
  if (window.MutationObserver)
    new MutationObserver(syncHost).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
  document.querySelector(".theme").addEventListener("click", function () {
    var cur = root.getAttribute("data-summa-theme") || root.getAttribute("data-theme") ||
      (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    var next = cur === "dark" ? "light" : "dark";
    root.setAttribute("data-summa-theme", next);
    setPref("theme", next);
  });

  // spelling of the Dutch: as printed (1933) or modern; both versions are in the page
  var spBtn = document.querySelector(".spelling");
  function setSpelling(v) {
    root.setAttribute("data-summa-spelling", v);
    if (spBtn) {
      spBtn.innerHTML = (v === "mod" ? "nieuw" : "oud") + "<span class=\"sp-long\">e spelling</span>";
      spBtn.setAttribute("aria-pressed", v === "mod");
    }
  }
  setSpelling(getPref("spelling") || "old");
  if (spBtn) spBtn.addEventListener("click", function () {
    var anchor = currentSection;               // keep the reader's place
    var next = root.getAttribute("data-summa-spelling") === "mod" ? "old" : "mod";
    setSpelling(next);
    setPref("spelling", next);
    if (anchor) anchor.scrollIntoView();
  });

  // sidebar drawer on narrow screens
  var toggle = document.querySelector(".navtoggle");
  toggle.addEventListener("click", function () {
    var open = body.classList.toggle("nav-open");
    toggle.setAttribute("aria-expanded", open);
  });
  document.querySelectorAll(".toc a").forEach(function (a) {
    a.addEventListener("click", function () { body.classList.remove("nav-open"); });
  });

  // highlight the passage one jumps to (also on repeated clicks)
  window.addEventListener("hashchange", flash);
  function flash() {
    var el = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (!el || !el.classList.contains("pair")) return;
    el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash");
    setTimeout(function () { el.classList.remove("flash"); }, 1400);
  }

  // scroll spy: mark the current article and section in the sidebar
  var links = {};
  document.querySelectorAll(".toc [data-target]").forEach(function (a) {
    links[a.getAttribute("data-target")] = a;
  });
  var targets = Array.prototype.filter.call(
    document.querySelectorAll("section[data-nav], .pair[id]"),
    function (el) { return links[el.id]; });
  var currentSection = null;
  var ticking = false;
  function spy() {
    ticking = false;
    var y = window.innerHeight * 0.3, best = null, bestArt = null, bestQ = null;
    for (var i = 0; i < targets.length; i++) {
      var el = targets[i];
      if (el.getBoundingClientRect().top <= y) {
        if (el.classList.contains("pair")) best = el;
        else if (el.classList.contains("article")) { bestArt = el; best = null; }
        else { bestQ = el; bestArt = null; best = null; }
      }
    }
    currentSection = best || bestArt || bestQ;
    document.querySelectorAll(".toc .current").forEach(function (a) { a.classList.remove("current"); });
    [bestQ, bestArt, best].forEach(function (el) {
      if (el && links[el.id]) links[el.id].classList.add("current");
    });
    var mark = best || bestArt;
    if (mark && links[mark.id] && !body.classList.contains("nav-open")) {
      var toc = document.querySelector(".toc"), r = links[mark.id].getBoundingClientRect(),
          t = toc.getBoundingClientRect();
      if (r.top < t.top + 40 || r.bottom > t.bottom - 40)
        toc.scrollTop += r.top - t.top - t.height / 3;
    }
  }
  window.addEventListener("scroll", function () {
    if (!ticking) { ticking = true; requestAnimationFrame(spy); }
  }, { passive: true });
  spy();
})();
