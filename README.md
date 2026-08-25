# Musaed Website

The website for **مساعد (Musaed)**, an Arabic Discord moderation bot. This is the marketing
site that explains the bot to server owners — it's not the bot itself, and it's not the
dashboard.

🔗 Live at [musaed.dev](https://musaed.dev)

## What it's built with

Plain HTML, CSS, and JavaScript. No frameworks, no build step, no dependencies to install.

## Running it locally

You need a local server, since opening the HTML file directly in a browser will block the
fonts from loading.

```bash
# Python (usually already installed)
python -m http.server 8000

# or Node
npx serve .
```

Then open [http://localhost:8000](http://localhost:8000) in your browser.

## Project structure

```text
index.html      the main landing page
privacy.html    privacy policy
terms.html      terms of use
connect.html    the screen shown before logging into the dashboard
404.html        the not-found page

assets/css/     stylesheets
assets/js/      site scripts
assets/fonts/   the fonts used on the site
assets/Pics/    logos and images
```

## Deploying

There's nothing to build. Upload the folder as-is to any static hosting provider
(Cloudflare Pages, Netlify, Vercel, etc.) and it works.

## Links

- Website: [musaed.dev](https://musaed.dev)
- Dashboard: [dashboard.musaed.dev](https://dashboard.musaed.dev)
- Community: [discord.gg/QvNXvDDFtz](https://discord.gg/QvNXvDDFtz)
