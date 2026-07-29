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
- makes **no** network requests at runtime (verify: `grep -rn "fetch(" assets/js/`)
- reads **no** environment variables. There is no `DATABASE_URL`, no `DISCORD_BOT_TOKEN`,
  no secrets of any kind, and no code path that could consume one
- imports **no** database, Discord, or auth libraries. No SQLAlchemy, no asyncpg,
  no discord.py, no session handling, no OAuth flow
- has no dependencies at all. Fonts and icons are vendored into `assets/`

If a future change needs live numbers, it must go through a **separate, purpose-built
public endpoint** that returns aggregate counts only. Never `guild_id`, never per-server
rows, never member identities. See "Placeholder data" below for where that would plug in.

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

`readStats()` in [assets/js/main.js](assets/js/main.js) is the single seam. It currently
returns the hard-coded object. Swap its body for a `fetch` against your public endpoint,
keep the same return shape, and every consumer downstream (formatting, the count-up
animation, reduced-motion fallback) keeps working untouched. A worked example is in the
comment directly above the function.

Make `initStats()` await it, and give the counters a sensible value if the request fails.
The endpoint must be a public aggregate API. Not the bot's database.

### Placeholder links

Nine anchors still need a real destination. All are tagged:

```bash
grep -rn "data-placeholder-link" index.html
```

| Marker | Count | Needs |
| --- | --- | --- |
| `discord-invite` | 3 | the bot-invite URL (nav, hero, about section) |
| `status` | 1 | a status page |
| `changelog` | 1 | a changelog / updates page |
| `privacy` | 1 | a privacy policy |
| `terms` | 1 | terms of use |
| `email` | 2 | the contact address (footer + developer page). Also change `href` to `mailto:` |

The footer rows came from a reference design and are **claims about the product, not just
missing URLs**. Before launch, either give each one a real page or delete the row.

- `privacy` and `terms` are legal pages. An unwired link to a privacy policy is worse
  than no link at all.
- `status` renders with the accent colour, matching the reference. It is styled as a link
  to a status page, not as a live up/down indicator, so it asserts nothing about current
  uptime.

Pricing and refund-policy rows were in the reference but have been removed: Musaed is not
presented as a paid product anywhere on this site.

The community server link (`https://discord.gg/QvNXvDDFtz`) is **live, not a
placeholder**. It appears twice: the من نحن section and the footer. It is deliberately
untagged so the guard below leaves it alone.

While `href="#"`, a small guard in `main.js` swallows the click so the page does not jump
to the top, and logs which link is unwired. Once you set real URLs, that guard stops
applying on its own (it only targets `href="#"`).

### The developer page

`developer.html` is a second page, reached from `المطور` in the footer. It shares
`styles.css` (tokens, fonts, reset, reveals) and `main.js` (reveal observer, placeholder
guard), and adds `developer.css` + `developer.js` on top.

**It contains no real identity, because none was supplied.** Everything personal is
tagged `data-placeholder` and needs your details before launch:

```bash
grep -rn "data-placeholder=" developer.html
```

| Marker | What to replace |
| --- | --- |
| `avatar` | a square image at `assets/Pics/developer.png`. Swap the `.avatar__ring` block for the `<img>` shown in the comment above it. A monogram renders until you do |
| `dev-name` | the heading currently reads `المطوّر`. Put a real name or handle here |
| `dev-bio` | two paragraphs written about the project, not about a person. Rewrite in your own voice |
| `dev-quote` | the signed line at the bottom of the panel |

The **skill bar technologies are real** (they are what Musaed runs on) but **every
percentage is invented**. Edit `data-skill` and the visible label together, they are
independent on purpose: the last row is a joke that displays `1000%` while filling the
track to 100%. `developer.js` clamps anything above 100 so it cannot overflow.

The three tiles (`أفكار`, `سهرات`, `فنجان قهوة`) are jokes in the spirit of the original
reference. The coffee count and the launch year carry `data-mock="true"`.

**Palette.** The layout came from a reference that used a rose/pink accent. This page uses
the site's green instead so it reads as part of Musaed rather than a separate product. To
switch, change `--dev-a` and `--dev-b` at the top of `developer.css`; the reference values
are in the comment beside them. Nothing else needs touching.

### Other things to fill in

- `og:image` is not set. Add one plus `og:url` once the site has a domain.
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
developer.html             the developer page, plus its own sprite
assets/css/styles.css      tokens, reset, shared components, landing page
assets/css/developer.css   developer page only, loaded after styles.css
assets/js/main.js          stats data, count-up, scroll reveals, link guard
assets/js/developer.js     skill bars, loaded after main.js
assets/fonts/              self-hosted woff2, no external font requests
assets/Pics/               images. Note the capital P, see below
```

**Path casing.** `assets/Pics/` is capitalised while its siblings are not. Windows and
macOS do not care, but Linux static hosts are case-sensitive, so a reference written as
`assets/pics/...` will 404 in production while working perfectly on your machine. Every
reference in this repo already matches the folder exactly. If you rename the folder to
lowercase for consistency, update both `index.html` and `developer.html` with it.

Both pages inline their own copy of the icon sprite, holding only the symbols that page
uses. That keeps each page self-contained with no extra request, at the cost of a little
duplication for the icons they share.

### Page sections

| Anchor | Heading | Purpose |
| --- | --- | --- |
| (hero) | سيرفرك مرتب، وانت مرتاح | value prop, primary CTA |
| `#features` | كل اللي يحتاجه سيرفرك | the four systems, bento grid |
| `#stats` | مساعد بالأرقام | public counters (mock, see above) |
| `#about` | مبني لمجتمعات عربية | about the **bot**: Arabic-first, tenant-isolated |
| `#about-us` | من نحن | about the **project and people**, plus the community server |

`#about` and `#about-us` are intentionally separate. The first positions the product,
the second introduces who is behind it. The copy in `#about-us` is written in neutral
project voice and asserts no names, dates, or team size. If you want it to read as a
solo maintainer, or to carry your handle, that is the section to edit.

### The Discord mark

`assets/Pics/Discord-Icon.png` (100x100, transparent) is the real Discord logo. It renders
in six places:

| Where | Class | Size |
| --- | --- | --- |
| `ضيف البوت` CTA, nav | `.btn__logo` in `.btn--sm` | 16px |
| `ضيف البوت` CTA, hero and about | `.btn__logo` | 18px |
| `ادخل سيرفرنا` CTA, community panel | `.btn__logo` | 18px |
| `سيرفر مساعد` community panel icon | `.community__logo` | 44px |
| developer page social button | `.social img` | 22px |

It ships in full colour, which is the brand-correct default. Against the green button
blurple is a strong contrast; Discord's guidelines also permit solid black and solid white
marks, and both are one uncommented line in the `.btn__logo` rule in `styles.css`.

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

### Motion, in two layers

**1. Entry reveals (baseline, works everywhere).** `IntersectionObserver` in `main.js`
adds `.is-in` once, and CSS transitions the element in. One-shot by design: content does
not fade back out when you scroll up. Siblings inside `.bento`, `.stats`, `.team`, and
`.about` are staggered 80ms apart; the hero keeps its hand-tuned delays via an inline
`--d`.

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

### Vendored assets

- Icons: [Phosphor Icons](https://phosphoricons.com) "regular" set (MIT), inlined as an
  SVG sprite in `index.html`. The paths are copied verbatim from `@phosphor-icons/core`.
- Fonts: IBM Plex Sans Arabic and IBM Plex Mono (SIL Open Font License 1.1), subset files
  taken from Fontsource.

---

## What this site still needs

The one asset it does not have is **real screenshots of the bot in action**: a moderation
command running, an automod catch, a welcome message. A showcase page for a Discord bot is
much stronger showing the product than describing it. Drop them in and add a section
between the features grid and the stats band.
