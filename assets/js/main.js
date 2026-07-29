/* ==========================================================================
   Musaed (مساعد) - landing page behaviour
   Static site. No dependencies, no network calls, no backend.
   ========================================================================== */

(function () {
  "use strict";

  /* ======================================================================
     PLACEHOLDER DATA - MOCK NUMBERS ONLY
     ----------------------------------------------------------------------
     Nothing here is real. These are hand-written stand-ins so the stats
     section has something to render before a public stats API exists.

     This site has NO connection to Musaed's production database and must
     never gain one. When real numbers are available, they should come from
     a separate, purpose-built PUBLIC endpoint that returns aggregate values
     only (no guild_id, no per-server data, no member identities).

     To wire it up later, replace readStats() below with a fetch against
     that endpoint and keep the same return shape. Everything downstream
     stays as-is.
     ====================================================================== */

  var STATS = {
    servers: { value: 2,   kind: "int" },     // placeholder
    members: { value:10, kind: "int" },     // placeholder
    uptime:  { value: 99.4,   kind: "percent" }  // placeholder
  };

  /**
   * Returns the values rendered in the stats section.
   *
   * Currently synchronous and hard-coded (see STATS above).
   * Later: make this async and fetch from the public stats endpoint, e.g.
   *
   *   async function readStats() {
   *     var res  = await fetch("https://<public-api>/v1/stats");
   *     var data = await res.json();
   *     return {
   *       servers: { value: data.guild_count,   kind: "int" },
   *       members: { value: data.member_count,  kind: "int" },
   *       uptime:  { value: data.uptime_30d,    kind: "percent" }
   *     };
   *   }
   */
  function readStats() {
    return STATS;
  }

  /* ---------------------------------------------------------------- utils */

  var prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  var groupFormatter = new Intl.NumberFormat("en-US");

  function formatStat(value, kind) {
    if (kind === "percent") {
      return groupFormatter.format(Math.round(value * 10) / 10) + "%";
    }
    return groupFormatter.format(Math.round(value));
  }

  /* --------------------------------------------------------- stat counters
     Counts a number up when its section first enters the viewport.
     Motivated: the stats band exists to make three numbers land; the
     count-up is what draws the eye to them. It runs once, never loops.
  */

  function countUp(el, target, kind) {
    var DURATION = 1400;
    var start = null;

    function frame(now) {
      if (start === null) start = now;
      var t = Math.min((now - start) / DURATION, 1);
      var eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      el.textContent = formatStat(target * eased, kind);
      if (t < 1) requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
  }

  function initStats() {
    var stats = readStats();
    var nodes = document.querySelectorAll("[data-stat]");
    if (!nodes.length) return;

    function render(node, animate) {
      var entry = stats[node.dataset.stat];
      if (!entry) return;
      var target = node.querySelector("bdi") || node;
      if (animate) {
        countUp(target, entry.value, entry.kind);
      } else {
        target.textContent = formatStat(entry.value, entry.kind);
      }
    }

    if (prefersReducedMotion || !("IntersectionObserver" in window)) {
      nodes.forEach(function (node) { render(node, false); });
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          render(entry.target, true);
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.4 }
    );

    nodes.forEach(function (node) { observer.observe(node); });
  }

  /* ------------------------------------------------------- scroll reveals
     IntersectionObserver only. No scroll listeners, no scroll math.
  */

  function initReveals() {
    var nodes = document.querySelectorAll(".reveal");
    if (!nodes.length) return;

    if (prefersReducedMotion || !("IntersectionObserver" in window)) {
      nodes.forEach(function (node) { node.classList.add("is-in"); });
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-in");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
    );

    // Stagger siblings inside a group so each cluster reads in sequence
    // rather than all landing at once. Elements that already carry an
    // inline --d (the hero) keep their hand-tuned timing.
    var GROUPS = ".bento, .stats, .team, .about";
    document.querySelectorAll(GROUPS).forEach(function (group) {
      group.querySelectorAll(".reveal").forEach(function (el, i) {
        if (!el.style.getPropertyValue("--d")) {
          el.style.setProperty("--d", i * 80 + "ms");
        }
      });
    });

    nodes.forEach(function (node) { observer.observe(node); });
  }

  /* ---------------------------------------------------- placeholder links
     Every anchor tagged with data-placeholder-link still needs a real URL.
     Until then, swallow the click so the page does not jump to the top.
     Search the project for "data-placeholder-link" to find them all.
  */

  function initPlaceholderLinks() {
    document
      .querySelectorAll('a[data-placeholder-link][href="#"]')
      .forEach(function (link) {
        link.setAttribute("aria-disabled", "true");
        link.addEventListener("click", function (event) {
          event.preventDefault();
          console.info(
            "[musaed] placeholder link not wired yet:",
            link.dataset.placeholderLink
          );
        });
      });
  }

  /* ------------------------------------------------------------------ go */

  initReveals();
  initStats();
  initPlaceholderLinks();
})();
