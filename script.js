// SR Bien-être — « Le Souffle »
(function () {
  "use strict";

  /* ---------- Mobile nav ---------- */
  var toggle = document.querySelector(".nav-toggle");
  var menu = document.getElementById("nav-menu");
  if (toggle && menu) {
    toggle.addEventListener("click", function () {
      var open = menu.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.setAttribute("aria-label", open ? "Fermer le menu" : "Ouvrir le menu");
    });
    menu.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () {
        menu.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  /* ---------- Footer year ---------- */
  var y = document.getElementById("year");
  if (y) y.textContent = new Date().getFullYear();

  /* ---------- Opening ritual : one calm breath ---------- */
  var intro = document.getElementById("souffle-intro");
  if (!intro) return;

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var seen = false;
  try { seen = sessionStorage.getItem("souffleSeen") === "1"; } catch (e) {}

  var membraneSvg = document.querySelector(".membrane-svg");

  // Skip the ritual for return visits (this session) or reduced-motion users.
  if (reduce || seen) {
    intro.parentNode && intro.parentNode.removeChild(intro);
    if (reduce && membraneSvg && membraneSvg.pauseAnimations) {
      try { membraneSvg.pauseAnimations(); } catch (e) {}
    }
    return;
  }

  try { sessionStorage.setItem("souffleSeen", "1"); } catch (e) {}

  var wordA = intro.querySelector(".intro-word--a");
  var wordB = intro.querySelector(".intro-word--b");
  var skipBtn = intro.querySelector(".intro-skip");
  var timers = [];
  var done = false;

  function at(ms, fn) { timers.push(setTimeout(fn, ms)); }

  function finish() {
    if (done) return;
    done = true;
    timers.forEach(clearTimeout);
    intro.classList.add("is-leaving");
    document.body.classList.remove("intro-lock");
    setTimeout(function () {
      intro.parentNode && intro.parentNode.removeChild(intro);
    }, 1000);
    window.removeEventListener("wheel", finish);
    window.removeEventListener("touchmove", finish);
    window.removeEventListener("keydown", onKey);
  }
  function onKey(e) { if (e.key !== "Tab") finish(); }

  // Run
  document.body.classList.add("intro-lock");
  requestAnimationFrame(function () {
    intro.classList.add("is-active");        // line draws (inhale), skip fades in
    at(450, function () { wordA.classList.add("show"); });   // « Respirez. »
    at(1750, function () {                    // exhale → the promise
      wordA.classList.remove("show");
      wordB.classList.add("show");
    });
    at(3300, finish);                         // reveal the site
  });

  skipBtn && skipBtn.addEventListener("click", finish);
  window.addEventListener("wheel", finish, { passive: true });
  window.addEventListener("touchmove", finish, { passive: true });
  window.addEventListener("keydown", onKey);
})();

/* ---------- La Source : capability-gated WebGL hero ---------- */
(function () {
  "use strict";
  var hero = document.querySelector(".hero");
  if (!hero) return;

  function hasWebGL() {
    try {
      var c = document.createElement("canvas");
      return !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl")));
    } catch (e) { return false; }
  }

  // Decide the fidelity tier. Mobile / low-power / save-data keep the SVG fallback.
  function pickTier() {
    var w = window.innerWidth;
    var mem = navigator.deviceMemory;                // undefined on many browsers
    var cores = navigator.hardwareConcurrency || 0;
    var save = navigator.connection && navigator.connection.saveData;
    var coarse = window.matchMedia("(pointer: coarse)").matches;
    if (!hasWebGL() || save) return null;
    if (w < 760 || (coarse && w < 1024)) return null;     // phones -> « Le Souffle » fallback
    if ((mem && mem < 4) || (cores && cores <= 4)) return null;
    if (w < 1100 || (mem && mem < 8) || (cores && cores <= 6)) return "B"; // tablets / mid
    return "A";
  }

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var force = new URLSearchParams(location.search).get("src3d"); // debug: ?src3d=A|B|off
  var tier = force === "off" ? null : (force === "A" || force === "B") ? force : pickTier();
  if (!tier) return; // keep the SVG membrane

  var started = false;
  function boot() {
    if (started) return; started = true;
    var canvas = document.createElement("canvas");
    canvas.className = "source-canvas";
    canvas.setAttribute("aria-hidden", "true");
    hero.insertBefore(canvas, hero.firstChild);

    import("./assets/js/hero3d.js").then(function (mod) {
      var app;
      try {
        app = mod.createSource({ canvas: canvas, tier: tier, reducedMotion: reduce });
      } catch (e) { canvas.remove(); return; }

      hero.classList.add("source-on");
      requestAnimationFrame(function () { canvas.classList.add("is-ready"); });

      // scroll -> gentle lift; pause when the hero leaves the viewport
      var ticking = false;
      function onScroll() {
        if (ticking) return; ticking = true;
        requestAnimationFrame(function () {
          var r = hero.getBoundingClientRect();
          var p = Math.min(1, Math.max(0, -r.top / (r.height || 1)));
          app.setScroll(p);
          ticking = false;
        });
      }
      window.addEventListener("scroll", onScroll, { passive: true });

      if ("IntersectionObserver" in window) {
        new IntersectionObserver(function (ents) {
          ents.forEach(function (en) {
            if (reduce) return;
            if (en.isIntersecting && !document.hidden) app.start(); else app.stop();
          });
        }, { threshold: 0.02 }).observe(hero);
      }
      document.addEventListener("visibilitychange", function () {
        if (reduce) return;
        if (document.hidden) app.stop();
        else if (hero.getBoundingClientRect().bottom > 0) app.start();
      });
    }).catch(function () { canvas.remove(); });
  }

  // Boot after first paint (never blocks LCP); wait for the intro to bow out if present.
  if (document.getElementById("souffle-intro") && !reduce) {
    setTimeout(boot, 1200);
  } else if (window.requestIdleCallback) {
    window.requestIdleCallback(boot, { timeout: 800 });
  } else {
    setTimeout(boot, 400);
  }
})();
