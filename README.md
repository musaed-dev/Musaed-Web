# Musaed-Web

Public showcase site for **مساعد (Musaed)**, an Arabic (Saudi dialect) moderation and
automod bot for Discord.

This is a marketing page. It is not a dashboard, there is no login, and it does not
manage anything. Its only job is to explain the bot to server owners before they add it.

---

## Security boundary (read this first)

**This site has zero connection to Musaed's production database, and must never gain one.**

That is a hard boundary, not a style preference. The bot enforces strict tenant isolation
(every query filtered by `guild_id`, with a runtime guard blocking violations). Guild data
belongs to the servers that generated it. A public marketing page has no business touching it.

Concretely, this repo:

- has **no** backend, no server process, and no build step
- makes **no** network requests as shipped. There is exactly one `fetch` in the codebase,
  in `readStats()`, and it is unreachable while `STATS_ENDPOINT` is `null` — `readStats()`
  returns the local `STATS` object before reaching it. Verify with
  `grep -n "STATS_ENDPOINT" assets/js/main.js` (the declaration is space-aligned, so a
  pattern with a single space before `=` matches nothing and looks like the guard is gone)
- reads **no** environment variables. There is no `DATABASE_URL`, no `DISCORD_BOT_TOKEN`,
  no secrets of any kind, and no code path that could consume one
- imports **no** database, Discord, or auth libraries. No SQLAlchemy, no asyncpg,
  no discord.py, no session handling, no OAuth flow
- has no dependencies at all. Fonts and icons are vendored into `assets/`

If a future change needs live numbers, it must go through a **separate, purpose-built
public endpoint** that returns aggregate counts only. Never `guild_id`, never per-server
rows, never member identities. See "Placeholder data" below for where that would plug in.

---

## Copy accuracy

The statistics on this page are invented (see below), but **everything else describes a
real bot, and must stay true to it.** A marketing page that lists a command the bot does
not answer to is worse than one that lists nothing.

Two places go stale when the bot's command surface changes, and only these two:

1. the `.chip` lists in `#features` — command names shown as examples
2. `#commands` — the full reference: 6 groups, 33 rows

Both are plain HTML in `index.html`. There is no generator; keep them in sync by hand.

**What was corrected here.** The page originally advertised prefix commands
(`!طرد`, `!حظر`, `!اسكات`, `!تحذير`), a per-server prefix feature with a `!` / `؟` / `.`
chip row, and a `تحديد المعدّل` card with a `!تهدئة` command. None of those exist: the bot
registers **slash commands only**. The meta description also promised
`وبادئة مرنة لكل سيرفر`. All of it is gone.

**`/prefix` is deliberately not listed.** The command group exists and writes a prefix to
the database, but the bot registers no prefix commands, so setting one has no user-visible
effect. Listing it would advertise a no-op. If prefix commands are ever registered, add a
seventh group to `#commands` — and note that the nav is at its width limit (see below), so
`/prefix` gets a group but **not** a nav link.

**Do not publish deployment internals.** Infrastructure identifiers, environment variable
names, internal module paths, table and column names, and the bot's current command scope
are all absent from this site on purpose. The guarantees in `#trust` describe *behaviour*
only. In particular, `#trust` deliberately quotes **no numbers** for the settings-retention
window or the automod thresholds, because those are server-configurable defaults rather
than promises — do not add figures to that section.

---

## Placeholder data

Everything numeric on the page is invented. **Update it before you launch.**

### The three statistics

All three live in one object at the top of [assets/js/main.js](assets/js/main.js), each
tagged with a `// placeholder` comment:

| Key | Kind | Rendered as | Section label |
| --- | --- | --- | --- |
| `servers` | `int` | grouped, e.g. `1,284` | سيرفر يشغّل مساعد |
| `members` | `int` | grouped, e.g. `418,930` | عضو داخل هالسيرفرات |
| `uptime` | `percent` | one decimal, e.g. `99.4%` | نسبة التشغيل خلال 30 يوم |

To change them by hand, edit the values in `STATS`. Nothing else needs to change.
Any value left at `0` renders as `0` and skips the count-up, which is a reasonable
holding state until you have a real figure.

The markup carries `data-mock="true"` on each value node, so you can also find them
from the HTML side:

```bash
grep -rn "placeholder" assets/js/main.js index.html
grep -rn "data-mock" index.html
```

### Wiring a real API later

`readStats()` in [assets/js/main.js](assets/js/main.js) is the single seam, and the fetch
path with its rate limiting is **already written**. To switch it on, set one constant:

```js
var STATS_ENDPOINT = "https://<your-public-api>/v1/stats";
```

While it is `null` the function resolves to the placeholder object and the page makes zero
network requests, so the site stays fully static until you are ready. Adjust `shapeStats()`
to match your payload's field names; nothing else needs editing.

The endpoint must be a public aggregate API. Not the bot's database.

### Rate limiting the stats fetch

Three protections, so a page that gets traffic cannot hammer the endpoint:

| | Behaviour | Constant |
| --- | --- | --- |
| Throttle | at most one request per browser tab per window; repeats and reloads inside it are served from cache | `STATS_TTL_MS`, 5 min |
| Backoff | a 429 or a failure parks further requests, honouring `Retry-After` when the server sends it | `STATS_BACKOFF_MS`, 15 min |
| Fallback | any failure keeps the last good values, or the placeholders if there was never a good response | |

`readStats()` always resolves and never rejects, so the counters always get usable numbers.

The cache is `sessionStorage` under `musaed:stats`: public aggregate counts only, no
identifiers, cleared when the tab closes. Every access is wrapped in `try/catch` because
private-mode browsers can throw. If storage is unavailable the throttle degrades to
per-pageload rather than breaking.

Verified behaviour: first call fetches; repeat calls inside the TTL do not; the call after
the TTL does; a 429 keeps the previous values and suppresses requests for exactly
`Retry-After`; a 500 falls back to the last good values and backs off; with no cache and a
dead endpoint the placeholders render; and with `STATS_ENDPOINT = null` no request is ever
made.

### Placeholder links

Six anchors still need a real destination. All are tagged:

```bash
grep -rn "data-placeholder-link" index.html
```

| Marker | Count | Needs |
| --- | --- | --- |
| `discord-invite` | 3 | the bot-invite URL (nav, hero, about section) |
| `privacy` | 1 | a privacy policy |
| `terms` | 1 | terms of use |
| `email` | 1 | the contact address (footer). Also change `href` to `mailto:` |

The footer rows came from a reference design and are **claims about the product, not just
missing URLs**. Before launch, either give each one a real page or delete the row.

- `privacy` and `terms` are legal pages. An unwired link to a privacy policy is worse
  than no link at all.

Pricing, refund-policy and service-status rows were in the reference but have been
removed: Musaed is not presented as a paid product anywhere on this site, and there is no
status page to point at.

The community server link (`https://discord.gg/QvNXvDDFtz`) is **live, not a
placeholder**. It appears twice: the من نحن section and the footer. It is deliberately
untagged so the guard below leaves it alone.

While `href="#"`, a small guard in `main.js` swallows the click so the page does not jump
to the top, and logs which link is unwired. Once you set real URLs, that guard stops
applying on its own (it only targets `href="#"`).

### The developer page was removed

There used to be a third page, `developer.html`, reached from `المطور` in the footer: an
avatar, a bio, joke stat tiles and a set of skill bars. **It is gone**, along with
`assets/css/developer.css` and `assets/js/developer.js`, its footer link, the `#i-user`
sprite symbol that only it used, and the shared `.pagebar` / `.pagewrap` chrome that had no
other consumer.

It held no real identity — every personal field was still a `data-placeholder` and every
skill percentage was invented — so nothing real was lost. If you ever want a page about the
maintainer again, `#about-us` on the landing page already carries that role in neutral
project voice, and building a new sub-page should follow `updates.html`'s pattern rather
than resurrecting `.pagebar`.

### The updates page

`updates.html` is a changelog, reached from `التحديثات` in both the nav and the footer.

Layout is a three-column timeline inside a glass panel: a sticky version block, the
rail itself as a real 1px grid column, then the release body. Because the rail is a
column rather than a pseudo-element, consecutive releases join into one unbroken line
with no offset maths. Under 860px it collapses to rail plus content, with the version
stacked above its release and the sticky dropped.

One site-wide rule is broken here on purpose, and it is load-bearing for the terminal look:

- **Radius is zero.** Everywhere else uses `--r-sm` / `--r-md`. Every mark on this page
  is a hard square: the panel, the `جديد` badge, the rail nodes, the status dots.
  Rounding them makes the page look like the landing page in costume. The four
  selectors to change are named in the comment at the top of `updates.css`.

This page also builds **all** of its own chrome: the bar sits *inside* the glass panel, so
the back link lives in `.upbar`. `styles.css` contributes only the `.subpage` backdrop.

The greys were nudged a few points toward green from the neutral reference values, so
the page still reads as part of Musaed rather than a stock terminal template. They are
local tokens at the top of `updates.css` (`--up-head`, `--up-body`, and so on).

**The changelog is now real, and short.** It holds exactly one release — `1.0.0`,
`أغسطس 2026`, titled `البداية` and described as `أول نسخة لمساعد.` — supplied by the project
owner. The three invented releases that used to sit here (`1.2` / `1.1` / `1.0`, dated
Mar 2026 / Jan 2026 / Nov 2025) are gone. **There are no `data-mock` attributes left on
this page**; verify with `grep -c data-mock updates.html` (expect `0`). Do not add a release
you cannot date.

To add the next release, copy the `<li class="rel">` block and put it **above** the existing
one — newest first — then move `rel--latest` onto it. That class lights its node on the rail
and draws the `جديد` badge, and only one release may carry it. Each block holds three
children in order: `.rel__meta` (version + date), `.rel__rail` (the line and its node),
`.rel__body` (title, badge, then the release's content).

A release states its content one of two ways, and both are styled:

| Element | Use it when | Looks like |
| --- | --- | --- |
| `<p class="rel__desc">` | the release is one sentence | plain line under a hairline |
| `<ul class="rel__list">` of `.rel__item` | the release has several entries | rows, each led by a mono `+` |

`.rel__desc` deliberately has no `+`. A `+` reads as "this was added", which is wrong for a
sentence describing the release as a whole. `1.0.0` uses two consecutive `.rel__desc`
paragraphs; `.rel__list` is unused right now but kept, since the next release will
probably want it.

**Consecutive `.rel__desc` paragraphs are one description.** Only the first draws the
hairline that separates the description from the release title — `.rel__desc + .rel__desc`
zeroes the border and top padding. Without that rule a second sentence gets its own rule
and the prose reads as two unrelated rows, which is what `.rel__item` is for. Add as many
sentences as you like; they will keep flowing as one block.

Above the timeline, `إصدارات` counts the `.rel` blocks and `أنظمة` mirrors the five systems
`#features` advertises on the landing page — **both are kept in step by hand.** That row
previously read `+12 ميزة وتحسين` and `3 إصدارات`, which contradicted a changelog whose only
entry is the first release. The `∞` is not a figure so it stays as is.

The version numeral has room: `1.0.0` measures 152px in a 216px column at desktop, and
`1.10.0` would still fit at 182px.

**Do not put `.reveal` on `.rel__meta`.** That class animates `transform`, and a
transformed ancestor traps the sticky version block inside it. Reveals go on `.rel__body`
only, which is how the markup already has it.

### Shared sub-page chrome

There is barely any left. `updates.html` is now the only page that is not the landing page.
It sets `<body class="subpage">` for the backdrop gradient in `styles.css` and builds
everything else itself (`.upbar` / `.uppanel` in `updates.css`).

`styles.css` used to also carry a `.pagebar` / `.pagewrap` bar-and-column pair, but
`developer.html` was its only consumer, so it went with that page. A second sub-page should
copy `updates.html`'s approach, not reintroduce it.

### Other things to fill in

- `og:image` and `og:url` are not set. `musaed-banner.png` is ready for it, see "Brand assets".
- The footer year is hard-coded to `2026`.

---

## Running it locally

There is no build step and nothing to install. The page is plain HTML, CSS, and JS.

Opening `index.html` directly in a browser mostly works, but `file://` blocks the
self-hosted fonts, so serve it over HTTP instead:

```bash
# Python (no install needed)
python -m http.server 8000

# or Node
npx serve .
```

Then open <http://localhost:8000>.

### Deploying

Upload the repository as-is to any static host. Cloudflare Pages, Netlify, and Vercel all
work with no configuration: no build command, and the output directory is the repository
root.

---

## Project layout

```text
index.html                 the landing page, plus its inline icon sprite
updates.html               the changelog, plus its own sprite
assets/css/styles.css      tokens, reset, shared components, sub-page backdrop
assets/css/updates.css     updates page only, loaded after styles.css
assets/js/main.js          stats data, count-up, scroll reveals, link guard
assets/fonts/              self-hosted woff2, no external font requests
assets/Pics/               brand marks + images. Note the capital P, see below
```

Two pages, two stylesheets, one script. There is no third page: `developer.html`,
`developer.css` and `developer.js` were removed.

**Path casing.** `assets/Pics/` is capitalised while its siblings are not. Windows and
macOS do not care, but Linux static hosts are case-sensitive, so a reference written as
`assets/pics/...` will 404 in production while working perfectly on your machine. Every
reference in this repo already matches the folder exactly. If you rename the folder to
lowercase for consistency, update both `index.html` and `updates.html` with it.

Both pages inline their own copy of the icon sprite, holding only the symbols that page
uses. That keeps each page self-contained with no extra request, at the cost of a little
duplication for the icons they share. `updates.html` needs exactly one symbol.

### Page sections

| Anchor | Heading | Purpose |
| --- | --- | --- |
| (hero) | سيرفرك مرتب، وانت مرتاح | value prop, primary CTA |
| `#features` | كل اللي يحتاجه سيرفرك | the five systems, bento grid of 7 cards |
| `#commands` | كل الأوامر | full command reference, 6 groups / 33 rows |
| `#stats` | مساعد بالأرقام | public counters (mock, see above) |
| `#trust` | بيانات سيرفرك تبقى لسيرفرك | the three product guarantees |
| `#about` | مبني لمجتمعات عربية | about the **bot**: Arabic-first |
| `#about-us` | من نحن | about the **project and people**, plus the community server |

`#about` and `#trust` used to overlap: `#about` asserted tenant isolation in one clause.
That claim now lives in `#trust`, where it has room to say *how*, and `#about` is purely
the Arabic-first argument. Do not put the isolation claim back into both.

`#about` and `#about-us` are intentionally separate. The first positions the product,
the second introduces who is behind it. The copy in `#about-us` is written in neutral
project voice and asserts no names, dates, or team size. If you want it to read as a
solo maintainer, or to carry your handle, that is the section to edit.

### The Discord mark

`assets/Pics/Discord-Icon.png` (100x100, transparent) is the real Discord logo. It renders
in five places, all on `index.html`:

| Where | Class | Size |
| --- | --- | --- |
| `ضيف البوت` CTA, nav | `.btn__logo` in `.btn--sm` | 16px |
| `ضيف البوت` CTA, hero and about | `.btn__logo` | 18px |
| `ادخل سيرفرنا` CTA, community panel | `.btn__logo` | 18px |
| `سيرفر مساعد` community panel icon | `.community__logo` | 44px |

**The mark is treated per background, because one colour cannot serve both.**

- **On the blurple CTAs** it is rendered solid white via `filter: brightness(0) invert(1)`.
  That is Discord's own treatment for the logo on a blurple field, and it matches the
  button label exactly.
- **On the dark community panel** it is left at its natural colour, which clears 7.2:1
  there and needs no correction.

### Two accents, on purpose

The page accent is green (`--accent`). The primary CTAs are **Discord blurple**, because
every one of them is an action that leads to Discord: three `ضيف البوت` buttons and
`ادخل سيرفرنا`. Colouring them by destination reads as "this button goes to Discord",
which is the same convention as a "Sign in with Google" button carrying Google's colours.

| Token | Value | Notes |
| --- | --- | --- |
| `--discord` | `#5a63d8` | button fill. White label at 4.99:1 |
| `--discord-hover` | `#4e56c6` | darkens on hover, label rises to 6.05:1 |
| `--on-discord` | `#ffffff` | button label |

`#5a63d8` is deliberately deeper and slightly less saturated than Discord's own `#5865f2`,
so it is not an exact brand match.

The blurple is **scoped to `.btn--primary` only**. Do not spread it further, or it stops
reading as "Discord" and starts reading as a second brand colour. Everything else stays
green: `--on-accent` still drives the skip link and the `م` brand mark, and there are 29
`var(--accent)` usages across the two stylesheets (17 in `styles.css`, 12 in
`updates.css`) — icons, headings, stat numerals, chips, command names, hairlines, the
changelog rail and the ghost-button hover.

Two glyphs stay as inline SVG on purpose: the `سيرفر` stat icon and the footer `سيرفرنا`
link. Both are tinted to the accent and transition colour on hover, which a fixed-colour
raster cannot do.

The 100px source is comfortably sharp at every size above, including on 2x displays. Do
not scale it past about 50px, which is where upscaling starts to show.

### Design notes

- **Dark theme only**, one accent (`--accent`, terminal green). Both are locked in
  `:root`. Changing the accent in one place restyles the page.
- **RTL throughout.** The stylesheet uses logical properties (`margin-inline-start`,
  `border-inline-start`) rather than physical left/right, so the layout stays correct.
- **Arabic typography:** never apply negative letter-spacing to Arabic text. It breaks the
  connected script. Tracking is only used on Latin numerals in the stats.
- All user-facing copy is Arabic. Code comments and placeholder markers are English.
- **Footer** is a brand block plus three link columns (`الموقع`, `النظام`, `قانوني`),
  each row led by a muted icon at the reading edge so the icons form a vertical rail.
  Collapses to two columns under 640px. Markup is `.footer__cols > .fcol`.
- **Motion** is opacity and transform only, and fully disabled under
  `prefers-reduced-motion: reduce`. There are no scroll event listeners anywhere.

### The phone menu

Below 768px the six nav links become a panel under the bar, opened by `.nav__toggle`.
It is a plain disclosure, not a modal: no focus trap, no scroll lock, no overlay.

- **DOM order is brand, button, panel, CTA.** The button sits immediately before the panel
  it controls, so tabbing out of it lands in the menu with no focus management, and DOM,
  visual and focus order agree at *both* breakpoints. No `order` property anywhere. This
  is why the button is inboard of the CTA rather than at the far edge.
- **The panel is hidden with `visibility`, not `opacity` alone.** That is what keeps its
  links out of the tab order and the accessibility tree while closed. Verified: the nav
  exposes 2 links closed, 8 open.
- **Mobile is the base, desktop is the override.** `.nav__links` defaults to the dropped
  panel; the `min-width: 768px` block turns it back into a row.
- **Opening the menu pins the bar solid.** `nav-solidify` leaves the bar at 35% opacity
  until you scroll 140px, and a menu hanging off a see-through bar looks broken.
  `.nav.is-open { animation: none }` releases it, which is also how a plain declaration
  beats a running animation without `!important`.
- **Without JS the button is hidden**, since it could not do anything. The footer is the
  fallback and now carries every destination the nav does. If you add a nav link, add it
  to the footer too, or no-JS phones lose it.

### Accessibility invariants

These five were audited and fixed, and each is easy to undo by accident. Keep them.

- **44px is the floor for tap targets.** Footer rows, nav links and the updates back link
  all sit at or just over 44px. Several get there through `padding-block` cancelled by a
  negative margin, so the target grew without the layout moving. If you tighten padding
  for looks, you shrink the target.
- **Never `display: none` a label that is a control's accessible name.** The updates back
  link hides its text under 560px, so it is clipped out of view while staying in the
  accessibility tree. `display: none` there would leave screen readers announcing an
  unlabelled link, since the icon is `aria-hidden`.
- **Contrast is measured against the worst case, not the average.** The updates panel is
  half-transparent, so small text has to clear 4.5:1 over the *accent glow* behind it, not
  over the plain background. `--up-faint` and `--up-dim` were re-picked for that: 5.05:1
  and 4.81:1 in the glow. They look darker than they need to be against plain background
  because that is not where they have to survive.
- **Line length is capped.** `.rel__item` text stops at `68ch`. Without it the changelog
  bullets run about 95 characters, past the point where the eye loses the line return.
- **Latin code tokens inside RTL text are isolated *and* realigned.** Every `.cmd__name`
  and every Latin `.chip` carries `dir="ltr"` so the leading slash stays on the left
  instead of being reordered by the surrounding Arabic. `dir` also flips the block's own
  alignment, so `.cmd__name` sets `text-align: end` — which resolves against the element's
  own `ltr` direction and therefore means *right*, putting the names on the page's reading
  edge while their characters still run left to right. Verified: all five name right-edges
  in the first group share one x at both 375px and 1200px. Dropping either half brings
  back a zigzag, or a slash on the wrong side.

Two width limits, both measured rather than inferred:

- **320px** is where the nav bar breaks first. It has about 6px of slack, so widening the
  brand, the menu button or the CTA overflows there before it shows anywhere else.
- **768px** is where the six links first share one line with the brand and the CTA.
  Measured slack: **69.8px**. A seventh link costs roughly 75px, so it would not fit —
  re-measure before adding one, and prefer a footer-only link.

Everything above was measured in a real browser at 320, 375, 390, 412, 768, 1024 and
1440px, across both pages: 72 assertions, plus 17 for the menu's behaviour.

Verify with:

```bash
grep -rn "min-height: 44px" assets/css/
grep -rn "clip-path: inset(50%)" assets/css/
grep -o 'dir="ltr"' index.html | wc -l  # 44: 33 command names + 11 Latin chips
```

**Note on tooling.** The audit scripts drove headless **Edge**, which no longer works:
Edge 150 turned `Application/msedge.exe` into a stub that spawns the real binary under
`EdgeCore/<version>/` and exits, so the launcher sees the process die immediately
(`Code: 0`, empty stderr), and pointing at the `EdgeCore` binary directly still produces
no headless output in any mode. Use a standalone `chrome-headless-shell` instead
(`npx @puppeteer/browsers install chrome-headless-shell@stable`). Install it outside this
repo — the site itself must stay dependency-free.

### Motion, in two layers

**1. Entry reveals (baseline, works everywhere).** `IntersectionObserver` in `main.js`
adds `.is-in` once, and CSS transitions the element in. One-shot by design: content does
not fade back out when you scroll up. Siblings inside `.bento`, `.cmds`, `.stats`,
`.guards`, `.team`, and `.about` are staggered 80ms apart; the hero keeps its hand-tuned
delays via an inline `--d`. **A new grid of panels has to be added to that `GROUPS`
selector in `main.js`** or its children all land at once instead of sequencing.

That stagger is also a trap when screenshotting: the last card in `.bento` waits
`6 x 80ms` before its 700ms fade even starts, so a short fixed wait catches late elements
mid-transition and makes a perfectly correct layout look like missing content. Disable the
transition outright instead of waiting it out.

**2. Scroll-linked effects (progressive enhancement).** Native CSS scroll-driven
timelines, scrubbed to scroll position, in one `@supports (animation-timeline: view())`
block at the bottom of the stylesheet:

| Effect | Timeline | What it does |
| --- | --- | --- |
| `progress-grow` | `scroll(root)` | read-progress line under the nav, grows from the right |
| `nav-solidify` | `scroll(root)` | nav fades from near-transparent to solid over 140px |
| `hero-recede` | `view()` | hero copy recedes as the hero exits |
| `hero-drift` | `view()` | wordmark drifts slower than the copy, separating the layers |
| `glow-drift` | `scroll(root)` | hero glow parallaxes over the first viewport height |

Supported in Chromium 115+ and Safari 26+. Elsewhere the whole block is skipped and layer
1 carries the page on its own, so nothing looks broken.

Two constraints worth preserving if you extend this:

- **Do not put a scroll-linked animation on an element that also has `.reveal`.** The
  animation and the transition would fight over `transform`. This is why `hero-drift`
  targets `.wordmark` and not its `.reveal` parent `.hero__visual`.
- **Do not scrub body copy or cards.** Scrubbed text fades back out as you scroll up,
  which is distracting to read against. Scrubbing is reserved for effects where being
  tied to scroll position is the actual point.

### Brand assets

`assets/Pics/` holds the Musaed mark, a green م glyph on a transparent background:

| File | Size | Used as |
| --- | --- | --- |
| `musaed-avatar.png` | 1024x1024 | brand mark in the landing nav and footer (30px). Also the `apple-touch-icon` |
| `musaed-favicon.png` | 512x512 | `rel="icon"` on both pages |
| `musaed-banner.png` | 960x540 | **not wired up yet.** See below |

Both marks are fully transparent outside the glyph, so they sit on the dark chrome with no
plate behind them. The nav mark used to be a filled accent square with a م typed into it;
the real logo replaces both the square and the letter.

`musaed-banner.png` is the `og:image`, the card that renders when the site is linked in
Discord, Twitter or Slack. Both pages carry a full Open Graph + Twitter card block
with a `summary_large_image` card, plus a `canonical` link.

### The hardcoded domain

Social crawlers reject relative URLs, so the site URL is written literally into
`og:url`, `og:image`, `twitter:image` and `canonical` on **both pages**:

```text
https://musaed.up.railway.app
```

There are **eight** occurrences, four per page: `canonical`, `og:url`, `og:image` and
`twitter:image`. If you move again, find and replace the host across both HTML files —
nothing else in the repo references it. Then re-check all eight, because the two `og:url`
and `canonical` values are page-specific (`/` and `/updates.html`) while the two image
URLs are not:

```bash
grep -ohE 'https://[a-z0-9.-]+' index.html updates.html | sort -u
```

That should print exactly two hosts: the site's, and `discord.gg` for the community invite.

**This has already bitten once.** The site moved from `musaed-web-production.up.railway.app`
to the host above, and the old one now returns 404 — so every social card was pointing at a
dead image until the metadata was updated. A domain change is not done when the site loads
at the new address; it is done when all eight URLs are updated.

One note on the card: the banner is **960x540**. It renders fine, but `1200x630` is the
size every platform optimises for. Worth regenerating at that size when convenient.

Verified live at the current host: `/`, `/updates.html` and the banner all return 200, and
the banner serves as `image/png` (30 KB) rather than an HTML error page.

### Vendored assets

- Icons: [Phosphor Icons](https://phosphoricons.com) "regular" set (MIT), inlined as an
  SVG sprite in `index.html`. The paths are copied verbatim from `@phosphor-icons/core`.
  Do not hand-draw or hand-edit one. To add a symbol, pull the package
  (`npm pack @phosphor-icons/core`, extracted outside this repo) and copy the `d` attribute
  out of `assets/regular/<name>.svg` unchanged. `#i-hourglass`, `#i-seal-check`,
  `#i-clock`, `#i-info`, `#i-history` (`clock-counter-clockwise`) and `#i-user-check` were
  added that way; the id is shortened but the geometry is untouched.
- Fonts: IBM Plex Sans Arabic and IBM Plex Mono (SIL Open Font License 1.1), subset files
  taken from Fontsource.

---

## What this site still needs

The one asset it does not have is **real screenshots of the bot in action**: a moderation
command running, an automod catch, a welcome message, a captcha challenge. A showcase page
for a Discord bot is much stronger showing the product than describing it. Drop them in and
add a section between `#commands` and the stats band.

Two things to confirm before launch, both outside this repo:

- **The invite has to actually work.** If the bot's commands are still published to a single
  development guild rather than globally, adding it to a new server gets you a bot with no
  visible commands — and this page has four `ضيف البوت` CTAs pointing at that experience.
- **The `1.0.0` release is dated `أغسطس 2026`.** If the site goes live before then, the
  changelog's only entry is dated in the future. Either ship in August or adjust the date.
