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

  /* ======================================================================
     RATE LIMITING FOR THE STATS FETCH
     ----------------------------------------------------------------------
     STATS_ENDPOINT is null, so nothing below makes a network request yet
     and the page stays fully static. Set it to your public aggregate
     endpoint and the whole path switches on with throttling already in
     place. Nothing else needs editing.

     Three protections, so a popular page cannot hammer the endpoint:
       1. Throttle - at most one request per STATS_TTL_MS per browser tab.
          Repeat visits and reloads inside that window are served from cache.
       2. Backoff  - a 429 or a failure parks further requests for
          STATS_BACKOFF_MS, honouring Retry-After when the server sends it.
       3. Fallback - any failure keeps showing the last good values, or the
          placeholders above if there has never been a good response.

     The cache lives in sessionStorage: public aggregate counts only, no
     identifiers, cleared when the tab closes. All access is wrapped in
     try/catch because private-mode browsers can throw on access.
     ====================================================================== */

  var STATS_ENDPOINT   = null;              // e.g. "https://<public-api>/v1/stats"
  var STATS_TTL_MS     = 5 * 60 * 1000;     // one request per 5 minutes
  var STATS_BACKOFF_MS = 15 * 60 * 1000;    // pause after a 429 or failure
  var STATS_CACHE_KEY  = "musaed:stats";

  function readCache() {
    try {
      var raw = sessionStorage.getItem(STATS_CACHE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function writeCache(entry) {
    try {
      sessionStorage.setItem(STATS_CACHE_KEY, JSON.stringify(entry));
    } catch (e) {
      /* storage unavailable or full. Throttling degrades to per-pageload. */
    }
  }

  /* Maps the endpoint's payload onto the shape the renderer expects.
     Adjust the field names here to match whatever your API returns. */
  function shapeStats(payload) {
    return {
      servers: { value: payload.guild_count,  kind: "int" },
      members: { value: payload.member_count, kind: "int" },
      uptime:  { value: payload.uptime_30d,   kind: "percent" }
    };
  }

  /**
   * Resolves to the values rendered in the stats section.
   * Always resolves, never rejects: callers get usable numbers regardless.
   */
  function readStats() {
    if (!STATS_ENDPOINT) return Promise.resolve(STATS);

    var now = Date.now();
    var cached = readCache();

    // 1. Throttle, and 2. backoff. Both serve whatever we last had.
    if (cached && (now - cached.at < STATS_TTL_MS || now < (cached.retryAt || 0))) {
      return Promise.resolve(cached.data || STATS);
    }

    return fetch(STATS_ENDPOINT, { headers: { Accept: "application/json" } })
      .then(function (res) {
        if (res.status === 429) {
          // Honour Retry-After (seconds) when present, else use the default.
          var after = parseInt(res.headers.get("Retry-After"), 10);
          var wait = isNaN(after) ? STATS_BACKOFF_MS : after * 1000;
          writeCache({
            at: cached ? cached.at : 0,
            retryAt: now + wait,
            data: cached ? cached.data : null
          });
          throw new Error("rate limited");
        }
        if (!res.ok) throw new Error("stats request failed: " + res.status);
        return res.json();
      })
      .then(function (payload) {
        var data = shapeStats(payload);
        writeCache({ at: now, retryAt: 0, data: data });
        return data;
      })
      .catch(function () {
        // 3. Fallback to the last good values, then to the placeholders.
        var last = readCache();
        if (last && !last.retryAt) writeCache({ at: last.at, retryAt: now + STATS_BACKOFF_MS, data: last.data });
        return (last && last.data) || STATS;
      });
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
    var nodes = document.querySelectorAll("[data-stat]");
    if (!nodes.length) return;

    // readStats() always resolves, so there is no rejection path to handle.
    readStats().then(function (stats) {
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
    });
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
