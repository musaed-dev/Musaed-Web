/* ==========================================================================
   Musaed (مساعد) - landing page behaviour
   Static site. No dependencies, no network calls, no backend.

   The page is a set of tab panels. Every panel is rendered in the HTML and
   nothing is hidden until this file runs, so a crawler and a browser with
   scripting off both get the whole document and every anchor still works.
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
     STATS_ENDPOINT now points at Musaed-Dashboard's public aggregate
     endpoint (no auth, no per-server data - see that repo's
     app/routers/public.py). Setting it back to `null` returns to the fully
     static page with the placeholder numbers above, and nothing else needs
     editing either way.

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

  var STATS_ENDPOINT   = "https://dashboard.musaed.dev/api/public/stats";
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
     Adjust the field names here to match whatever your API returns.

     `status` rides along on the same object rather than a second fetch - the
     public endpoint already answers both questions ("how many servers" and
     "is the bot up") in one response, and readStats()'s cache/throttle/
     backoff already covers it for free. `uptime` still reads a field
     (`uptime_30d`) the endpoint does not send yet, so it stays undefined and
     the #stats tile that would show it stays `hidden` in index.html - not
     wired until there is a real rolling percentage to report. */
  function shapeStats(payload) {
    return {
      servers: { value: payload.guild_count,  kind: "int" },
      members: { value: payload.member_count, kind: "int" },
      uptime:  { value: payload.uptime_30d,   kind: "percent" },
      status:  payload.status
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
     #stats is `hidden` right now, so this observes nodes inside a
     display:none subtree and simply never fires. Harmless, and it starts
     working again the moment the attribute comes off.
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

  /* ------------------------------------------------------------- status
     The desktop topbar's "البوت شغّال" badge, wired to the same fetch
     initStats() uses (readStats() caches/throttles it - this costs no
     second request). While STATS_ENDPOINT is null, or before it resolves,
     the badge simply keeps the text and pulse it was born with in the HTML.
  */

  function initStatus() {
    var el = document.querySelector(".status");
    if (!el) return;

    readStats().then(function (stats) {
      // The local placeholder object carries no `status` at all - nothing
      // to change until a real payload says otherwise.
      if (!stats.status) return;
      var down = stats.status === "down";
      el.classList.toggle("status--down", down);
      el.textContent = down ? "البوت متوقف" : "البوت شغّال";
    });
  }

  /* ------------------------------------------------------- scroll reveals
     IntersectionObserver only. No scroll listeners, no scroll maths.

     Panels start life inside a `hidden` ancestor, where an observed element
     never intersects. IntersectionObserver does notice the display change
     when a panel is shown, but re-observing on activation forces a fresh
     check straight away instead of waiting for the next frame budget.
  */

  var revealObserver = null;

  function initReveals() {
    var nodes = document.querySelectorAll(".reveal");
    if (!nodes.length) return;

    // Stagger siblings inside a group so each cluster reads in sequence
    // rather than all landing at once. Elements that already carry an
    // inline --d (the hero) keep their hand-tuned timing.
    document.querySelectorAll("[data-stagger]").forEach(function (group) {
      group.querySelectorAll(".reveal").forEach(function (el, i) {
        if (!el.style.getPropertyValue("--d")) {
          el.style.setProperty("--d", Math.min(i, 8) * 70 + "ms");
        }
      });
    });

    if (prefersReducedMotion || !("IntersectionObserver" in window)) {
      nodes.forEach(function (node) { node.classList.add("is-in"); });
      return;
    }

    revealObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-in");
          revealObserver.unobserve(entry.target);
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );

    nodes.forEach(function (node) { revealObserver.observe(node); });
  }

  function refreshReveals(scope) {
    if (!revealObserver || !scope) return;
    scope.querySelectorAll(".reveal").forEach(function (node) {
      if (node.classList.contains("is-in")) return;
      revealObserver.unobserve(node);
      revealObserver.observe(node);
    });
  }

  /* ------------------------------------------------------------------ tabs
     Sections are panels; the sidebar links are the tabs. The link href IS
     the panel id, so with scripting off these stay ordinary anchors into a
     fully rendered page — the same URLs keep working either way.

     A hash can also point at something nested (#about, #stats,
     #dashboard-features). Those resolve to their owning panel, which is
     opened before the browser is asked to scroll to the element.
  */

  function initTabs() {
    var panels = Array.prototype.slice.call(
      document.querySelectorAll("[data-panel]")
    );
    var tabs = Array.prototype.slice.call(document.querySelectorAll(".tab"));
    if (!panels.length || !tabs.length) return;

    var crumb = document.querySelector("[data-crumb]");

    /* Opening a panel puts you at the top of it.

       On a cold load of /#faq the browser still performs its own scroll to
       the element named in the fragment, and it does that AFTER this script
       has run — landing the panel flush under the sticky bar instead of at
       the top of the page. A single reset loses that race, so the initial
       one is re-asserted for a few frames and again at `load`, by which
       point the browser has finished. Later resets (tab clicks) have no such
       competition and only need the one call. */
    function resetScroll(persist) {
      window.scrollTo(0, 0);
      if (!persist) return;

      var frames = 0;
      (function again() {
        window.scrollTo(0, 0);
        if (++frames < 6) requestAnimationFrame(again);
      })();

      window.addEventListener("load", function once() {
        window.removeEventListener("load", once);
        window.scrollTo(0, 0);
      });
    }

    function panelFor(id) {
      if (!id) return null;
      var direct = panels.filter(function (p) { return p.id === id; })[0];
      if (direct) return direct;

      // Nested anchor: find the panel that contains it.
      var el = document.getElementById(id);
      return el ? el.closest("[data-panel]") : null;
    }

    function activate(panel, opts) {
      if (!panel) return;
      opts = opts || {};

      panels.forEach(function (p) {
        if (p === panel) p.removeAttribute("hidden");
        else p.setAttribute("hidden", "");
      });

      var label = "";
      tabs.forEach(function (tab) {
        var on = tab.getAttribute("href") === "#" + panel.id;
        if (on) {
          tab.setAttribute("aria-current", "page");
          label = tab.textContent.trim();
        } else {
          tab.removeAttribute("aria-current");
        }
      });

      if (crumb && label) crumb.textContent = label;

      refreshReveals(panel);

      if (opts.scrollTo) {
        // Let the panel paint before measuring the target's position.
        requestAnimationFrame(function () {
          opts.scrollTo.scrollIntoView({
            behavior: prefersReducedMotion ? "auto" : "smooth",
            block: "start"
          });
        });
      } else if (opts.reset) {
        resetScroll(opts.persist);
      }

      // Keyboard users need to land inside what they just opened, or the
      // next Tab press resumes from a control that is no longer on screen.
      if (opts.focus) {
        panel.setAttribute("tabindex", "-1");
        panel.focus({ preventScroll: true });
      }
    }

    function syncFromHash(opts) {
      var id = (location.hash || "").replace(/^#/, "");
      var panel = panelFor(id) || panels[0];
      var nested = id && panel.id !== id ? document.getElementById(id) : null;
      activate(panel, {
        reset: !nested,
        persist: opts && opts.persist,
        scrollTo: nested,
        focus: opts && opts.focus
      });
    }

    tabs.forEach(function (tab) {
      tab.addEventListener("click", function (event) {
        var id = (tab.getAttribute("href") || "").replace(/^#/, "");
        var panel = panelFor(id);
        if (!panel || event.metaKey || event.ctrlKey || event.shiftKey) return;

        event.preventDefault();
        if (location.hash !== "#" + id) {
          history.pushState(null, "", "#" + id);
        }
        activate(panel, { reset: true, focus: true });
      });
    });

    // Any other in-page link (hero CTA, brand mark, footer) routes the same
    // way, so nothing can leave the page showing a panel the tabs disagree
    // with. External and cross-page links are untouched.
    document.addEventListener("click", function (event) {
      var link = event.target.closest('a[href^="#"]');
      if (!link || link.classList.contains("tab")) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey) return;

      var id = (link.getAttribute("href") || "").replace(/^#/, "");
      if (!id) return;

      var panel = panelFor(id);
      if (!panel) return;

      event.preventDefault();
      if (location.hash !== "#" + id) history.pushState(null, "", "#" + id);

      var nested = panel.id !== id ? document.getElementById(id) : null;
      activate(panel, { reset: !nested, scrollTo: nested, focus: true });
    });

    // pushState fires popstate on back/forward; a hash typed or pasted into
    // the address bar fires hashchange instead. Both land here.
    window.addEventListener("popstate", function () { syncFromHash(); });
    window.addEventListener("hashchange", function () { syncFromHash(); });

    // The initial route is the one that has to out-wait the browser's own
    // fragment scroll, hence persist.
    syncFromHash({ persist: true });
  }

  /* ------------------------------------------------------------- phone menu
     Below 900px the tabs live in a panel under the bar, opened by
     .side__toggle. A plain disclosure, not a modal: no focus trap, no scroll
     lock, no overlay.

     The button owns aria-expanded and the panel is the next element in the
     DOM, so tabbing out of the button lands in the menu with no focus
     juggling. The panel is hidden with `visibility` in CSS, which is what
     keeps its links out of the tab order while closed — nothing here manages
     that.
  */

  function initMenu() {
    var side = document.querySelector(".side");
    var toggle = document.querySelector(".side__toggle");
    if (!side || !toggle) return;

    var panel = document.getElementById(toggle.getAttribute("aria-controls"));
    if (!panel) return;

    function isOpen() {
      return toggle.getAttribute("aria-expanded") === "true";
    }

    function setOpen(open) {
      side.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    }

    toggle.addEventListener("click", function () { setOpen(!isOpen()); });

    /* Every link either switches tab or leaves the page. Either way, leaving
       the menu open would cover the thing just navigated to. */
    panel.addEventListener("click", function (event) {
      if (event.target.closest("a")) setOpen(false);
    });

    document.addEventListener("keydown", function (event) {
      if (event.key !== "Escape" || !isOpen()) return;
      setOpen(false);
      toggle.focus();
    });

    /* A tap anywhere else dismisses it, which is what the panel looks like it
       should do. Listening on the document means page content counts. */
    document.addEventListener("click", function (event) {
      if (!isOpen() || side.contains(event.target)) return;
      setOpen(false);
    });

    /* Rotating the phone can cross the breakpoint with the panel open, which
       would otherwise leave `is-open` set on a sidebar that has no panel. */
    var wide = window.matchMedia("(min-width: 900px)");
    var onChange = function (event) { if (event.matches) setOpen(false); };
    if (wide.addEventListener) wide.addEventListener("change", onChange);
    else if (wide.addListener) wide.addListener(onChange);
  }

  /* --------------------------------------------------------- command filter
     Category buttons over the command list. The buttons are hidden with CSS
     when scripting is off, since all sixteen rows are rendered anyway.
  */

  function initFilters() {
    var buttons = Array.prototype.slice.call(
      document.querySelectorAll("[data-filter]")
    );
    var list = document.querySelector("[data-cmds]");
    if (!buttons.length || !list) return;

    var rows = Array.prototype.slice.call(list.querySelectorAll("[data-cat]"));
    var empty = document.querySelector("[data-cmds-empty]");

    function apply(value) {
      var shown = 0;

      rows.forEach(function (row) {
        var on = value === "all" || row.dataset.cat === value;
        if (on) {
          row.removeAttribute("hidden");
          shown++;
        } else {
          row.setAttribute("hidden", "");
        }
      });

      buttons.forEach(function (button) {
        button.setAttribute(
          "aria-pressed",
          button.dataset.filter === value ? "true" : "false"
        );
      });

      if (empty) empty.toggleAttribute("hidden", shown > 0);
      list.toggleAttribute("hidden", shown === 0);
    }

    buttons.forEach(function (button) {
      button.addEventListener("click", function () {
        apply(button.dataset.filter);
      });
    });
  }

  /* --------------------------------------------------------- versus switch
     "ليش مساعد؟" panel: a row of buttons, one comparison block shown at a
     time. Same shape as initFilters - the buttons reuse .filter and are
     hidden by `.no-js .filters` when scripting is off, where all the .vs
     blocks are rendered and simply stack.
  */

  function initVersus() {
    var buttons = Array.prototype.slice.call(
      document.querySelectorAll("[data-vs]")
    );
    var blocks = Array.prototype.slice.call(
      document.querySelectorAll("[data-vs-panel]")
    );
    if (!buttons.length || !blocks.length) return;

    function apply(value) {
      blocks.forEach(function (block) {
        block.toggleAttribute("hidden", block.dataset.vsPanel !== value);
      });
      buttons.forEach(function (button) {
        button.setAttribute(
          "aria-pressed",
          button.dataset.vs === value ? "true" : "false"
        );
      });
    }

    buttons.forEach(function (button) {
      button.addEventListener("click", function () { apply(button.dataset.vs); });
    });

    apply(buttons[0].dataset.vs);
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
  initTabs();
  initMenu();
  initFilters();
  initVersus();
  initStats();
  initStatus();
  initPlaceholderLinks();
})();
