(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ?helyszin=Borbíróság  → a helyszín, amit te választasz (csak szövegként jelenik meg)
  const params = new URLSearchParams(location.search);
  const VENUE = (params.get('helyszin') || '').trim().slice(0, 80);

  /* ---------- háromnyelvű szövegek ---------- */
  const T = {
    scan: [
      { hu: 'Naptár betöltése… (nem kukucskálok, ígérem)', en: 'Loading calendar… (not peeking, promise)', zh: '正在加载日历…（我不偷看，保证）' },
      { hu: 'Ütközések keresése 🔍', en: 'Hunting for clashes', zh: '正在寻找冲突' },
      { hu: 'Hétfő reggeli megbeszélés? Az nem randi-idő, kihagyom.', en: 'Monday-morning meeting? Not date time. Skipping.', zh: '周一早会？那不是约会时间，跳过。' },
    ],
    scanDone: { hu: 'Kész! A sárga hatszögek szabadok ✨', en: 'Done! Yellow hexagons are free.', zh: '搞定！黄色六边形是空闲的。' },
    full: { hu: 'Hűha, tele a naptár! Szabadíts fel legalább egyet 😅', en: 'Wow, fully booked! Free up at least one.', zh: '哇，日历满了！至少腾出一个吧。' },
    none: { hu: 'Még nem választottál.', en: 'Nothing picked yet.', zh: '还没选。' },
    checking: { hu: 'Ütközések ellenőrzése…', en: 'Checking for clashes…', zh: '正在检查冲突…' },
    clear: { hu: '✔ Nincs ütközés a naptáradban', en: 'No clash in your calendar', zh: '你的日历没有冲突' },
    surprise: { hu: 'Meglepetés 🤫', trLine: 'Surprise · 惊喜' },
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

  // egy elem tartalmát három sorra tölti: magyar + EN + 中文 (mindig textContent, nincs innerHTML)
  function fill(el, t, { huClass = 'hu' } = {}) {
    el.replaceChildren();
    const hu = document.createElement('span');
    hu.className = huClass;
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

  /* ---------- naptár adatok ---------- */
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
  const huDate = (d) => `${cap(fmtHuDay.format(d))}, ${fmtHuMd.format(d)}`;
  const fmtEn = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  const fmtZh = new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' });
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const pad = (n) => String(n).padStart(2, '0');

  const hash = (n) => { n = Math.imul(n ^ 0x9e3779b9, 2654435761) >>> 0; n ^= n >>> 15; return n % 100; };
  const busy = new Set();
  (function seedBusy() {
    const seed = DAYS[0].getDate() * 31 + DAYS[0].getMonth();
    DAYS.forEach((d, di) => HOURS.forEach((_, hi) => {
      const weekend = d.getDay() === 0 || d.getDay() === 6;
      if (hash(seed + di * 7 + hi * 13) < (weekend ? 30 : 42)) busy.add(`${di}-${hi}`);
    }));
  })();
  let picked = null;

  const freeCount = () => DAYS.length * HOURS.length - busy.size;

  function buildGrid(wrap, mode) {
    wrap.replaceChildren();
    wrap.classList.toggle('pick', mode === 'pick');
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
        cell.append(hx);
        syncCell(cell, mode);
        cell.addEventListener('click', () => onCell(cell, mode));
        grid.append(cell);
      });
    });
    wrap.append(grid);
    if (mode === 'mark') {
      const line = document.createElement('div');
      line.className = 'scanline';
      wrap.append(line);
    }
  }

  function syncCell(cell, mode) {
    const key = cell.dataset.key;
    const isBusy = busy.has(key);
    cell.classList.toggle('busy', isBusy);
    cell.classList.toggle('sel', mode === 'pick' && picked === key);
    if (mode === 'mark') cell.setAttribute('aria-pressed', String(isBusy));
    else { cell.disabled = isBusy; cell.setAttribute('aria-pressed', String(picked === key)); }
  }

  function onCell(cell, mode) {
    const key = cell.dataset.key;
    if (mode === 'mark') {
      busy.has(key) ? busy.delete(key) : busy.add(key);
      if (picked === key) picked = null;
      syncCell(cell, mode);
      updateCount();
    } else if (!busy.has(key)) {
      picked = key;
      document.querySelectorAll('#gridPick .cell').forEach((c) => syncCell(c, 'pick'));
      showPicked();
    }
  }

  function updateCount() {
    const n = freeCount();
    $('#freeCount').textContent = `${n} szabad · ${n} free · ${n} 个空闲`;
    $('#toPick').disabled = scanning || n === 0;
    if (!scanning && n === 0) fill($('#scanStatus'), T.full);
    else if (!scanning) fill($('#scanStatus'), T.scanDone);
  }

  /* ---------- képernyők ---------- */
  const screens = [...document.querySelectorAll('.screen')];
  const progress = $('#progress');
  screens.forEach(() => progress.append(document.createElement('li')));
  let step = 0;
  const timers = [];
  const later = (fn, ms) => { const t = setTimeout(fn, ms); timers.push(t); return t; };
  const clearTimers = () => { timers.splice(0).forEach(clearTimeout); };

  function go(n) {
    clearTimers();
    step = n;
    screens.forEach((s, i) => { s.hidden = i !== n; s.classList.toggle('active', i === n); });
    [...progress.children].forEach((li, i) => { li.className = i < n ? 'on' : i === n ? 'now' : ''; });
    $('#back').hidden = n === 0 || n === screens.length - 1;
    const h1 = screens[n].querySelector('h1');
    if (h1) h1.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
    if (n === 2) startScan();
    if (n === 3) enterPick();
    if (n === 4) resetEnvelope();
    if (n === 5) renderTicket();
  }

  document.querySelectorAll('[data-next]').forEach((b) => b.addEventListener('click', () => go(step + 1)));
  $('#back').addEventListener('click', () => go(step - 1));

  /* ---------- 2 · szkennelés ---------- */
  let scanning = false;
  let scanned = false;

  function startScan() {
    const wrap = $('#gridMark');
    buildGrid(wrap, 'mark');
    $('#markHint').hidden = true;
    if (scanned || reduced) { finishScan(wrap); return; }
    scanning = true;
    $('#toPick').disabled = true;
    $('#freeCount').textContent = '';
    wrap.classList.add('scanning');
    T.scan.forEach((t, i) => later(() => fill($('#scanStatus'), t), i * 900));
    later(() => finishScan(wrap), T.scan.length * 900 + 100);
  }

  function finishScan(wrap) {
    scanning = false;
    scanned = true;
    wrap.classList.remove('scanning');
    $('#markHint').hidden = false;
    updateCount();
  }

  /* ---------- 3 · időpont ---------- */
  function enterPick() {
    if (picked && busy.has(picked)) picked = null;
    buildGrid($('#gridPick'), 'pick');
    showPicked();
  }

  function whenParts(key) {
    const [di, hi] = key.split('-').map(Number);
    const d = DAYS[di];
    return { d, hour: HOURS[hi], hu: `${huDate(d)} · ${HOURS[hi]}:00`, en: fmtEn.format(d), zh: fmtZh.format(d) };
  }

  function showPicked() {
    const when = $('#pkWhen');
    const check = $('#pkCheck');
    clearTimers();
    check.className = 'pk-check';
    check.replaceChildren();
    if (!picked) {
      fill(when, T.none);
      $('#toVenue').disabled = true;
      return;
    }
    const w = whenParts(picked);
    fill(when, { hu: w.hu, en: `${w.en}, ${w.hour}:00`, zh: `${w.zh} ${w.hour}:00` });
    $('#toVenue').disabled = true;
    fill(check, T.checking);
    later(() => {
      fill(check, T.clear);
      check.classList.add('ok');
      $('#toVenue').disabled = false;
    }, reduced ? 0 : 1000);
  }

  /* ---------- 4 · boríték ---------- */
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

  /* ---------- 5 · jegy ---------- */
  let jokeIdx = 0;
  function renderTicket() {
    const w = whenParts(picked);
    $('#tDate').textContent = w.hu.split(' · ')[0];
    $('#tDateTr').textContent = `${w.en} · ${w.zh}`;
    $('#tTime').textContent = `${pad(w.hour)}:00`;
    $('#tVenue').textContent = VENUE || T.surprise.hu;
    $('#tVenueTr').textContent = VENUE ? '' : T.surprise.trLine;
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

  $('#btnAgain').addEventListener('click', () => { picked = null; go(3); });

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
      `SUMMARY:${icsEsc('Egy pohár bor 🍷 · A glass of wine · 一杯红酒')}`,
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
      `Szia! Betti vagyok 🐝 Megvan az időpontom: ${w.hu.replace(' · ', ', ')}. Helyszín: ${where}. 🍷 Hozom a kutyust is, és sok nevetést!`,
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
    el.textContent = `${t.hu} · ${t.en} · ${t.zh}`;
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
