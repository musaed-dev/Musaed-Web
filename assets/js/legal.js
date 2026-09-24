(() => {
  'use strict';

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const chipBar = matchMedia('(max-width: 1023px)');
  const bar = document.querySelector('.lg-progress i');
  const body = document.querySelector('.lg-body');
  const topBtn = document.querySelector('.lg-top');
  const links = [...document.querySelectorAll('.lg-toc a')];
  const sections = links.map(a => document.getElementById(decodeURIComponent(a.hash.slice(1))));
  let current = -1;
  let ticking = false;

  function update() {
    ticking = false;
    const vh = innerHeight;
    const r = body.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, (vh * .35 - r.top) / (r.height - vh * .5)));
    bar.style.setProperty('--p', p.toFixed(4));

    let idx = 0;
    sections.forEach((s, i) => { if (s.getBoundingClientRect().top < vh * .32) idx = i; });
    if (idx !== current) {
      current = idx;
      links.forEach((a, i) => {
        a.classList.toggle('active', i === idx);
        if (i === idx) a.setAttribute('aria-current', 'location');
        else a.removeAttribute('aria-current');
      });
      if (chipBar.matches) {
        const list = links[idx].closest('ol');
        const a = links[idx].getBoundingClientRect();
        const l = list.getBoundingClientRect();
        list.scrollBy({ left: a.left + a.width / 2 - (l.left + l.width / 2), behavior: reduce ? 'auto' : 'smooth' });
      }
    }

    topBtn.classList.toggle('show', scrollY > 700);
  }

  addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }, { passive: true });
  addEventListener('resize', update);
  topBtn.addEventListener('click', () => scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }));
  update();
})();
