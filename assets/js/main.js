(() => {
  'use strict';

  const STATS_ENDPOINT = 'https://dashboard.musaed.dev/api/public/stats';
  const STATS_TTL_MS = 5 * 60 * 1000;
  const STATS_BACKOFF_MS = 15 * 60 * 1000;
  const STATS_CACHE_KEY = 'musaed:stats';

  const I = window.MUSAED_I18N;
  const root = document.documentElement;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const wait = ms => new Promise(r => setTimeout(r, ms));

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function onVisible(target, cb, opts = {}) {
    new IntersectionObserver(entries => entries.forEach(e => cb(e.isIntersecting)), opts).observe(target);
  }

  /* ---------- Language ---------- */
  let lang = root.lang === 'ar' ? 'ar' : 'en';
  const D = () => I.dyn[lang];
  const langListeners = [];
  const onLang = fn => langListeners.push(fn);

  const textNodes = $$('[data-i18n]').map(n => ({ n, key: n.dataset.i18n, en: n.innerHTML }));
  const attrNodes = $$('[data-i18n-attr]').flatMap(n =>
    n.dataset.i18nAttr.split(',').map(pair => {
      const [attr, key] = pair.split(':');
      return { n, attr, key, en: n.getAttribute(attr) };
    }));

  function applyLang() {
    root.lang = lang;
    root.dir = lang === 'ar' ? 'rtl' : 'ltr';
    const pick = (key, en) => (lang === 'ar' && I.ar[key] != null ? I.ar[key] : en);
    textNodes.forEach(({ n, key, en }) => { n.innerHTML = pick(key, en); });
    attrNodes.forEach(({ n, attr, key, en }) => n.setAttribute(attr, pick(key, en)));
    document.title = D().title;
    $$('[data-lang-toggle]').forEach(b => {
      b.setAttribute('aria-label', D().langAria);
      $('[data-lang-label]', b).setAttribute('lang', lang === 'ar' ? 'en' : 'ar');
      $('[data-lang-label]', b).textContent = D().langLabel;
    });
    langListeners.forEach(fn => fn());
  }

  $$('[data-lang-toggle]').forEach(b => b.addEventListener('click', () => {
    lang = lang === 'ar' ? 'en' : 'ar';
    try { localStorage.setItem('musaed-lang', lang); } catch (e) { /* storage blocked */ }
    applyLang();
  }));

  /* ---------- Live stats (endpoint only allows the musaed.dev origin) ---------- */
  (function liveStats() {
    const line = $('[data-live-stats]');
    const lineText = $('[data-live-text]');
    const status = $('[data-bot-status]');
    const statusText = $('[data-status-text]');
    let data = null;

    const readCache = () => { try { return JSON.parse(sessionStorage.getItem(STATS_CACHE_KEY)); } catch (e) { return null; } };
    const writeCache = entry => { try { sessionStorage.setItem(STATS_CACHE_KEY, JSON.stringify(entry)); } catch (e) { /* storage blocked */ } };

    function render() {
      if (!data) return;
      if (Number.isFinite(data.guild_count) && Number.isFinite(data.member_count) && data.guild_count > 0) {
        lineText.textContent = D().live(data.guild_count, data.member_count);
        line.hidden = false;
      }
      if (data.status) {
        const up = data.status === 'up';
        statusText.textContent = D().status(up);
        status.classList.toggle('down', !up);
        status.hidden = false;
      }
    }

    async function load() {
      const cache = readCache();
      const now = Date.now();
      if (cache && cache.data) { data = cache.data; render(); }
      if (cache && (now - cache.at < STATS_TTL_MS || now < (cache.retryAt || 0))) return;
      try {
        const res = await fetch(STATS_ENDPOINT, { headers: { Accept: 'application/json' } });
        if (!res.ok) {
          const retry = Number(res.headers.get('Retry-After')) * 1000 || STATS_BACKOFF_MS;
          writeCache({ at: now, retryAt: now + retry, data: cache && cache.data });
          return;
        }
        data = await res.json();
        writeCache({ at: now, data });
        render();
      } catch (e) {
        writeCache({ at: now, retryAt: now + STATS_BACKOFF_MS, data: cache && cache.data });
      }
    }

    onLang(render);
    load();
  })();

  /* ---------- Nav ---------- */
  const nav = $('#nav');
  const menuBtn = $('.menu-btn');
  const menu = $('#mobile-menu');
  const setMenu = open => {
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? D().navClose : D().navOpen);
    menu.hidden = !open;
    nav.classList.toggle('open', open);
  };
  menuBtn.addEventListener('click', () => setMenu(menuBtn.getAttribute('aria-expanded') !== 'true'));
  $$('a', menu).forEach(a => a.addEventListener('click', () => setMenu(false)));
  addEventListener('keydown', e => {
    if (e.key === 'Escape' && !menu.hidden) { setMenu(false); menuBtn.focus(); }
  });
  onLang(() => setMenu(!menu.hidden));

  /* ---------- Hero grid spotlight ---------- */
  if (fine && !reduce) {
    const hero = $('.hero');
    const grid = $('.hero .grid');
    hero.addEventListener('pointermove', e => {
      const r = grid.getBoundingClientRect();
      grid.style.setProperty('--mx', `${e.clientX - r.left}px`);
      grid.style.setProperty('--my', `${e.clientY - r.top}px`);
    });
    hero.addEventListener('pointerleave', () => {
      grid.style.setProperty('--mx', '-500px');
      grid.style.setProperty('--my', '-500px');
    });
  }

  /* ---------- Join-gate demo ---------- */
  (function gateDemo() {
    const demo = $('[data-demo]');
    const track = $('[data-track]');
    const station = k => $(`[data-station="${k}"]`, track);
    const logOf = k => $(`[data-log="${k}"]`, track);
    const statEls = { joined: $('[data-stat="joined"]'), verified: $('[data-stat="verified"]'), stopped: $('[data-stat="stopped"]') };
    const stats = { joined: 0, verified: 0, stopped: 0 };
    const bump = k => { stats[k]++; statEls[k].textContent = stats[k]; };
    const tokens = new Set();
    const logTimers = {};
    let running = false, spawnTimer = 0, idx = 0, gen = 0;

    const vertical = () => getComputedStyle(track).gridTemplateColumns.trim().split(/\s+/).length === 1;

    function target(tok, key) {
      const tr = track.getBoundingClientRect();
      const node = $('.node', station(key)).getBoundingClientRect();
      const w = tok.offsetWidth, h = tok.offsetHeight;
      if (vertical()) {
        const x = root.dir === 'rtl' ? 0 : tr.width - w;
        return { x, y: node.top - tr.top + node.height / 2 - h / 2 };
      }
      return { x: node.left - tr.left + node.width / 2 - w / 2, y: 10 };
    }

    function place(tok, p) {
      tok._p = p;
      tok.style.transform = `translate(${p.x}px, ${p.y}px)`;
    }

    async function move(tok, key, dur) {
      const from = tok._p;
      const to = target(tok, key);
      place(tok, to);
      const anim = tok.animate(
        [{ transform: `translate(${from.x}px, ${from.y}px)` }, { transform: `translate(${to.x}px, ${to.y}px)` }],
        { duration: dur, easing: 'cubic-bezier(.65, 0, .35, 1)' });
      await anim.finished.catch(() => {});
    }

    function makeToken(p) {
      const t = el('div', 'tok');
      const av = el('span', 'av', p.n[0].toUpperCase());
      av.style.setProperty('--c', p.c);
      t.append(av, el('span', 'nm', p.n), el('span', 'age', p[lang]));
      return t;
    }

    function showLog(key, text) {
      const log = logOf(key);
      log.textContent = text;
      log.classList.add('show');
      clearTimeout(logTimers[key]);
      logTimers[key] = setTimeout(() => log.classList.remove('show'), 2600);
    }

    function retire(t) {
      t.classList.add('gone');
      setTimeout(() => { t.remove(); tokens.delete(t); }, 500);
    }

    async function journey(p, g) {
      const t = makeToken(p);
      t.style.opacity = '0';
      track.append(t);
      tokens.add(t);
      place(t, target(t, 'start'));
      requestAnimationFrame(() => requestAnimationFrame(() => { t.style.opacity = ''; }));
      bump('joined');
      const alive = () => g === gen;

      for (const key of ['age', 'captcha', 'honeypot']) {
        await wait(key === 'age' ? 500 : 0);
        if (!alive()) return;
        await move(t, key, 800);
        if (!alive()) return;
        const s = station(key);
        s.classList.add('scanning');
        await wait(key === 'captcha' ? 1000 : 520);
        s.classList.remove('scanning');
        if (!alive()) return;
        if (p.fail === key) {
          s.classList.add('deny');
          t.classList.add('bad');
          showLog(key, D().reason[key](p.long ? p.long[lang] : ''));
          bump('stopped');
          await wait(900);
          s.classList.remove('deny');
          retire(t);
          return;
        }
      }
      await move(t, 'end', 800);
      if (!alive()) return;
      t.classList.add('ok');
      bump('verified');
      await wait(1100);
      retire(t);
    }

    function tick() {
      if (!running) return;
      journey(I.joiners[idx++ % I.joiners.length], gen);
      spawnTimer = setTimeout(tick, 2300);
    }
    function start() { if (running) return; running = true; tick(); }
    function stop() { running = false; clearTimeout(spawnTimer); }
    function reset() {
      gen++;
      tokens.forEach(t => t.remove());
      tokens.clear();
      $$('.station', track).forEach(s => s.classList.remove('scanning', 'deny'));
      $$('.gate-log', track).forEach(l => l.classList.remove('show'));
    }

    if (reduce) {
      const staticState = () => {
        Object.assign(stats, { joined: 9, verified: 5, stopped: 4 });
        Object.keys(stats).forEach(k => { statEls[k].textContent = stats[k]; });
        logOf('age').textContent = D().reason.age(lang === 'ar' ? 'يومين' : '2 days');
        logOf('captcha').textContent = D().reason.captcha();
        logOf('honeypot').textContent = D().reason.honeypot();
        $$('.gate-log', track).forEach(l => l.classList.add('show'));
      };
      staticState();
      onLang(staticState);
      return;
    }

    let inView = false;
    const sync = () => (inView && !document.hidden ? start() : stop());
    onVisible(demo, vis => { inView = vis; sync(); }, { threshold: .25 });
    document.addEventListener('visibilitychange', sync);
    const restart = () => { reset(); if (running) { stop(); start(); } };
    onLang(restart);
    let rt;
    addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(restart, 200); });
  })();

  /* ---------- Reveal ---------- */
  $$('[data-stagger]').forEach(g => [...g.children].forEach((c, i) => c.style.setProperty('--i', i)));
  const revealIO = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.classList.add('in');
      revealIO.unobserve(e.target);
    });
  }, { threshold: .18, rootMargin: '0px 0px -6% 0px' });
  $$('.reveal').forEach(n => revealIO.observe(n));

  /* ---------- Card spotlight ---------- */
  if (fine) {
    $$('.card').forEach(c => c.addEventListener('pointermove', e => {
      const r = c.getBoundingClientRect();
      c.style.setProperty('--x', `${e.clientX - r.left}px`);
      c.style.setProperty('--y', `${e.clientY - r.top}px`);
    }));
  }

  /* ---------- Member DM progress ---------- */
  (function dmProgress() {
    const card = $('.c-dms');
    const count = $('[data-dm-count]', card);
    const bar = $('.dms-bar', card);
    const TOTAL = 1204;
    let sent = 0, timer = 0;
    const draw = () => {
      count.textContent = sent.toLocaleString('en-US');
      bar.style.setProperty('--p', (sent / TOTAL).toFixed(4));
    };
    if (reduce) { sent = 642; draw(); return; }
    const step = () => {
      sent = Math.min(TOTAL, sent + 3 + Math.floor(Math.random() * 7));
      draw();
      if (sent >= TOTAL) {
        timer = setTimeout(() => { sent = 0; draw(); step(); }, 1800);
        return;
      }
      timer = setTimeout(step, 70);
    };
    onVisible(card, vis => {
      clearTimeout(timer);
      if (vis) step();
    }, { threshold: .3 });
  })();

  /* ---------- Dashboard ---------- */
  (function dashboard() {
    const form = $('[data-dash]');
    const state = { age: true, captcha: true, honeypot: true, days: 7, type: 'math', diff: 'medium', attempts: 3 };
    const diffRow = $('[data-diff-row]', form);
    const range = $('[data-range="age"]', form);
    const outAge = $('[data-out="age"]', form);
    const outAtt = $('[data-out="attempts"]', form);
    const steps = $$('[data-step]', form);
    const prev = k => $(`[data-prev="${k}"]`);
    const synced = $('[data-synced]');
    const embed = prev('title').closest('.embed');
    const restart = (node, cls) => { node.classList.remove(cls); void node.offsetWidth; node.classList.add(cls); };

    function render(flash) {
      const d = D();
      outAge.textContent = d.days(state.days);
      range.setAttribute('aria-valuetext', d.days(state.days));
      outAtt.textContent = state.attempts;

      $$('[data-dep]', form).forEach(row => {
        const on = state[row.dataset.dep];
        row.classList.toggle('off', !on);
        $$('input, button', row).forEach(c => { c.disabled = !on; });
      });
      if (state.captcha) {
        steps[0].disabled = state.attempts <= 1;
        steps[1].disabled = state.attempts >= 10;
      }
      const diffOn = state.captcha && state.type === 'math';
      diffRow.classList.toggle('off', !diffOn);
      $$('input', diffRow).forEach(c => { c.disabled = !diffOn; });

      prev('title').textContent = d.prev.title;
      prev('desc').textContent = !state.captcha ? d.prev.off : state.type === 'math' ? d.prev.math(state.attempts, state.diff) : d.prev.button;
      prev('age').textContent = state.age ? d.prev.age(state.days) : '';
      const btn = prev('btn');
      btn.hidden = !state.captcha;
      btn.textContent = state.type === 'math' ? d.prev.start : d.prev.verify;
      const trap = prev('trap');
      trap.classList.toggle('off', !state.honeypot);
      $('span', trap).textContent = state.honeypot ? d.prev.trapOn : d.prev.trapOff;

      if (flash) {
        restart(synced, 'flash');
        restart(embed, 'bump');
      }
    }

    $$('[data-toggle]', form).forEach(b => b.addEventListener('click', () => {
      const k = b.dataset.toggle;
      state[k] = !state[k];
      b.setAttribute('aria-checked', String(state[k]));
      render(true);
    }));
    range.addEventListener('input', () => { state.days = Number(range.value); render(false); });
    range.addEventListener('change', () => render(true));
    $$('input[name="ctype"]', form).forEach(r => r.addEventListener('change', () => { state.type = r.value; render(true); }));
    $$('input[name="cdiff"]', form).forEach(r => r.addEventListener('change', () => { state.diff = r.value; render(true); }));
    steps.forEach(b => b.addEventListener('click', () => {
      state.attempts = clamp(state.attempts + Number(b.dataset.step), 1, 10);
      render(true);
    }));

    render(false);
    onLang(() => render(false));
  })();

  /* ---------- Commands ---------- */
  (function commands() {
    const list = $('[data-cmd-list]');
    const search = $('[data-cmd-search]');
    const filters = $('[data-cmd-filters]');
    const empty = $('[data-cmd-empty]');
    const CATS = ['all', 'mod', 'verify', 'setup', 'info'];
    let cat = 'all';

    function renderFilters() {
      filters.replaceChildren(...CATS.map(k => {
        const b = el('button', null, D().cats[k]);
        b.type = 'button';
        b.setAttribute('aria-pressed', String(k === cat));
        b.addEventListener('click', () => { cat = k; renderFilters(); renderList(); });
        return b;
      }));
    }

    function renderList() {
      const q = search.value.trim().toLowerCase().replace(/^\//, '');
      const items = I.commands.filter(c =>
        (cat === 'all' || c.cat === cat) &&
        (!q || c.name.includes(q) || c.en.toLowerCase().includes(q) || c.ar.includes(q)));
      list.replaceChildren(...items.map((c, i) => {
        const li = el('li');
        li.style.setProperty('--i', i);
        const top = el('div', 'cmd-top');
        top.append(el('code', null, '/' + c.name), el('span', null, D().cats[c.cat]));
        li.append(top, el('p', null, c[lang]));
        return li;
      }));
      empty.hidden = items.length > 0;
    }

    search.addEventListener('input', renderList);
    renderFilters();
    renderList();
    onLang(() => { renderFilters(); renderList(); });
  })();

  /* ---------- Scroll-linked: nav, stacked layers, finale fill ---------- */
  const layers = $$('.layer');
  const finaleWord = $('.finale-ar');
  let ticking = false;

  function onScroll() {
    ticking = false;
    const vh = innerHeight;
    nav.classList.toggle('scrolled', scrollY > 24);

    const stacked = innerWidth >= 900 && !reduce;
    layers.forEach((l, i) => {
      const next = layers[i + 1];
      if (!stacked || !next) {
        l.style.removeProperty('--s');
        l.style.removeProperty('--b');
        return;
      }
      const stick = 100 + (i + 1) * 22;
      const p = clamp(1 - (next.getBoundingClientRect().top - stick) / (vh * .7), 0, 1);
      l.style.setProperty('--s', (1 - p * .05).toFixed(3));
      l.style.setProperty('--b', (1 - p * .4).toFixed(3));
    });

    if (!reduce) {
      const r = finaleWord.getBoundingClientRect();
      finaleWord.style.setProperty('--fill', clamp((vh * .92 - r.top) / (vh * .55), 0, 1).toFixed(3));
    }
  }
  addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
  }, { passive: true });
  addEventListener('resize', onScroll);

  /* ---------- Boot ---------- */
  applyLang();
  onScroll();
  root.classList.remove('i18n-pending');
  requestAnimationFrame(() => requestAnimationFrame(() => document.body.classList.add('ready')));
})();
