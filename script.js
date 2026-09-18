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
