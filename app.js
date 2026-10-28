(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ?helyszin=Borbíróság  → a helyszín, amit te választasz (csak szövegként jelenik meg)
  const params = new URLSearchParams(location.search);
  const VENUE = (params.get('helyszin') || '').trim().slice(0, 80);

  /* ---------- nyelvváltó: magyar mindig látszik, a zászlók az EN / 中文 sorokat kapcsolják ---------- */
  const LS_KEY = 'betti-lang';
  const langs = { en: false, zh: false };
  try { Object.assign(langs, JSON.parse(localStorage.getItem(LS_KEY) || '{}')); } catch { /* nincs tárhely, nem baj */ }

  function applyLangs() {
    document.body.classList.toggle('show-en', !!langs.en);
    document.body.classList.toggle('show-zh', !!langs.zh);
    document.querySelectorAll('.lang').forEach((b) => b.setAttribute('aria-pressed', String(!!langs[b.dataset.lang])));
    try { localStorage.setItem(LS_KEY, JSON.stringify({ en: !!langs.en, zh: !!langs.zh })); } catch { /* ok */ }
  }
  document.querySelectorAll('.lang').forEach((b) => b.addEventListener('click', () => {
    langs[b.dataset.lang] = !langs[b.dataset.lang];
    applyLangs();
  }));
  applyLangs();

  /* ---------- háromnyelvű szövegek ---------- */
  const T = {
    scan: [
      { hu: 'Naptár betöltése… (nem kukucskálok, ígérem)', en: 'Loading calendar… (not peeking, promise)', zh: '正在加载日历…（我不偷看，保证）' },
      { hu: 'Várj… minden foglalt?! 😱', en: 'Wait… is everything booked?!', zh: '等等…全都被订满了？！' },
      { hu: 'Á, csak a naptár pislogott 😅', en: 'Phew, the calendar just blinked.', zh: '哎呀，只是日历在眨眼。' },
    ],
    scanDone: { hu: 'Szabad a pálya! Koppints arra, ami neked tökéletes ✨', en: 'All clear! Tap the one that suits you best.', zh: '畅通无阻！点一下最适合你的那个。' },
    none: { hu: 'Még nem választottál.', en: 'Nothing picked yet.', zh: '还没选。' },
    checking: { hu: 'Ütközések ellenőrzése…', en: 'Checking for clashes…', zh: '正在检查冲突…' },
    clear: { hu: '✔ Nincs ütközés a naptáradban', en: 'No clash in your calendar', zh: '你的日历没有冲突' },
    surprise: { hu: 'Meglepetés 🤫', en: 'Surprise', zh: '惊喜' },
    toastIcs: { hu: 'Naptárfájl letöltve 📅', en: 'Calendar file downloaded', zh: '日历文件已下载' },
    toastCopy: { hu: 'Üzenet kimásolva 💬', en: 'Message copied', zh: '消息已复制' },
    toastFail: { hu: 'Nem sikerült másolni, jelöld ki kézzel', en: 'Copy failed, select it by hand', zh: '复制失败，请手动选择' },
    jokes: [
      { hu: 'A bor nem fogy el. Csak a poharak.', en: 'The wine never runs out. Only the glasses do.', zh: '酒不会喝完，只是杯子会空。' },
      { hu: 'Kínai úti történetek: legalább három kör ajánlott.', en: 'China stories: three rounds recommended.', zh: '中国游记：建议至少讲三轮。' },
      { hu: 'A kutyusod első tál vizét a ház állja.', en: "Your pup's first bowl of water is on the house.", zh: '狗狗的第一碗水，本店请客。' },
      { hu: 'Ha elfogy a téma, a kutyusod úgyis megmenti a beszélgetést.', en: 'If we run out of topics, your pup saves the conversation.', zh: '要是没话题了，狗狗会来救场。' },
      { hu: 'Egyetlen szabály: aki először elneveti magát, az rendeli a második kört.', en: 'One rule: whoever laughs first orders round two.', zh: '唯一规则：谁先笑场，谁点第二轮。' },
    ],
  };

  // blokk: magyar sor + külön EN / 中文 sor (mindig textContent, nincs innerHTML)
  function fill(el, t) {
    el.replaceChildren();
    const hu = document.createElement('span');
    hu.className = 'hu';
    hu.textContent = t.hu;
    el.append(hu);
    for (const lang of ['en', 'zh']) {
      if (!t[lang]) continue;
      const s = document.createElement('span');
      s.className = `tr ${lang}`;
      s.textContent = t[lang];
      el.append(s);
    }
  }

  // kis sor: csak a bekapcsolt nyelvek látszanak, a .mini CSS rakja közéjük az elválasztót
  function mini(el, en, zh) {
    el.replaceChildren();
    for (const [lang, text] of [['en', en], ['zh', zh]]) {
      if (!text) continue;
      const s = document.createElement('span');
      s.className = lang;
      s.textContent = text;
      el.append(s);
    }
  }

  /* ---------- háttér hatszögek ---------- */
  const bg = $('#bg');
  if (!reduced) {
    for (let i = 0; i < 14; i++) {
      const h = document.createElement('i');
      h.style.setProperty('--s', `${18 + Math.random() * 34}px`);
      h.style.left = `${Math.random() * 100}%`;
      h.style.setProperty('--d', `${12 + Math.random() * 14}s`);
      h.style.setProperty('--w', `${-Math.random() * 20}s`);
      bg.append(h);
    }
  }

  /* ---------- naptár ---------- */
  const HOURS = [16, 17, 18, 19, 20];
  const DAY_SHORT = ['V', 'H', 'K', 'Sze', 'Cs', 'P', 'Szo'];
  const DAYS = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + i + 1);
    return d;
  });
  const fmtHuDay = new Intl.DateTimeFormat('hu-HU', { weekday: 'long' });
  const fmtHuMd = new Intl.DateTimeFormat('hu-HU', { month: 'long', day: 'numeric' });
  const fmtEn = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  const fmtZh = new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' });
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const pad = (n) => String(n).padStart(2, '0');
  const huDate = (d) => `${cap(fmtHuDay.format(d))}, ${fmtHuMd.format(d)}`;

  let picked = null;

  function whenParts(key) {
    const [di, hi] = key.split('-').map(Number);
    const d = DAYS[di];
    return { d, hour: HOURS[hi], hu: huDate(d), en: fmtEn.format(d), zh: fmtZh.format(d) };
  }

  function buildGrid(wrap) {
    wrap.replaceChildren();
    const grid = document.createElement('div');
    grid.className = 'grid';
    grid.setAttribute('role', 'group');
    grid.append(document.createElement('div'));
    DAYS.forEach((d) => {
      const h = document.createElement('div');
      h.className = 'dh' + (d.getDay() === 0 || d.getDay() === 6 ? ' we' : '');
      const b = document.createElement('b'); b.textContent = DAY_SHORT[d.getDay()];
      const s = document.createElement('small'); s.textContent = d.getDate();
      h.append(b, s);
      grid.append(h);
    });
    HOURS.forEach((hour, hi) => {
      const th = document.createElement('div');
      th.className = 'th';
      th.textContent = `${hour}:00`;
      grid.append(th);
      DAYS.forEach((d, di) => {
        const key = `${di}-${hi}`;
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'cell';
        cell.dataset.key = key;
        cell.setAttribute('aria-label', `${huDate(d)} ${hour}:00`);
        const hx = document.createElement('span');
        hx.className = 'hx';
        hx.style.setProperty('--c', di);
        hx.style.setProperty('--r', hi);
        hx.style.setProperty('--fd', `${(Math.random() * 0.9).toFixed(2)}s`);
        hx.style.setProperty('--fdur', `${(0.55 + Math.random() * 0.6).toFixed(2)}s`);
        cell.append(hx);
        cell.setAttribute('aria-pressed', String(picked === key));
        cell.classList.toggle('sel', picked === key);
        cell.addEventListener('click', () => {
          picked = key;
          grid.querySelectorAll('.cell').forEach((c) => {
            c.classList.toggle('sel', c.dataset.key === key);
            c.setAttribute('aria-pressed', String(c.dataset.key === key));
          });
          showPicked();
        });
        grid.append(cell);
      });
    });
    wrap.append(grid);
  }

  /* ---------- képernyők ---------- */
  const screens = [...document.querySelectorAll('.screen')];
  const progress = $('#progress');
  screens.forEach(() => progress.append(document.createElement('li')));
  let step = 0;
  const timers = [];
  const later = (fn, ms) => { const t = setTimeout(fn, ms); timers.push(t); return t; };
  const clearTimers = () => { timers.splice(0).forEach(clearTimeout); };
  const LAST = screens.length - 1;

  function go(n) {
    clearTimers();
    step = n;
    screens.forEach((s, i) => { s.hidden = i !== n; s.classList.toggle('active', i === n); });
    [...progress.children].forEach((li, i) => { li.className = i < n ? 'on' : i === n ? 'now' : ''; });
    $('#back').hidden = n === 0 || n === LAST;
    const h1 = screens[n].querySelector('h1');
    if (h1) h1.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
    if (n === 2) enterPick();
    if (n === 3) resetEnvelope();
    if (n === 4) renderTicket();
  }

  document.querySelectorAll('[data-next]').forEach((b) => b.addEventListener('click', () => go(step + 1)));
  $('#back').addEventListener('click', () => go(step - 1));

  /* ---------- 2 · időpont: pislogó ellenőrzés, aztán választás ---------- */
  let scanned = false;

  function enterPick() {
    const wrap = $('#gridPick');
    wrap.classList.remove('scanning', 'revealed');
    buildGrid(wrap);
    $('#toVenue').disabled = true;
    if (scanned || reduced) {
      fill($('#scanStatus'), T.scanDone);
      showPicked();
      return;
    }
    wrap.classList.add('scanning');
    fill($('#pkWhen'), T.none);
    T.scan.forEach((t, i) => later(() => fill($('#scanStatus'), t), i * 900));
    later(() => {
      scanned = true;
      wrap.classList.remove('scanning');
      wrap.classList.add('revealed');
      fill($('#scanStatus'), T.scanDone);
      later(() => wrap.classList.remove('revealed'), 1600);
    }, T.scan.length * 900);
    showPicked();
  }

  function showPicked() {
    const when = $('#pkWhen');
    const check = $('#pkCheck');
    check.className = 'pk-check';
    check.replaceChildren();
    $('#toVenue').disabled = true;
    if (!picked) { fill(when, T.none); return; }
    const w = whenParts(picked);
    fill(when, { hu: `${w.hu} · ${w.hour}:00`, en: `${w.en}, ${w.hour}:00`, zh: `${w.zh} ${w.hour}:00` });
    fill(check, T.checking);
    later(() => {
      fill(check, T.clear);
      check.classList.add('ok');
      $('#toVenue').disabled = false;
    }, reduced ? 0 : 1000);
  }

  /* ---------- 3 · boríték ---------- */
  const envelope = $('#envelope');
  function resetEnvelope() {
    envelope.classList.remove('open');
    envelope.setAttribute('aria-expanded', 'false');
    $('#venueChecks').hidden = true;
    $('#toTicket').disabled = true;
    $('#venueName').textContent = VENUE || T.surprise.hu;
    $('#venueTr').hidden = !!VENUE;
  }
  envelope.addEventListener('click', () => {
    if (envelope.classList.contains('open')) return;
    envelope.classList.add('open');
    envelope.setAttribute('aria-expanded', 'true');
    later(() => { $('#venueChecks').hidden = false; $('#toTicket').disabled = false; }, reduced ? 0 : 650);
  });

  /* ---------- 4 · jegy ---------- */
  let jokeIdx = 0;
  function renderTicket() {
    const w = whenParts(picked);
    $('#tDate').textContent = w.hu;
    mini($('#tDateTr'), w.en, w.zh);
    $('#tTime').textContent = `${pad(w.hour)}:00`;
    $('#tVenue').textContent = VENUE || T.surprise.hu;
    mini($('#tVenueTr'), VENUE ? '' : T.surprise.en, VENUE ? '' : T.surprise.zh);
    const line = $('#jokeLine');
    const show = () => {
      fill(line, T.jokes[jokeIdx % T.jokes.length]);
      line.classList.remove('fade');
      jokeIdx++;
      later(() => { line.classList.add('fade'); later(show, 400); }, 5200);
    };
    show();
    later(confetti, reduced ? 0 : 500);
  }

  $('#btnAgain').addEventListener('click', () => { picked = null; go(2); });

  /* ---------- naptárfájl (.ics) ---------- */
  const icsEsc = (s) => s.replace(/[\\,;]/g, (m) => '\\' + m).replace(/\n/g, '\\n');
  const stamp = (d, h) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(h)}0000`;

  $('#btnIcs').addEventListener('click', () => {
    const { d, hour } = whenParts(picked);
    const lines = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Betti//randi//HU', 'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT',
      `UID:${Date.now()}-${Math.random().toString(36).slice(2)}@betti`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
      `DTSTART:${stamp(d, hour)}`,
      `DTEND:${stamp(d, hour + 2)}`,
      `SUMMARY:${icsEsc('Egy pohár bor (vagy egy üveg) 🍷 · A glass of wine (or a bottle) · 一杯红酒（或者一瓶）')}`,
      `LOCATION:${icsEsc(VENUE || 'Meglepetés / Surprise / 惊喜')}`,
      `DESCRIPTION:${icsEsc('Kínai történetek, sok nevetés, a kutyus is jön. / China stories, lots of laughing, pup included. / 中国游记、欢笑不断、狗狗同行。')}`,
      'END:VEVENT', 'END:VCALENDAR',
    ];
    const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'betti-randi.ics';
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast(T.toastIcs);
  });

  /* ---------- üzenet ---------- */
  $('#btnShare').addEventListener('click', async () => {
    const w = whenParts(picked);
    const where = VENUE || 'meglepetés / surprise / 惊喜';
    const msg = [
      `Szia! Betti vagyok 🐝 Megvan az időpontom: ${w.hu}, ${w.hour}:00. Helyszín: ${where}. 🍷 Hozom a kutyust is, és sok nevetést!`,
      `EN: Betti here. My slot: ${w.en}, ${w.hour}:00. Venue: ${where}. Bringing the pup and plenty of laughs!`,
      `中文：我是 Betti。我选的时间：${w.zh} ${w.hour}:00。地点：${where}。我会带上狗狗，还有满满的笑声！`,
    ].join('\n');
    if (navigator.share) {
      try { await navigator.share({ text: msg }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    try { await navigator.clipboard.writeText(msg); toast(T.toastCopy); } catch { toast(T.toastFail); }
  });

  /* ---------- toast ---------- */
  let toastTimer;
  function toast(t) {
    const el = $('#toast');
    el.replaceChildren(document.createTextNode(t.hu));
    for (const lang of ['en', 'zh']) {
      const s = document.createElement('span');
      s.className = lang;
      s.textContent = ` · ${t[lang]}`;
      el.append(s);
    }
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
  }

  /* ---------- konfetti ---------- */
  function confetti() {
    if (reduced) return;
    const cv = $('#confetti');
    const ctx = cv.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = (cv.width = innerWidth * dpr);
    const H = (cv.height = innerHeight * dpr);
    const colors = ['#FFC629', '#F2A900', '#7A1F3D', '#FFFFFF', '#1D1A14', '#E8708E'];
    const parts = Array.from({ length: 130 }, () => ({
      x: W / 2 + (Math.random() - .5) * W * .3, y: H * .35,
      vx: (Math.random() - .5) * 16 * dpr, vy: (-Math.random() * 15 - 5) * dpr,
      s: (6 + Math.random() * 9) * dpr, r: Math.random() * 6, vr: (Math.random() - .5) * .3,
      c: colors[(Math.random() * colors.length) | 0], hex: Math.random() < .55,
    }));
    const t0 = performance.now();
    (function frame(now) {
      const t = now - t0;
      ctx.clearRect(0, 0, W, H);
      for (const p of parts) {
        p.vy += .38 * dpr; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.r);
        ctx.globalAlpha = Math.max(0, 1 - t / 3600);
        ctx.fillStyle = p.c;
        if (p.hex) {
          ctx.beginPath();
          for (let i = 0; i < 6; i++) ctx.lineTo(Math.cos(i * Math.PI / 3) * p.s * .6, Math.sin(i * Math.PI / 3) * p.s * .6);
          ctx.closePath(); ctx.fill();
        } else ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
        ctx.restore();
      }
      if (t < 3600) requestAnimationFrame(frame); else ctx.clearRect(0, 0, W, H);
    })(t0);
  }

  go(0);
})();
