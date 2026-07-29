/* ==========================================================================
   Developer page (developer.html)
   Runs after main.js, which owns the shared reveal observer. This file only
   prepares the skill bars; main.js adds .is-in and CSS does the animating.
   No network calls, no dependencies.
   ========================================================================== */

(function () {
  "use strict";

  /* Reads data-skill on each bar and hands the value to CSS as --pct.
     The visible percentage is the label in the markup, NOT this number:
     the joke row shows 1000% while filling the track to 100%. Keep the two
     in sync yourself when editing. */
  function initSkillBars() {
    var fills = document.querySelectorAll(".skill__fill[data-skill]");

    fills.forEach(function (fill, i) {
      var pct = parseFloat(fill.dataset.skill);
      if (isNaN(pct)) pct = 0;
      // Clamp so a value above 100 fills the track rather than overflowing.
      pct = Math.max(0, Math.min(pct, 100));

      fill.style.setProperty("--pct", pct / 100);

      // Stagger the bars so they read top to bottom instead of all at once.
      var row = fill.closest(".skill");
      if (row && !row.style.getPropertyValue("--d")) {
        row.style.setProperty("--d", i * 110 + "ms");
      }
    });
  }

  initSkillBars();
})();
