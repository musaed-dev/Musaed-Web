(() => {
  'use strict';

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const chipBar = matchMedia('(max-width: 1023px)');
  document.documentElement.classList.add('gd-ready');

  // Arabic-insensitive matching: drop diacritics and tatweel, fold the alef, ya and ta marbuta variants.
  const norm = s => String(s || '').toLowerCase()
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[\s\-_/]+/g, ' ')
    .trim();

  const matches = (hay, query) => {
    const words = norm(query).split(' ').filter(Boolean);
    return words.length > 0 && words.every(w => hay.includes(w));
  };

  /* ---------- Reading progress, contents highlight, back to top (guide pages) ---------- */
  const body = document.querySelector('.lg-body');
  if (body) {
    const bar = document.querySelector('.lg-progress i');
    const topBtn = document.querySelector('.lg-top');
    const links = [...document.querySelectorAll('.lg-toc a')];
    const sections = links.map(a => document.getElementById(decodeURIComponent(a.hash.slice(1))));
    let current = -1;
    let ticking = false;

    const update = () => {
      ticking = false;
      const vh = innerHeight;
      const r = body.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, (vh * .35 - r.top) / Math.max(1, r.height - vh * .5)));
      if (bar) bar.style.setProperty('--p', p.toFixed(4));

      if (links.length) {
        let idx = 0;
        sections.forEach((s, i) => { if (s && s.getBoundingClientRect().top < vh * .32) idx = i; });
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
      }
      if (topBtn) topBtn.classList.toggle('show', scrollY > 700);
    };

    addEventListener('scroll', () => {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    addEventListener('resize', update);
    if (topBtn) topBtn.addEventListener('click', () => scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }));
    update();
  }

  /* ---------- Page tabs: bring the current one into view on a narrow screen ---------- */
  const curTab = document.querySelector('.gd-tabs a[aria-current="page"]');
  if (curTab) {
    const list = curTab.closest('ul');
    const a = curTab.getBoundingClientRect();
    const l = list.getBoundingClientRect();
    list.scrollBy({ left: a.left + a.width / 2 - (l.left + l.width / 2) });
  }

  /* ---------- Hub search ---------- */
  const hubInput = document.getElementById('gd-q');
  const hubList = document.getElementById('gd-results');
  const hubEmpty = document.getElementById('gd-empty');
  if (hubInput && hubList && hubEmpty) {
    // One entry per section a person might be looking for. u is relative to guide/.
    const INDEX = [
      { t: 'أضف مساعد لسيرفرك', d: 'الرابط، والصلاحيات اللي يطلبها، وليش.', u: 'start.html#add', p: 'البداية', k: 'اضافه دعوه رابط invite administrator صلاحيات اضافة بوت' },
      { t: 'رتبة مساعد فوق الرتب', d: 'ليش لازم ترفع رتبة مساعد، وكيف.', u: 'start.html#roles', p: 'البداية', k: 'ترتيب الرتب فوق رتبتي رتبه role hierarchy' },
      { t: 'لوحة التحكم', d: 'كيف تدخل وتغيّر الإعدادات، ومين يقدر.', u: 'start.html#dashboard', p: 'البداية', k: 'dashboard دخول تسجيل اعدادات صلاحيات manage server' },
      { t: 'وش تضبط أول؟', d: 'ترتيب مقترح للميزات، وأي منها شغّال لحاله.', u: 'start.html#setup', p: 'البداية', k: 'اول خطوات اعداد مبدئي ترتيب افتراضي' },
      { t: 'افحص سيرفرك بـ /checkup', d: 'يقولك وش المعطّل وكيف تصلحه.', u: 'start.html#checkup', p: 'البداية', k: 'checkup فحص السيرفر تنبيه معطل' },

      { t: 'بوابة العمر', d: 'يطرد الحسابات الجديدة جدًا أول ما تدخل.', u: 'protection.html#agegate', p: 'الحماية', k: 'عمر الحساب طرد اقل عمر حسابات جديده age gate' },
      { t: 'الكابتشا', d: 'تحدي للأعضاء الجدد قبل ما يدخلون.', u: 'protection.html#captcha', p: 'الحماية', k: 'تحقق captcha مسالة حسابيه زر رتبه غير المتحقق قفل lockdown' },
      { t: 'قناة الفخ', d: 'قناة ما يكتب فيها إلا البوتات والحسابات المخترقة.', u: 'protection.html#honeypot', p: 'الحماية', k: 'honeypot فخ بوتات مخترقه كتم حظر سبام' },
      { t: 'الحماية التلقائية', d: 'الكلمات الممنوعة والسبام.', u: 'protection.html#automod', p: 'الحماية', k: 'automod كلمات ممنوعه سبام فلتر قائمه فريق مساعد حذف' },
      { t: 'الحماية من التخريب', d: 'يوقف اللي يحذف قنوات أو رتب أو يحظر بالجملة.', u: 'protection.html#antinuke', p: 'الحماية', k: 'antinuke تخريب هجوم nuke حذف قنوات رتب حظر سحب رتب ويب هوك webhook اضافه بوت everyone صلاحيات' },

      { t: 'التذاكر', d: 'لوحة بقائمة أنواع، وروم خاص لكل طلب.', u: 'toolkit.html#tickets', p: 'الأدوات', k: 'tickets تذاكر دعم لوحه رتبة الدعم سجل' },
      { t: 'الاختصارات', d: 'كلمة وحدة تنفّذ حظر أو طرد أو كتم.', u: 'toolkit.html#shortcuts', p: 'الأدوات', k: 'shortcuts اختصار كلمه حظر طرد كتم فك كتم' },
      { t: 'الردود التلقائية', d: 'رد جاهز على الأسئلة المتكررة.', u: 'toolkit.html#autoresponse', p: 'الأدوات', k: 'ردود تلقائيه رد جاهز كلمه اسئله ملف صوره pdf مرفق' },
      { t: 'الترحيب والوداع والرتب التلقائية', d: 'رسالة لكل داخل، ووداع، ورتبة تلقائية.', u: 'toolkit.html#welcome', p: 'الأدوات', k: 'welcome ترحيب وداع رتبه تلقائيه autorole متغيرات صوره الترحيب بطاقه خلفيه' },
      { t: 'سجل الإجراءات', d: 'كل طرد وحظر وكتم وإنذار مسجّل.', u: 'toolkit.html#modlog', p: 'الأدوات', k: 'سجل اجراءات modlogs lookup انذار' },
      { t: 'سجل الأحداث', d: 'الرسايل المحذوفة والمعدّلة والدخول والخروج بقناة وحدة.', u: 'toolkit.html#serverlog', p: 'الأدوات', k: 'server log سجل احداث رسايل محذوفه معدله' },
      { t: 'فحص السيرفر', d: 'تنبيه لو ميزة مفعّلة وقفت عن الشغل.', u: 'toolkit.html#checkup', p: 'الأدوات', k: 'checkup فحص تنبيهات قناه التنبيهات' },
      { t: 'لوحة الرتب', d: 'أزرار يختار منها الأعضاء رتبهم بأنفسهم.', u: 'toolkit.html#selfroles', p: 'الأدوات', k: 'self roles لوحه الرتب ازرار رتبه اختيار ايموجي' },

      { t: 'الأوامر', d: 'كل أوامر السلاش وصلاحية كل أمر.', u: 'commands.html', p: 'الأوامر', k: 'اوامر slash commands صلاحيات kick ban timeout warn' },
      { t: 'كيف تكتب المدة', d: '30m و 1h30m و 7d وغيرها.', u: 'commands.html#duration', p: 'الأوامر', k: 'مده duration timeout كتم دقايق ساعات ايام' },

      { t: 'مساعد يقول الرتبة فوق رتبتي', d: 'ارفع رتبة مساعد فوقها.', u: 'troubleshooting.html#roles-above', p: 'حل المشاكل', k: 'فوق رتبتي رتبه hierarchy ما اقدر اعطيها' },
      { t: 'ما أقدر أشغّل الميزة', d: 'فيه حقول لازم تعبيها أول.', u: 'troubleshooting.html#cant-enable', p: 'حل المشاكل', k: 'ما يشتغل ما ينحفظ مطلوب شرط تفعيل' },
      { t: 'غيّرت إعداد وما تغيّر شي', d: 'ممكن ياخذ لحظات، أو فيه شي معطّل.', u: 'troubleshooting.html#not-applied', p: 'حل المشاكل', k: 'ما تغير ما اشتغل تاخر انتظار تحديث' },
      { t: 'القفل ما يخفي القنوات', d: 'شغّل /captcha lockdown مرة ثانية.', u: 'troubleshooting.html#lockdown', p: 'حل المشاكل', k: 'lockdown قفل قنوات غير المتحقق رتبه' },
      { t: 'انطرد أو انحظر عضو بالغلط', d: 'كيف تعرف السبب وترجعه.', u: 'troubleshooting.html#mistake', p: 'حل المشاكل', k: 'بالغلط فك حظر unban lookup modlogs ظلم' },
      { t: 'انحذفت رسالة وما فيها شي', d: 'القائمة الجاهزة ممكن تغلط، وتقدر تطفيها.', u: 'troubleshooting.html#false-positive', p: 'حل المشاكل', k: 'حذف رسالة غلط كلمه ممنوعه قائمه فريق' },
    ].map(e => ({ ...e, h: norm(`${e.t} ${e.d} ${e.p} ${e.k}`) }));

    const render = q => {
      hubList.textContent = '';
      if (!norm(q)) {
        hubList.hidden = true;
        hubEmpty.hidden = true;
        return;
      }
      const hits = INDEX.filter(e => matches(e.h, q)).slice(0, 8);
      hubEmpty.hidden = hits.length > 0;
      hubList.hidden = hits.length === 0;
      hits.forEach((e, i) => {
        const li = document.createElement('li');
        li.style.setProperty('--i', i);
        const a = document.createElement('a');
        a.href = e.u;
        const t = document.createElement('strong');
        t.textContent = e.t;
        const d = document.createElement('span');
        d.textContent = e.d;
        const p = document.createElement('small');
        p.textContent = e.p;
        a.append(t, d, p);
        li.append(a);
        hubList.append(li);
      });
    };

    hubInput.addEventListener('input', () => render(hubInput.value));
    hubInput.closest('form').addEventListener('submit', e => {
      e.preventDefault();
      const first = hubList.querySelector('a');
      if (first) first.click();
    });
  }

  /* ---------- Hub motion ---------- */
  if (document.body.classList.contains('guide-hub')) {
    // Scroll reveals. Once an element has arrived it drops the reveal class, so its
    // hover transitions are not held back by the reveal's stagger delay.
    const items = [...document.querySelectorAll('.reveal')];
    const settle = el => {
      el.classList.remove('reveal', 'in');
      el.style.removeProperty('--i');
    };
    const show = el => {
      el.classList.add('in');
      let done = false;
      const finish = () => { if (!done) { done = true; settle(el); } };
      el.addEventListener('transitionend', e => { if (e.target === el && e.propertyName === 'opacity') finish(); });
      setTimeout(finish, 2200);
    };
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(entries => {
        entries.forEach(en => {
          if (!en.isIntersecting) return;
          io.unobserve(en.target);
          show(en.target);
        });
      }, { threshold: .15, rootMargin: '0px 0px -6% 0px' });
      items.forEach(el => io.observe(el));
    } else {
      items.forEach(show);
    }

    // The title arrives word by word. Whole words only, so Arabic joining is never cut.
    const title = document.querySelector('.lg-title');
    if (title && !reduce) {
      const words = title.textContent.trim().split(/\s+/);
      title.textContent = '';
      words.forEach((w, i) => {
        const s = document.createElement('span');
        s.className = 'gd-word';
        s.style.setProperty('--w', i);
        s.textContent = w;
        title.append(s, ' ');
      });
    }

    // A spotlight on each card that follows the pointer.
    if (matchMedia('(hover: hover)').matches) {
      document.querySelectorAll('.gd-card').forEach(card => {
        card.addEventListener('pointermove', e => {
          const r = card.getBoundingClientRect();
          card.style.setProperty('--mx', `${e.clientX - r.left}px`);
          card.style.setProperty('--my', `${e.clientY - r.top}px`);
        });
      });
    }

    // The search box types example searches until someone uses it.
    if (hubInput && !reduce) {
      const base = hubInput.getAttribute('placeholder');
      const lead = 'ابحث، مثلًا: ';
      const samples = ['كابتشا', 'رتبة مساعد', 'التذاكر', 'قناة الفخ', 'الكلمات الممنوعة', 'فحص السيرفر', 'مدة الكتم'];
      let s = 0;
      let n = 0;
      let typing = true;
      const idle = () => document.activeElement === hubInput || hubInput.value !== '' || document.hidden;
      const tick = () => {
        if (idle()) { hubInput.setAttribute('placeholder', base); setTimeout(tick, 1200); return; }
        const word = samples[s];
        if (typing) {
          n++;
          hubInput.setAttribute('placeholder', lead + word.slice(0, n) + '…');
          if (n >= word.length) { typing = false; setTimeout(tick, 1500); return; }
          setTimeout(tick, 85);
        } else {
          n--;
          hubInput.setAttribute('placeholder', lead + word.slice(0, Math.max(n, 0)) + '…');
          if (n <= 0) { typing = true; s = (s + 1) % samples.length; setTimeout(tick, 350); return; }
          setTimeout(tick, 40);
        }
      };
      setTimeout(tick, 2200);
    }
  }

  /* ---------- Commands filter ---------- */
  const cmdInput = document.getElementById('gd-cmd-q');
  const cmdRows = [...document.querySelectorAll('.gd-cmd')];
  if (cmdInput && cmdRows.length) {
    const chips = [...document.querySelectorAll('.gd-chips button')];
    const empty = document.getElementById('gd-cmd-empty');
    let cat = 'all';
    const hay = new Map(cmdRows.map(r => [r, norm(r.textContent)]));

    const apply = () => {
      let shown = 0;
      cmdRows.forEach(r => {
        const okCat = cat === 'all' || r.dataset.cat === cat;
        const q = norm(cmdInput.value);
        const okText = !q || matches(hay.get(r), q);
        r.hidden = !(okCat && okText);
        if (!r.hidden) shown++;
      });
      if (empty) empty.hidden = shown > 0;
    };

    cmdInput.addEventListener('input', apply);
    cmdInput.closest('form').addEventListener('submit', e => e.preventDefault());
    chips.forEach(b => b.addEventListener('click', () => {
      cat = b.dataset.cat;
      chips.forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      apply();
    }));
  }
})();
