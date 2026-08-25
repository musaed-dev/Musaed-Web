# Musaed-Web

Public showcase site for **مساعد (Musaed)**, an Arabic (Saudi dialect) moderation and
automod bot for Discord.

This is a marketing page. It is not a dashboard and it does not manage anything. Its only
job is to explain the bot to server owners before they add it.

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
2. `#commands` — a curated list, not a full reference: 7 groups, 16 rows

Both are plain HTML in `index.html`. There is no generator; keep them in sync by hand.

**What was corrected here.** The page originally advertised prefix commands
(`!طرد`, `!حظر`, `!اسكات`, `!تحذير`), a per-server prefix feature with a `!` / `؟` / `.`
chip row, and a `تحديد المعدّل` card with a `!تهدئة` command. None of those exist: the bot
registers **slash commands only**. The meta description also promised
`وبادئة مرنة لكل سيرفر`. All of it is gone.

**`/prefix` is deliberately not listed.** The command group exists and writes a prefix to
the database, but the bot registers no prefix commands, so setting one has no user-visible
effect. Listing it would advertise a no-op. If prefix commands are ever registered, add a
group to `#commands` — and note that the nav is at its width limit (see below), so
`/prefix` gets a group but **not** a nav link.

**In-chat moderation triggers exist but are deliberately not enumerated here.**
`ban`/`timeout`/`untimeout`/`warn` also have plain-word triggers typed directly in chat, each
gated by the same Discord permission as its slash equivalent and silent for anyone lacking
it. The "أوامر واضحة" card in `#features` mentions this in one generic sentence — no trigger
words, no confirmation of which words, nothing about them being configurable per deployment
— on purpose: naming them here would be the site publishing exactly what the bot's own
design keeps unlisted. Do not add a `#commands` row for these; they are not slash commands,
and `#commands`'s lede promises everything listed there is one.

**Shortcuts are a different feature and are listed.** Do not confuse them with the fixed
in-chat triggers above. `/اختصار` (Administrator) is a real, registered slash command that
lets a server admin define their *own* trigger word — any word they pick — that maps to
ban, kick, or timeout. Since the word is per-guild and admin-chosen rather than a fixed
set the bot ships with, publishing that the feature exists reveals nothing guild-specific;
unlike the fixed triggers, an admin has to know `/اختصار` exists to use it at all, so hiding
it would only make the feature undiscoverable. It gets its own bento card ("اختصارات
نصية") and its own `#commands` group, same treatment as agegate/captcha/tickets — it is a
fourth registered feature in the bot's settings layer, not a sub-feature of moderation.
`/اختصار` is also the one Arabic command name on the page: its `.cmd__name` carries no
`dir="ltr"` (reversing real Arabic would be wrong) and instead gets `.cmd__name--ar`,
which right-aligns it via `text-align: start` against its natural RTL direction and swaps
off `--mono` (no Arabic glyphs) the same way `.chip--ar` does.

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

**There are none left.** Every link on the site now points somewhere real:

```bash
grep -c "data-placeholder-link" index.html   # 0
```

The footer's قانوني column was the last of them: `الخصوصية` and `شروط الاستخدام` go to the
two legal pages, and `بريد التواصل` is a live `mailto:`. The `href="#"` click guard in
`main.js` still exists but now matches nothing, which is the intended end state — it only
ever targeted `href="#"`.

**The bot invite is live.** The three `ضيف البوت` CTAs (nav, hero, about) carry the real
OAuth2 authorize URL. All three copies must stay **identical** — there is no single source
for them, so a change to one is a change to three:

```bash
grep -c "oauth2/authorize" index.html    # 3
```

The `permissions` integer in that URL is what Discord pre-ticks on the authorize screen, so
editing it changes what the bot is granted on join. As of 2026-08-10 it requests
`permissions=8` — Administrator, a deliberate change from the previous 23-permission
least-privilege set. Ampersands are written `&amp;` because this is an HTML attribute; the
browser sends plain `&`. Verified: the resolved `a.href` matches the intended URL exactly and
all four query parameters parse.

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
project voice, and building a new sub-page should follow the legal pages' pattern (its own
`.docbar`/`.docwrap` bar-and-column chrome in `legal.css`) rather than resurrecting
`.pagebar`.

### The updates page was also removed

There used to be a fourth page here, `updates.html` — a changelog, laid out as a three-column
timeline inside a glass panel with its own `assets/css/updates.css` (local `--up-*` tokens, a
zero-radius terminal look, `.upbar`/`.uppanel` chrome it built entirely itself). It had been
deliberately unlinked from the nav and footer since 2026-08-06 but stayed live at
`/updates.html`, still indexed via `sitemap.xml`. On 2026-08-25 the project owner had it
removed outright rather than kept as a dead-but-crawlable page — nothing on the site linked
to it, and an unlinked page with no path back to it is a liability, not a convenience.

Removed with it: `updates.css`, its 1-symbol sprite, its `sitemap.xml` entry, and its four
`canonical`/`og:url`/`og:image`/`twitter:image` URLs (the "hardcoded domain" count below
dropped from 20 to 16 accordingly). Its single real release (`1.0.0`, `أغسطس 2026`,
`البداية`) is gone with the page — there is nothing to relink or resurrect; a changelog page
would need to be rebuilt from scratch if wanted again.

### The legal pages

`privacy.html` and `terms.html` hold the project owner's own text, reproduced as written;
only Markdown was converted to HTML. Both are linked from the footer's قانوني column, and
both are what Discord's Developer Portal wants in its **Privacy Policy URL** and **Terms of
Service URL** fields:

```text
https://musaed.dev/privacy.html
https://musaed.dev/terms.html
```

That requirement is why these are real pages rather than tabs or a dialog on the landing
page — a portal field needs a URL that resolves to a document on its own.

**Neither page loads any JavaScript.** No `<script>`, and no `class="no-js"` on `<html>`,
because nothing on them depends on scripting. A legal document has to be readable by a
person with JS disabled and by a crawler that does not run it. Do not add `main.js` "for
consistency" — the scroll reveals would fade a privacy policy in, which is the wrong
instinct for a document someone may be reading for a reason.

`legal.css` is shared by both — the only stylesheet besides `styles.css` still in the repo.
That is deliberate: they are the same kind of page — a back bar above a single column of
prose — so anything added there shows up on both. `--doc-measure` on `.subpage--legal` is the
single source of truth for the column width.

Prose inside `.docbody` is styled with **element** selectors (`h2`, `p`, `ul`, `code`,
`strong`, `a`) rather than classes, so whoever edits the policy text does not have to
remember class names to write a paragraph.

Each document ends with a `.docnext` link to the other one, which is what tabs would have
provided without costing a page.

Both documents are dated `2026/08/01`. The source had left the terms date as `[التاريخ]`;
the project owner filled it in. **No text placeholders remain on either page** — the only
invented values left anywhere on the site are the three `#stats` numbers.

### Shared sub-page chrome

There is barely any. Every page that is not the landing page sets `<body class="subpage">`
for the backdrop gradient in `styles.css`, and builds the rest itself — `.docbar` /
`.docwrap` in `legal.css`.

`styles.css` used to also carry a `.pagebar` / `.pagewrap` bar-and-column pair, but
`developer.html` was its only consumer, so it went with that page. The legal pages did not
reintroduce it; they define their own bar, which is the pattern to follow.

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
privacy.html               privacy policy          } same layout,
terms.html                 terms of use            } one shared stylesheet
assets/css/styles.css      tokens, reset, shared components, sub-page backdrop
assets/css/legal.css       BOTH legal pages, loaded after styles.css
assets/js/main.js          stats data, count-up, scroll reveals, link guard
assets/fonts/              self-hosted woff2, no external font requests
assets/Pics/               brand marks + images. Note the capital P, see below
```

Three pages, two stylesheets, one script. `developer.html` and its CSS/JS were removed and
should not come back; `updates.html` and `updates.css` followed on 2026-08-25 — see "The
updates page was also removed" above.

**Only `index.html` loads `main.js`.** The two legal pages load no JavaScript at all — see
"The legal pages" below.

**Path casing.** `assets/Pics/` is capitalised while its siblings are not. Windows and
macOS do not care, but Linux static hosts are case-sensitive, so a reference written as
`assets/pics/...` will 404 in production while working perfectly on your machine. Every
reference in this repo already matches the folder exactly. If you rename the folder to
lowercase for consistency, update all three HTML files with it.

All three pages inline their own copy of the icon sprite, holding only the symbols that page
uses. That keeps each page self-contained with no extra request, at the cost of a little
duplication for the icons they share. `privacy.html` and `terms.html` need exactly one
symbol each; `index.html` holds 22.

### Page sections

| Anchor | Heading | Purpose |
| --- | --- | --- |
| (hero) | سيرفرك مرتب، وانت مرتاح | value prop, primary CTA |
| `#features` | كل اللي يحتاجه سيرفرك | the eight systems, bento grid of 10 cards |
| `#commands` | كل الأوامر | curated command list, 7 groups / 16 rows |
| `#dashboard-features` | ميزات تُدار من الداشبورد | the 3 systems with no slash commands |
| `#stats` | مساعد بالأرقام | public counters (mock, see above) — **`hidden`** |
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
`var(--accent)` usages across the two remaining stylesheets (21 in `styles.css`, 8 in
`legal.css`; measured via `grep -c 'var(--accent)' assets/css/*.css`) — icons, headings, stat
numerals, chips, command names, hairlines, list markers, and the ghost-button hover.
`updates.css` used to contribute 12 more before it was removed with `updates.html`
(2026-08-25); that also took the changelog rail's usage with it.

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

Below 768px the five nav links become a panel under the bar, opened by `.nav__toggle`.
It is a plain disclosure, not a modal: no focus trap, no scroll lock, no overlay.

- **DOM order is brand, button, panel, CTA.** The button sits immediately before the panel
  it controls, so tabbing out of it lands in the menu with no focus management, and DOM,
  visual and focus order agree at *both* breakpoints. No `order` property anywhere. This
  is why the button is inboard of the CTA rather than at the far edge.
- **The panel is hidden with `visibility`, not `opacity` alone.** That is what keeps its
  links out of the tab order and the accessibility tree while closed. Last verified count
  was 2 links closed, 8 open, against the old 6-link nav; unverified since (the nav-link count has moved more than once, first
  when `updates.html` was unlinked, then when `#stats` was hidden, then again when
  `updates.html` was removed outright on 2026-08-25).
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

- **44px is the floor for tap targets.** Footer rows and nav links all sit at or just over
  44px. Several get there through `padding-block` cancelled by a negative margin, so the
  target grew without the layout moving. If you tighten padding for looks, you shrink the
  target. (The updates back link used to be the third example here; it left with
  `updates.html`, 2026-08-25.)
- **Never `display: none` a label that is a control's accessible name.** `.nav__toggle-text`
  (the hamburger button's label) hides its text by clipping it, so it is clipped out of view
  while staying in the accessibility tree. `display: none` there would leave screen readers
  announcing an unlabelled button, since the burger icon is `aria-hidden`. The updates back
  link used to be the example here; it left with `updates.html` (2026-08-25).
- **Contrast has to be measured against the worst case, not the average, on any
  half-transparent panel.** The updates panel used to be the concrete example: it was
  half-transparent, so its small text had to clear 4.5:1 over the *accent glow* behind it,
  not over the plain background, and `--up-faint`/`--up-dim` (5.05:1 / 4.81:1 in the glow)
  looked darker than necessary in isolation because that was never where they had to
  survive. That page is gone (2026-08-25) and nothing on the site currently has a
  half-transparent text panel, but the sticky nav (`background: rgb(8 10 9 / 0.82)`,
  `backdrop-filter: blur(14px)`) is the same shape — re-apply this check the moment anything
  adds text contrast requirements over it.
- **Line length is capped.** `legal.css`'s `--doc-measure: 68ch` caps the privacy/terms
  prose column for the same reason: past a certain width the eye loses the line return.
  `updates.html`'s `.rel__item` used to cap at the same `68ch` for its changelog bullets;
  that page is gone (2026-08-25), but the principle — and the exact measure — live on here.
- **Latin code tokens inside RTL text are isolated *and* realigned.** Every Latin
  `.cmd__name` and every Latin `.chip` carries `dir="ltr"` so the leading slash stays on
  the left instead of being reordered by the surrounding Arabic. `dir` also flips the
  block's own alignment, so `.cmd__name` sets `text-align: end` — which resolves against
  the element's own `ltr` direction and therefore means *right*, putting the names on the
  page's reading edge while their characters still run left to right. Verified: all five
  name right-edges in the first group share one x at both 375px and 1200px. Dropping
  either half brings back a zigzag, or a slash on the wrong side. `/اختصار` is the one
  exception, and it isn't a bug: it's genuinely Arabic, so reversing it with `dir="ltr"`
  would be wrong rather than merely inconsistent. It gets `.cmd__name--ar` instead —
  `text-align: start`, which lands on the *same* right edge because the element is left at
  its natural RTL direction, plus a swap off `--mono` (no Arabic glyphs) the same way
  `.chip--ar` handles Arabic in a chip.

Two width limits, both measured rather than inferred:

- **320px** is where the nav bar breaks first. It has about 6px of slack, so widening the
  brand, the menu button or the CTA overflows there before it shows anywhere else.
- **768px** is where the nav links first share one line with the brand and the CTA. There
  are **four** links now, not six — `التحديثات` and `الأرقام` were both removed. Measured
  slack: **191.5px** (2026-08-17), with every link clearing 44×44. The old **69.8px** figure
  was taken against the six-link nav and no longer applies; at four links the binding
  constraint is 320px, not this breakpoint.

Everything above was measured in a real browser at 320, 375, 390, 412, 768, 860, 900, 1024
and 1440px, across all five pages (now four — `updates.html` was removed 2026-08-25; this
count is stale by one page and hasn't been rerun since): **154 assertions (2026-08-17)**.
The menu's 17 behaviour assertions were not part of that run and have not been re-verified
since 2026-08-05.

Verify with:

```bash
grep -rn "min-height: 44px" assets/css/
grep -rn "clip-path: inset(50%)" assets/css/
grep -o 'dir="ltr"' index.html | wc -l  # 27: 16 command names + 11 Latin chips (16 rows total; every name is Latin now)
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
| `musaed-avatar.png` | 1024x1024 | brand mark in the landing nav and footer (30px), and in the legal-page bars (25px). Also the `apple-touch-icon` |
| `musaed-favicon.png` | 512x512 | `rel="icon"` on all four pages |
| `musaed-banner.png` | 960x540 | **not wired up yet.** See below |

Both marks are fully transparent outside the glyph, so they sit on the dark chrome with no
plate behind them. The nav mark used to be a filled accent square with a م typed into it;
the real logo replaces both the square and the letter.

`musaed-banner.png` is the `og:image`, the card that renders when the site is linked in
Discord, Twitter or Slack. All four pages carry a full Open Graph + Twitter card block
with a `summary_large_image` card, plus a `canonical` link.

### The hardcoded domain

Social crawlers reject relative URLs, so the site URL is written literally into
`og:url`, `og:image`, `twitter:image` and `canonical` on **all four pages** (index,
connect, privacy, terms — was five until `updates.html` was removed 2026-08-25):

```text
https://musaed.dev
```

There are **sixteen** occurrences, four per page: `canonical`, `og:url`, `og:image` and
`twitter:image`. (`404.html` carries none of them — an error page has no canonical address.
This was twenty across five pages before the removal above.) If you move again, find and
replace the host across all four HTML files, **and by hand in `sitemap.xml` and
`robots.txt`**, which hold absolute URLs but are invisible to the `*.html` grep below. Then
re-check all sixteen, because each page's `og:url` and `canonical` are page-specific
(`/`, `/privacy.html`, `/terms.html`, `/connect.html`) while the two image URLs are shared:

```bash
grep -ohE 'https://[a-z0-9.-]+' *.html | sort -u
```

That should print exactly four hosts: the site's, `discord.gg` for the community invite,
`discord.com` for the bot-invite URL and the link to Discord's own terms, and
`dashboard.musaed.dev` for the dashboard.

**This has already bitten twice, in opposite directions.** First the site moved from
`musaed-web-production.up.railway.app` and the old host started returning 404, so every
social card pointed at a dead image until the metadata was updated — that kind announces
itself. Then on 2026-08-08 it moved from `musaed.up.railway.app` to `musaed.dev` while the
old host kept serving the identical site, so nothing looked wrong at all and `canonical`
quietly published the branded domain as a duplicate of its own Railway URL. That kind does
not announce itself, and this file went a further ten days still naming the old host — which
is what the paragraph above is for. `musaed.up.railway.app` is retired as of 2026-08-18; do
not reintroduce it. A domain change is not done when the site loads at the new address; it is
done when all sixteen URLs, plus `sitemap.xml` and `robots.txt`, are updated.

One note on the card: the banner is **960x540**. It renders fine, but `1200x630` is the
size every platform optimises for. Worth regenerating at that size when convenient.

Verified live at the current host: `/` and the banner both return 200, and the banner serves
as `image/png` (30 KB) rather than an HTML error page. `/privacy.html` and `/terms.html`
were added after that check and go live on the next deploy — **re-verify them
before pasting either into Discord's Developer Portal**, because the portal rejects a URL
that does not resolve.

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

One thing to confirm before launch, outside this repo:

- **The invite has to actually work.** If the bot's commands are still published to a single
  development guild rather than globally, adding it to a new server gets you a bot with no
  visible commands — and this page has `ضيف البوت` CTAs pointing at that experience.
