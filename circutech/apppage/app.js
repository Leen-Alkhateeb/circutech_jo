(() => {
  'use strict';

  /* ========== Helpers ========== */
  const $ = (s, r = document) => r.querySelector(s) || (console.warn('Missing element:', s), document.createElement('div'));
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const LOGIN_URL = '../loginpage/login.html';

  const load = (storage, key, fallback) => { try { return JSON.parse(storage.getItem(key)) ?? fallback; } catch { return fallback; } };
  const save = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };

  function count(el, to, decimals = 0) {
    const start = performance.now();
    const step = t => {
      const p = Math.min((t - start) / 900, 1);
      el.textContent = (to * (1 - Math.pow(1 - p, 3))).toFixed(decimals);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
  }

  function replay(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
  function stagger() {
    $$('.view:not([hidden]) .rv').forEach((el, i) => { el.style.setProperty('--i', Math.min(i, 9)); replay(el, 'play'); });
  }
  const CIRC = 327;
  function setRing(el, pct) {
    el.style.transition = 'none';
    el.style.strokeDashoffset = CIRC;
    void el.getBoundingClientRect();
    el.style.transition = '';
    requestAnimationFrame(() => { el.style.strokeDashoffset = CIRC * (1 - pct / 100); });
  }
  const download = (name, type, content) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([content], { type }));
    a.download = name;
    a.click();
  };
  const csvOf = rows => rows.map(r => r.map(v => '"' + String(v ?? '').replace(/"/g, '""') + '"').join(',')).join('\n');

  /* ========== 1. Session guard ========== */
  // The session must exist, be unexpired, and still match an active account in the users database
  const session = load(sessionStorage, 'circutech_session', null);
  const account = session && load(localStorage, 'circutech_users', []).find(u => u.email === session.email);
  if (!session || !Number.isFinite(Number(session.exp)) || Number(session.exp) <= Date.now() || !account || account.suspended) {
    try { sessionStorage.removeItem('circutech_session'); } catch {}
    location.replace(LOGIN_URL);
    return;
  }
  const user = { ...session, name: account.name, role: account.role === 'admin' ? 'admin' : account.role === 'business' ? 'business' : 'user' };
  const isAdminUser = user.role === 'admin';
  const isBusinessUser = user.role === 'business';

  /* ========== 2. Storage (localStorage, one namespace per user) ========== */
  const EMAIL = user.email;
  const SCANS_KEY = 'circutech_scans:' + EMAIL;
  const SPENT_KEY = 'circutech_spent:' + EMAIL;
  const VOUCH_KEY = 'circutech_vouchers:' + EMAIL;
  const READS_KEY = 'circutech_article_reads:' + EMAIL;
  const BIZ_KEY = 'circutech_biz:' + EMAIL;
  const store = {
    scans: () => load(localStorage, SCANS_KEY, []),
    addScan: scan => save(SCANS_KEY, [scan, ...store.scans()].slice(0, 40)),
    spent: () => Number(load(localStorage, SPENT_KEY, 0)) || 0,
    spend: n => save(SPENT_KEY, store.spent() + n),
    vouchers: () => load(localStorage, VOUCH_KEY, []),
    articleReads: () => {
      const reads = load(localStorage, READS_KEY, []);
      return Array.isArray(reads) ? reads : [];
    },
    addVoucher: v => save(VOUCH_KEY, [v, ...store.vouchers()]),
    clear: () => [SCANS_KEY, SPENT_KEY, VOUCH_KEY, READS_KEY].forEach(k => { try { localStorage.removeItem(k); } catch {} }),
    users: () => load(localStorage, 'circutech_users', []),
    saveUsers: l => {
      try { localStorage.setItem('circutech_users', JSON.stringify(l)); return true; } catch { return false; }
    }
  };

  /* ========== 3. Logo and navigation ========== */
  const LOGO = '<svg viewBox="0 0 48 48" aria-hidden="true"><path class="arc" d="M28.4 7.6A17 17 0 0 1 39.97 29.8"/><polygon class="head" points="38.3,34.5 43.26,31 36.68,28.6"/><path class="arc" d="M33.75 37.9A17 17 0 0 1 10.98 34.93"/><polygon class="head" points="7.77,31.1 8.3,37.18 13.66,32.68"/><path class="arc" d="M7.26 26.95A17 17 0 0 1 19.6 7.58"/><polygon class="head" points="24.43,6.28 18.69,4.2 20.5,10.96"/><rect class="chip-m" x="17" y="17" width="14" height="14" rx="4"/><circle cx="24" cy="24" r="2.6" fill="#fff" stroke="none"/></svg>';
  $$('[data-logo]').forEach(e => { e.innerHTML = LOGO; });

  const USER_VIEWS = [
    ['scanner',   'AI Scanner', 'M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M8 12h8'],
    ['dashboard', 'Dashboard',  'M4 4h7v7H4zM13 4h7v4h-7zM13 11h7v9h-7zM4 14h7v6H4z'],
    ['dropoff',   'Drop-off',   'M12 21s7-6 7-12a7 7 0 0 0-14 0c0 6 7 12 7 12zM12 9m-2.5 0a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0'],
    ['rewards',   'Rewards',    'M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4zM9 10h6M9 14h6'],
    ['ecobot',    'EcoBot',     'M5 8h14v11H5zM12 4v4M9 13h.01M15 13h.01'],
    ['settings',  'Settings',   'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1']
  ];
  const BUSINESS_VIEWS = USER_VIEWS.slice();
  BUSINESS_VIEWS.splice(BUSINESS_VIEWS.length - 1, 0, ['business', 'Business', 'M3 21h18M5 21V7l7-4 7 4v14M9 9h2M9 13h2M13 9h2M13 13h2M10 21v-4h4v4']);
  const ADMIN_VIEWS = [
    ['adminOverview', 'Overview', 'M4 4h7v7H4zM13 4h7v4h-7zM13 11h7v9h-7zM4 14h7v6H4z'],
    ['adminUsers', 'Users', 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M20 8v6M23 11h-6'],
    ['adminScans', 'Device scans', 'M4 4h16v16H4zM8 8h8M8 12h8M8 16h4'],
    ['adminNews', 'News', 'M4 5h16v14H4zM8 9h8M8 13h8M8 16h5'],
    ['adminListings', 'Marketplace', 'M4 9l1-5h14l1 5M4 9v11h16V9M4 9h16M9 14h6'],
    ['adminPlaces', 'Collection points', 'M12 21s7-6 7-12a7 7 0 0 0-14 0c0 6 7 12 7 12zM12 9m-2.5 0a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0'],
    ['adminRewards', 'Rewards', 'M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4zM9 10h6M9 14h6'],
    ['adminBusiness', 'Businesses', 'M3 21h18M5 21V7l7-4 7 4v14M9 9h2M9 13h2M13 9h2M13 13h2M10 21v-4h4v4'],
    ['settings', 'Settings', 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l2.1 2.1']
  ];
  const VIEWS = isAdminUser ? ADMIN_VIEWS : isBusinessUser ? BUSINESS_VIEWS : USER_VIEWS;
  if (isAdminUser) $('.side .brand').href = '#adminOverview';
  const navHtml = VIEWS.map(([id, title, icon]) =>
    `<a class="nv" href="#${id}"><svg viewBox="0 0 24 24"><path d="${icon}"/></svg>${title}</a>`).join('');
  const extra = '<a class="nv" href="../marketpage/market.html"><svg viewBox="0 0 24 24"><path d="M4 9l1-5h14l1 5M4 9v11h16V9M4 9h16M9 14h6"/></svg>Marketplace</a>';
  $('#nav').innerHTML = navHtml + extra;
  $('#dock').innerHTML = navHtml + extra;

  function route() {
    const fallback = isAdminUser ? 'adminOverview' : 'scanner';
    const requested = location.hash.slice(1);
    const id = VIEWS.some(v => v[0] === requested) ? requested : fallback;
    if (requested !== id) history.replaceState(null, '', '#' + id);
    $$('.view').forEach(v => { v.hidden = v.id !== id; });
    $$('.nv').forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + id));
    $('#pageTitle').textContent = VIEWS.find(v => v[0] === id)[1];
    if (isAdminUser && id !== 'settings') renderAdmin(id);
    else {
      if (id === 'dashboard') renderDashboard();
      if (id === 'dropoff') renderPoints();
      if (id === 'rewards') renderRewards();
      if (id === 'business') renderBusiness();
    }
    if (id === 'settings') loadSettings();
    renderBanner(id);
    replay($('.top'), 're');
    stagger();
    scrollTo({ top: 0 });
  }
  addEventListener('hashchange', route);

  /* ========== 4. Theme and user ========== */
  const root = document.documentElement;
  const themeBtn = $('#theme');
  function setTheme(mode) {
    if (mode === 'dark') root.setAttribute('data-theme', 'dark');
    else root.removeAttribute('data-theme');
    themeBtn.innerHTML = mode === 'dark'
      ? '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19"/></svg>'
      : '<svg viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>';
    $$('#themeSeg .chip').forEach(c => {
      const selected = c.dataset.v === mode;
      c.classList.toggle('on', selected);
      c.setAttribute('aria-pressed', selected);
    });
  }
  setTheme(localStorage.getItem('theme') === 'dark' ? 'dark' : 'light');
  themeBtn.onclick = () => {
    const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('theme', next); } catch {}
    setTheme(next);
  };

  const fullName = user.name || EMAIL.split('@')[0];
  const first = fullName.split(' ')[0];
  const hour = new Date().getHours();
  const hello = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  $('#userName').textContent = first;
  $('#avatar').textContent = first[0].toUpperCase();
  $('#greet').textContent = hello + ', ' + first;
  const signOut = () => { try { sessionStorage.removeItem('circutech_session'); } catch {} location.href = LOGIN_URL; };
  $('#logout').onclick = signOut;

  // Announcement banner set by the admin
  const AN = load(localStorage, 'circutech_announce', null);
  if (AN && AN.on && AN.text) {
    const a = $('#ann');
    a.hidden = false;
    a.textContent = AN.text;
    a.classList.toggle('warn', AN.kind === 'warn');
  }

  /* ========== 5. Levels and totals ========== */
  const LEVELS = [[0, 'Standard'], [200, 'Bronze'], [600, 'Silver'], [1500, 'Gold'], [3000, 'Platinum']];
  function level(points) {
    let i = 0;
    LEVELS.forEach((l, k) => { if (points >= l[0]) i = k; });
    const next = LEVELS[i + 1], base = LEVELS[i][0];
    return {
      name: LEVELS[i][1],
      pct: next ? Math.round((points - base) / (next[0] - base) * 100) : 100,
      left: next ? next[0] - points : 0,
      next: next ? next[1] : ''
    };
  }
  function totals() {
    const scans = store.scans();
    const sum = key => scans.reduce((a, s) => a + (+s[key] || 0), 0);
    const points = Math.round(sum('points'));
    return { scans, n: scans.length, value: Math.round(sum('mid')), co2: Math.round(sum('co2') * 10) / 10, points, avail: Math.max(0, points - store.spent()) };
  }
  function updateSideLevel() {
    if (isAdminUser) {
      $('#lvName').textContent = 'Administrator';
      $('#lvBar').style.width = '100%';
      return;
    }
    const l = level(totals().points);
    $('#lvName').textContent = l.name;
    $('#lvBar').style.width = l.pct + '%';
  }

  /* ========== 6. Welcome screen ========== */
  const welcome = $('#welcome');
  let showWelcome = false;
  try {
    showWelcome = !isAdminUser && sessionStorage.getItem('circutech_welcome') === '1';
    sessionStorage.removeItem('circutech_welcome');
  } catch {}

  if (showWelcome) {
    const t = totals();
    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      welcome.classList.add('out');
      setTimeout(() => welcome.remove(), 1200);
    };
    $('#wHi').textContent = 'Welcome back';
    $('#wName').innerHTML = [...first].map((c, i) => `<span class="ch" style="--i:${i}">${esc(c)}</span>`).join('');
    $('#wName').setAttribute('aria-label', first);
    $('#wFact').textContent = t.n ? hello + '. Your recycling workspace is ready.' : hello + '. Your first estimate is one tap away.';
    if (t.n) {
      const stats = [[t.n, 0, 'Devices'], [t.co2, 1, 'kg CO₂ avoided'], [t.points, 0, 'Green points']];
      $('#wStats').innerHTML = stats.map(s => `<div><b>0</b><span>${s[2]}</span></div>`).join('');
      $$('#wStats b').forEach((el, i) => setTimeout(() => count(el, stats[i][0], stats[i][1]), 2300 + i * 150));
    }
    const t0 = performance.now();
    (function tick() {
      const p = Math.min(1, (performance.now() - t0) / 4000);
      $('#wPct').textContent = Math.round(p * 100) + '%';
      if (p < 1 && !closed) requestAnimationFrame(tick);
    })();
    welcome.hidden = false;
    $('#wSkip').onclick = close;
    setTimeout(close, 4400);
  } else {
    welcome.remove();
  }

  /* ========== 7. Pricing engine (admin can override prices) ========== */
  const DEVICES = {
    smartphone: { name: 'Smartphone',        price: [40, 90, 220, 360],  keep: .72, co2: 60,  mats: ['Gold', 'Copper', 'Cobalt', 'Lithium', 'Aluminium'] },
    laptop:     { name: 'Laptop',            price: [90, 200, 380, 600], keep: .78, co2: 300, mats: ['Copper', 'Aluminium', 'Gold', 'Lithium', 'Plastics'] },
    tablet:     { name: 'Tablet',            price: [40, 90, 180, 300],  keep: .75, co2: 110, mats: ['Aluminium', 'Lithium', 'Copper', 'Gold'] },
    watch:      { name: 'Smartwatch',        price: [15, 40, 90, 150],   keep: .70, co2: 30,  mats: ['Lithium', 'Gold', 'Steel'] },
    router:     { name: 'Router / modem',    price: [5, 12, 25, 40],     keep: .85, co2: 25,  mats: ['Copper', 'Plastics', 'Tin'] },
    tv:         { name: 'Television',        price: [30, 80, 180, 350],  keep: .85, co2: 400, mats: ['Glass', 'Copper', 'Plastics', 'Indium'] },
    console:    { name: 'Game console',      price: [40, 90, 160, 250],  keep: .87, co2: 150, mats: ['Copper', 'Gold', 'Plastics'] },
    audio:      { name: 'Audio device',      price: [5, 15, 40, 90],     keep: .80, co2: 15,  mats: ['Neodymium', 'Copper', 'Plastics'] },
    camera:     { name: 'Camera',            price: [40, 100, 250, 500], keep: .86, co2: 80,  mats: ['Glass', 'Copper', 'Gold'] },
    appliance:  { name: 'Small appliance',   price: [3, 8, 15, 25],      keep: .85, co2: 20,  mats: ['Copper', 'Steel', 'Plastics'] },
    other:      { name: 'Electronic device', price: [5, 10, 20, 30],     keep: .85, co2: 20,  mats: ['Copper', 'Plastics'] }
  };
  const OVERRIDES = load(localStorage, 'circutech_prices', {});
  Object.keys(OVERRIDES).forEach(k => { if (DEVICES[k]) Object.assign(DEVICES[k], OVERRIDES[k]); });

  const SEGMENTS = ['budget', 'mid-range', 'high-end', 'premium'];
  const CONDITIONS = { 'Working': 1, 'Damaged screen': .45, 'No power': .15, 'Water damage': .1 };

  function estimate({ category, segment, age }, condition) {
    const cat = DEVICES[category] ? category : 'other';
    const d = DEVICES[cat];
    const seg = Math.max(0, SEGMENTS.indexOf(segment));
    const years = Math.min(15, Math.max(0, Number(age) || 3));
    const value = d.price[seg] * Math.pow(d.keep, years) * (CONDITIONS[condition] ?? 1);
    const step = value >= 60 ? 5 : 1;
    const round = v => Math.round(v / step) * step;
    const mid = Math.max(1, round(value));
    const lo = Math.max(1, round(mid * .85));
    const hi = Math.max(lo + 1, round(mid * 1.15));
    const working = condition === 'Working';
    const co2 = Math.round(d.co2 * (working ? .6 : .15) * 10) / 10;
    const grade = working ? (years <= 3 ? 'A' : years <= 6 ? 'B' : 'C') : condition === 'Damaged screen' ? 'C' : 'D';
    return { cat, seg: SEGMENTS[seg], age: years, lo, hi, mid, co2, grade, points: Math.round(mid * 6 + co2 * 4) };
  }

  /* ========== 8. Scanner (estimate from the user's choices) ========== */
  const GRADE_COLOR = { A: '#157a3c', B: '#4f9a2f', C: '#b8891a', D: '#b42318' };
  const drop = $('#drop'), fileInput = $('#file'), analyseBtn = $('#analyse'), result = $('#result');
  let thumb = null, last = null, devType = 'smartphone', devCond = 'Working';

  const showEmpty = () => { result.innerHTML = '<div class="empty"><b>Your device report</b><small>Choose the device type and condition, then press Get my estimate.</small></div>'; };

  function chipGroup(selector, onPick) {
    $(selector).addEventListener('click', e => {
      const btn = e.target.closest('.chip');
      if (!btn) return;
      $$('.chip', $(selector)).forEach(c => c.classList.toggle('on', c === btn));
      onPick(btn.dataset.v);
    });
  }
  chipGroup('#typeChips', v => { devType = v; });
  chipGroup('#condChips', v => { devCond = v; });

  function loadPhoto(file) {
    if (!file || !file.type.startsWith('image/')) return toast('Please choose an image file.');
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      const resize = (max, quality) => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * k);
        c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        return c.toDataURL('image/jpeg', quality);
      };
      $('#preview').src = resize(800, .8);
      thumb = resize(110, .7);
      URL.revokeObjectURL(objectUrl);
      drop.classList.add('has');
    };
    img.onerror = () => toast('Could not read this image.');
    img.src = objectUrl;
  }
  drop.onclick = () => fileInput.click();
  drop.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); } };
  fileInput.onchange = () => loadPhoto(fileInput.files[0]);
  ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', e => loadPhoto(e.dataTransfer.files[0]));

  $('#reset').onclick = () => {
    thumb = last = null;
    fileInput.value = '';
    drop.classList.remove('has', 'busy');
    $('#preview').removeAttribute('src');
    analyseBtn.disabled = false;
    showEmpty();
  };

  function renderResult(r) {
    const plural = r.age === 1 ? '' : 's';
    const sellCat = { smartphone: 'phone', laptop: 'laptop', tablet: 'tablet', tv: 'tv', router: 'router' }[r.cat] || 'appliance';
    const resale = Math.max(1, Math.round(r.mid * 1.5));
    const sellTitle = ['Not specified'].includes(r.brand) ? r.device : r.brand;
    const action = r.cond === 'Working'
      ? `<a class="btn ghost" href="../marketpage/market.html?sell=1&title=${encodeURIComponent(sellTitle)}&cat=${sellCat}&price=${resale}">Sell for about JOD ${resale}</a>`
      : '<a class="btn ghost" href="#dropoff">Find a drop-off point</a>';
    result.innerHTML = `<div class="pop">
      <div class="r-head">
        <div class="grade" style="--c:${GRADE_COLOR[r.grade]}"><b>${r.grade}</b></div>
        <div><h3>${esc(r.device)}</h3><p>${esc(r.brand)} · ${esc(r.cond)}</p></div>
      </div>
      <small class="mut">Estimated trade-in value</small>
      <div class="price">JOD ${r.lo} to ${r.hi}</div>
      <div class="stats">
        <div><b>${r.co2} kg</b><span>CO₂ avoided</span></div>
        <div><b>${r.points}</b><span>Green points</span></div>
        <div><b>${esc(r.seg)}</b><span>Segment</span></div>
      </div>
      <div class="why">Based on a ${esc(r.seg)} ${esc(r.device.toLowerCase())}, about ${r.age} year${plural} old, condition: ${esc(r.cond.toLowerCase())}. This is an estimate; the final value is confirmed at the collection point.</div>
      <div class="why">Choose how to use it: hand it in for about JOD ${r.lo} to ${r.hi} plus points, or ${r.cond === 'Working' ? 'resell it on the marketplace for around JOD ' + resale + ' (5% fee only when it sells).' : 'recycle it at a collection point. Only working devices can be resold.'}</div>
      <p class="lbl">Recoverable materials</p>
      <div>${r.mats.map(m => `<span class="tg">${esc(m)}</span>`).join('')}</div>
      <div class="row"><button class="btn" type="button" id="saveScan">Save to my rewards</button>${action}</div>
    </div>`;
    $('#saveScan').onclick = e => {
      if (!last) return;
      store.addScan({ ...last, date: Date.now(), thumb });
      e.target.disabled = true;
      e.target.textContent = 'Saved';
      toast('+' + last.points + ' green points');
      updateSideLevel();
    };
  }

  function analyse() {
    analyseBtn.disabled = true;
    last = null;
    drop.classList.add('busy');
    result.innerHTML = '<div class="empty"><div class="spin"></div><b>Calculating…</b><small>Working out the value and CO₂ savings.</small></div>';
    setTimeout(() => {
      const hint = $('#modelHint').value.trim().slice(0, 50);
      const est = estimate({ category: devType, segment: $('#segSel').value, age: +$('#ageSel').value }, devCond);
      last = { isDevice: true, device: DEVICES[est.cat].name, brand: hint || 'Not specified', cond: devCond, mats: DEVICES[est.cat].mats, ...est };
      renderResult(last);
      drop.classList.remove('busy');
      analyseBtn.disabled = false;
    }, 700);
  }
  analyseBtn.onclick = analyse;
  showEmpty();

  /* ========== 9. Dashboard and rewards ========== */
  function renderDashboard() {
    const t = totals();
    const l = level(t.points);
    count($('#kPoints'), t.points);
    count($('#kDevices'), t.n);
    count($('#kValue'), t.value);
    count($('#kCo2'), t.co2, 1);
    $('#kArticles').textContent = store.articleReads().length;
    $('#lvTitle').textContent = l.name;
    $('#lvNext').textContent = l.left ? l.left + ' points to ' + l.next : 'Top tier reached';
    setRing($('#pf'), l.pct);
    $('#lvBar2').style.width = '0';
    setTimeout(() => { $('#lvBar2').style.width = l.pct + '%'; }, 80);
    $('#kTrees').textContent = t.co2 ? '≈ ' + Math.max(1, Math.round(t.co2 / 21)) + ' tree-years of absorption' : '';

    const recent = t.scans.slice(0, 7).reverse();
    const max = Math.max(1, ...recent.map(s => s.mid));
    $('#bars').innerHTML = recent.length
      ? recent.map((s, i) => `<i data-v="${esc(s.device)} · ${s.mid} JOD" style="height:${Math.max(8, s.mid / max * 100)}%;animation-delay:${i * .07}s"></i>`).join('')
      : '<p class="mut small">Your scans will appear here.</p>';

    $('#recent').innerHTML = t.n
      ? t.scans.slice(0, 8).map(s => `
        <div class="li rv">
          ${s.thumb ? `<img src="${esc(s.thumb)}" alt="">` : '<span class="ph"></span>'}
          <div class="tx"><b>${esc(s.device)}</b><small>${esc(s.brand)} · ${new Date(s.date).toLocaleDateString()}</small></div>
          <span class="gd">${esc(s.grade)}</span>
          <span class="end">JOD ${s.lo}–${s.hi}</span>
        </div>`).join('')
      : '<div class="li rv"><div class="tx"><b>No scans yet</b><small>Get your first estimate to start earning points.</small></div></div>';
  }

  const TIERS = load(localStorage, 'circutech_tiers', null) || [[500, 5, 'Grocery voucher'], [1500, 15, 'Electronics voucher'], [3000, 30, 'Shopping voucher']];
  const ICON_LOCK = '<path d="M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5z"/>';
  const ICON_OK = '<path d="m5 12 5 5 9-10"/>';
  const ICON_TICKET = '<path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4zM9 10h6M9 14h6"/>';

  function makeCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const bytes = crypto.getRandomValues(new Uint8Array(8));
    const part = o => Array.from(bytes.slice(o, o + 4), b => chars[b % chars.length]).join('');
    return 'CT-' + part(0) + '-' + part(4);
  }

  function renderRewards() {
    const avail = totals().avail;
    const top = TIERS[TIERS.length - 1][0];
    count($('#rPoints'), avail);
    setRing($('#rf'), Math.min(100, Math.round(avail / top * 100)));
    const next = TIERS.find(([need]) => avail < need);
    $('#rNext').textContent = next ? (next[0] - avail) + ' points to your next voucher (JOD ' + next[1] + ')' : 'You can redeem every voucher.';

    $('#tiers').innerHTML = TIERS.map(([need, jod, label], i) => {
      const pct = Math.min(100, Math.round(avail / need * 100));
      const ok = avail >= need;
      return `<div class="tk rv ${ok ? 'ok' : ''}">
        <div class="top-r"><div class="v">JOD ${jod}</div><span class="lk"><svg viewBox="0 0 24 24">${ok ? ICON_OK : ICON_LOCK}</svg></span></div>
        <p>${esc(label)}</p>
        <div class="lv-bar"><i style="width:${pct}%"></i></div>
        <small>${Math.min(avail, need)} / ${need} points${ok ? ' · Ready to redeem' : ''}</small>
        ${ok ? `<button class="btn" type="button" data-r="${i}">Redeem</button>` : '<button class="btn ghost" type="button" disabled>Locked</button>'}
      </div>`;
    }).join('');

    const mine = store.vouchers();
    $('#myV').innerHTML = mine.length
      ? mine.map(v => `<div class="li rv">
          <span class="ph"><svg viewBox="0 0 24 24">${ICON_TICKET}</svg></span>
          <div class="tx"><b>${esc(v.name)} · JOD ${v.jod}</b><small>${new Date(v.date).toLocaleDateString()} · <span class="code">${esc(v.code)}</span></small></div>
          <button class="cp" type="button" data-copy="${esc(v.code)}">Copy</button>
        </div>`).join('')
      : '<div class="li rv"><div class="tx"><b>No vouchers yet</b><small>Redeem your points to see your codes here.</small></div></div>';
  }

  $('#tiers').addEventListener('click', e => {
    const btn = e.target.closest('[data-r]');
    if (!btn) return;
    const [need, jod, label] = TIERS[+btn.dataset.r];
    if (totals().avail < need) return;
    if (!confirm('Redeem "' + label + '" (JOD ' + jod + ') for ' + need + ' points?')) return;
    store.spend(need);
    const code = makeCode();
    store.addVoucher({ name: label, jod, code, date: Date.now() });
    toast('Voucher ready: ' + code);
    renderRewards();
    stagger();
  });
  $('#myV').addEventListener('click', e => {
    const btn = e.target.closest('[data-copy]');
    if (!btn) return;
    const code = btn.dataset.copy;
    (navigator.clipboard ? navigator.clipboard.writeText(code) : Promise.reject()).then(() => toast('Code copied'), () => toast(code));
  });

  /* ========== 10. Drop-off points (managed by the admin) ========== */
  const PLACES = (load(localStorage, 'circutech_places', null) || [
    { name: 'Abdali Collection Point',   area: 'Amman · Abdali',      hours: 'Sun to Thu 9:00 to 18:00', days: [0, 1, 2, 3, 4],       open: 9,  close: 18, q: 'Abdali, Amman, Jordan' },
    { name: 'Sweifieh Collection Point', area: 'Amman · Sweifieh',    hours: 'Daily 10:00 to 20:00',     days: [0, 1, 2, 3, 4, 5, 6], open: 10, close: 20, q: 'Sweifieh, Amman, Jordan' },
    { name: 'Irbid City Center',         area: 'Irbid · City Center', hours: 'Sun to Thu 9:00 to 17:00', days: [0, 1, 2, 3, 4],       open: 9,  close: 17, q: 'Irbid City Center, Jordan' },
    { name: 'Aqaba Collection Point',    area: 'Aqaba · Downtown',    hours: 'Sun to Thu 9:00 to 16:00', days: [0, 1, 2, 3, 4],       open: 9,  close: 16, q: 'Aqaba, Jordan' }
  ]).filter(p => !p.off);
  let selPlace = 0, placeFilter = 'all';
  const PIN = '<path d="M12 21s7-6 7-12a7 7 0 0 0-14 0c0 6 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/>';

  function isOpen(p) {
    const now = new Date();
    return p.days.includes(now.getDay()) && now.getHours() >= p.open && now.getHours() < p.close;
  }
  function showMap(i) {
    if (!PLACES[i]) return;
    selPlace = i;
    const src = 'https://maps.google.com/maps?q=' + encodeURIComponent(PLACES[i].q) + '&z=14&output=embed';
    const frame = $('#mapFrame');
    if (frame.getAttribute('src') !== src) frame.src = src;
    $$('#points .li[data-i]').forEach(el => el.classList.toggle('sel', +el.dataset.i === i));
  }
  function renderPoints() {
    const list = PLACES.map((p, i) => ({ p, i })).filter(x => placeFilter === 'all' || isOpen(x.p));
    $('#points').innerHTML = list.length
      ? list.map(({ p, i }) => {
          const open = isOpen(p);
          return `<div class="li rv" data-i="${i}" tabindex="0">
            <span class="ph"><svg viewBox="0 0 24 24">${PIN}</svg></span>
            <div class="tx"><b>${esc(p.name)}</b><small>${esc(p.area)} · ${esc(p.hours)}</small>
              <span class="st${open ? ' on' : ''}"><i></i>${open ? 'Open now · closes ' + p.close + ':00' : 'Closed now'}</span></div>
            <a class="end" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.name + ', Jordan')}">Directions</a>
          </div>`;
        }).join('')
      : '<div class="li rv"><div class="tx"><b>No collection points to show</b><small>Check the opening hours or try again later.</small></div></div>';
    if (list.length) showMap(list.some(x => x.i === selPlace) ? selPlace : list[0].i);
  }
  $('#points').addEventListener('click', e => {
    if (e.target.closest('a')) return;
    const row = e.target.closest('.li[data-i]');
    if (row) showMap(+row.dataset.i);
  });
  $('#points').addEventListener('keydown', e => {
    const row = e.target.closest('.li[data-i]');
    if (row && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); showMap(+row.dataset.i); }
  });
  chipGroup('#doFilter', v => { placeFilter = v; renderPoints(); stagger(); });

  /* ========== 11. EcoBot (built-in knowledge, English and Arabic) ========== */
  const TOPICS = [
    { k: ['wipe', 'erase', 'factory reset', 'reset', 'back up', 'backup', 'privacy', 'personal data', 'my data', 'format', 'delete',
          'بيانات', 'مسح', 'فورمات', 'فورمت', 'نسخه احتياطيه', 'خصوصيه'],
      en: 'Back up what you need, sign out of your accounts (Apple ID or Google), then factory reset the device from Settings. Remove the SIM and memory card before you hand it in.',
      ar: 'خذ نسخة احتياطية، سجّل خروج من حساباتك (Apple ID أو Google)، ثم اعمل Factory Reset من الإعدادات. شيل الشريحة وكرت الذاكرة قبل التسليم.' },
    { k: ['batter', 'power bank', 'lithium', 'بطاري', 'باوربانك'],
      en: 'Never throw batteries in the bin. Swollen or damaged batteries are a fire risk: tape the terminals, keep them somewhere cool and hand them in at a collection point.',
      ar: 'لا ترمي البطاريات بالزبالة. البطارية المنتفخة أو التالفة خطر حريق: غطّي الأقطاب بلاصق، خزّنها بمكان بارد وسلّمها لنقطة تجميع.' },
    { k: ['price', 'worth', 'value', 'how much', 'cost', 'sell', 'سعر', 'اسعار', 'قيمه', 'بكم', 'كم بيسوي', 'كم يسوي', 'كم بتسوي'],
      en: 'Open the AI Scanner tab, choose the device type and condition, and you get a price range. The final value is confirmed at the collection point.',
      ar: 'افتح تبويب AI Scanner، اختار نوع الجهاز وحالته، وبتحصل على نطاق سعر. القيمة النهائية بتتأكد عند نقطة التجميع.' },
    { k: ['point', 'voucher', 'reward', 'coupon', 'earn', 'نقاط', 'نقطه', 'قسيم', 'مكاف', 'جوائز'],
      en: 'Every saved scan earns green points based on the device value and the CO₂ you avoid. Open Rewards to see the vouchers you can unlock.',
      ar: 'كل جهاز بتحفظه بيعطيك نقاط خضراء حسب قيمته والكربون اللي وفّرته. افتح تبويب Rewards لتشوف القسائم اللي بتفتحها.' },
    { k: ['where', 'drop off', 'drop-off', 'dropoff', 'collection', 'collect', 'near', 'location', 'address',
          'وين', 'اين', 'نقطه تجميع', 'نقاط التجميع', 'نقطه تسليم', 'قريب', 'موقع', 'عنوان', 'تسليم'],
      en: 'Open the Drop-off tab to see the collection points and get directions.',
      ar: 'افتح تبويب Drop-off لتشوف نقاط التجميع وتاخد الاتجاهات.' },
    { k: ['scanner', 'scan', 'analyse', 'analyze', 'estimate', 'photo', 'picture', 'accura', 'ماسح', 'تحليل', 'صوره', 'دقه', 'تقدير'],
      en: 'Pick the device type, condition, age and segment, then press Get my estimate. You can add a photo for your records. The more accurate your choices, the better the estimate.',
      ar: 'اختار نوع الجهاز وحالته وعمره وفئته، واضغط Get my estimate. بتقدر تضيف صورة لسجلك. كل ما كانت اختياراتك أدق، كان التقدير أدق.' },
    { k: ['laptop', 'computer', 'pc', 'macbook', 'لابتوب', 'لاب توب', 'كمبيوتر', 'حاسوب'],
      en: 'Laptops can often be reused. Wipe the drive and bring the charger, it raises the value. Broken ones are recycled for copper, aluminium and gold.',
      ar: 'اللابتوب غالباً بينعاد استخدامه. امسح القرص وجيب الشاحن معه لأنه بيرفع القيمة. التالف بيتدور لاستخراج النحاس والألمنيوم والذهب.' },
    { k: ['phone', 'mobile', 'iphone', 'android', 'samsung', 'smartphone', 'هاتف', 'جوال', 'موبايل', 'تلفون', 'ايفون', 'سامسونج'],
      en: 'Old phones contain gold, copper and cobalt. If it still works, get an estimate for a trade-in value; if not, recycling it keeps toxic materials out of landfill.',
      ar: 'الموبايلات القديمة فيها ذهب ونحاس وكوبالت. إذا شغّال اطلب تقدير للحصول على قيمة، وإذا لا، تدويره بيمنع المواد السامة من المكب.' },
    { k: ['tv', 'television', 'fridge', 'washing machine', 'microwave', 'appliance', 'تلفزيون', 'شاشه', 'ثلاجه', 'غساله', 'مايكرويف'],
      en: 'Old TVs and appliances contain copper, glass and sometimes hazardous parts. Never put them in the regular bin: hand them in at a collection point.',
      ar: 'التلفزيونات والأجهزة الكبيرة القديمة فيها نحاس وزجاج وأحياناً مواد خطرة. لا ترميها بالزبالة العادية: سلّمها لنقطة تجميع.' },
    { k: ['e-waste', 'ewaste', 'e waste', 'landfill', 'toxic', 'environment', 'why recycle', 'نفايات', 'بيئه', 'تدوير'],
      en: 'E-waste is discarded electronics. Recycling recovers metals like gold and copper and keeps toxic materials out of landfill, and reusing a working device saves the most CO₂.',
      ar: 'النفايات الإلكترونية هي الأجهزة المرمية. التدوير بيسترجع معادن مثل الذهب والنحاس وبيمنع المواد السامة من المكب، وإعادة استخدام جهاز شغّال بتوفر أكثر كربون.' }
  ];

  const isArabic = s => /[\u0600-\u06FF]/.test(s);
  const norm = s => String(s).toLowerCase().replace(/[\u064B-\u0652\u0640]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');
  const hasKey = (text, key) => /[a-z]/.test(key)
    ? new RegExp('\\b' + key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(text)
    : text.includes(norm(key));
  function findTopics(q) {
    const text = norm(q);
    const scored = TOPICS.map(tp => ({ tp, n: tp.k.filter(k => hasKey(text, k)).length })).filter(x => x.n);
    const best = Math.max(0, ...scored.map(x => x.n));
    return scored.filter(x => x.n === best).slice(0, 2).map(x => x.tp);
  }
  const GREET = /^\s*(hi|hello|hey|yo|sup|good (morning|afternoon|evening))\b|^\s*(مرحبا|مرحبتين|اهلا|اهلين|هلا|هلو|هاي|هالو|يا هلا|السلام|سلام|صباح الخير|صباح النور|مساء الخير|مساء النور)/;
  const THANKS = /\b(thanks|thank you)\b|شكرا|يسلمو|مشكور/;

  const msgsBox = $('#msgs');
  let busy = false;
  const scrollDown = () => { msgsBox.scrollTop = msgsBox.scrollHeight; };
  const BOT_ICON = '<svg viewBox="0 0 24 24"><rect x="5" y="8" width="14" height="11" rx="3"/><path d="M12 4v4M9 13h.01M15 13h.01"/></svg>';

  function addMessage(text, who) {
    const row = document.createElement('div');
    row.className = 'mr ' + who;
    if (who === 'bot') row.innerHTML = '<span class="bav">' + BOT_ICON + '</span>';
    const div = document.createElement('div');
    div.className = 'msg ' + who;
    div.dir = 'auto';
    div.textContent = text;
    row.appendChild(div);
    msgsBox.appendChild(row);
    scrollDown();
    return div;
  }

  function answer(q) {
    const ar = isArabic(q), t = norm(q);
    if (t.length < 25 && GREET.test(t)) return ar ? 'أهلاً! شو الجهاز اللي بدك تعيد تدويره؟' : 'Hi! What would you like to recycle today?';
    if (t.length < 25 && THANKS.test(t)) return ar ? 'العفو! كل جهاز بتدوّره بيفرق.' : "You're welcome! Every device you recycle counts.";
    const hits = findTopics(q);
    if (hits.length) return hits.map(h => ar ? h.ar : h.en).join('\n\n');
    return ar
      ? 'أنا EcoBot وبساعد بالنفايات الإلكترونية وإعادة التدوير بس. اسألني عن: مسح البيانات، البطاريات، الأسعار، النقاط أو أماكن التسليم.'
      : "I'm EcoBot and I only help with e-waste and recycling. Ask me about wiping data, batteries, prices, points or drop-off locations.";
  }

  const greet = () => addMessage("Hello, I'm EcoBot. Ask me how to recycle a device, wipe your data or handle old batteries.", 'bot');
  greet();

  const SUGGESTIONS = ['How do I wipe my phone?', 'What about old batteries?', 'How are points earned?', 'كيف أمسح بيانات جوالي؟'];
  $('#sug').innerHTML = SUGGESTIONS.map((s, i) => `<button class="chip" type="button" style="--i:${i}">${esc(s)}</button>`).join('');
  $('#sug').onclick = e => {
    const btn = e.target.closest('.chip');
    if (!btn || busy) return;
    $('#chatInput').value = btn.textContent;
    $('#chatForm').requestSubmit();
  };
  $('#clearChat').onclick = () => { if (busy) return; msgsBox.innerHTML = ''; greet(); };

  $('#chatForm').addEventListener('submit', async e => {
    e.preventDefault();
    const input = $('#chatInput');
    const q = input.value.trim().slice(0, 300);
    if (!q || busy) return;
    busy = true;
    input.value = '';
    $('#sendBtn').disabled = true;
    addMessage(q, 'me');
    const bubble = addMessage('', 'bot');
    bubble.innerHTML = '<span class="dots"><i></i><i></i><i></i></span>';
    await new Promise(r => setTimeout(r, 450));
    const text = answer(q);
    bubble.textContent = '';
    const delay = Math.max(4, Math.min(14, 1800 / text.length));
    for (const ch of text) {
      bubble.textContent += ch;
      await new Promise(r => setTimeout(r, delay));
    }
    busy = false;
    $('#sendBtn').disabled = false;
    input.focus();
    scrollDown();
  });

  /* ========== 12. Settings: profile, security, data ========== */
  // Same password scheme as the login page (PBKDF2 + random salt)
  const enc = new TextEncoder();
  const b64 = u8 => btoa(String.fromCharCode(...u8));
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const legacy = s => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h >>> 0).toString(36); };
  async function hashPass(pass, salt) {
    if (!(window.crypto && crypto.subtle)) return 'f:' + legacy(salt + pass);
    const key = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: unb64(salt), iterations: 150000, hash: 'SHA-256' }, key, 256);
    return b64(new Uint8Array(bits));
  }
  const newSalt = () => b64(crypto.getRandomValues(new Uint8Array(16)));

  function loadSettings() {
    const l = level(totals().points);
    $('#pfAv').textContent = first[0].toUpperCase();
    $('#pfName').textContent = fullName;
    $('#pfMail').textContent = EMAIL;
    $('#pfTier').textContent = l.name + ' tier';
    $('#pfSince').textContent = 'Member since ' + new Date(account.created || Date.now()).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
    $('#setName').value = fullName;
  }

  $('#profileForm').addEventListener('submit', e => {
    e.preventDefault();
    const name = $('#setName').value.trim().replace(/\s+/g, ' ');
    if (name.length < 2) return toast('Enter your name.');
    const list = store.users();
    const rec = list.find(u => u.email === EMAIL);
    if (!rec) return toast('Account not found in this browser.');
    rec.name = name;
    if (!store.saveUsers(list)) return toast('Could not save your name in this browser.');
    try { sessionStorage.setItem('circutech_session', JSON.stringify({ ...session, name })); } catch {}
    toast('Name saved in this browser.');
    setTimeout(() => location.reload(), 600);
  });

  $('#securityForm').addEventListener('submit', async e => {
    e.preventDefault();
    const oldP = $('#pwOld').value, newP = $('#pwNew').value;
    const list = store.users();
    const rec = list.find(u => u.email === EMAIL);
    if (!rec) return toast('Account not found in this browser.');
    try {
      const ok = rec.salt ? (await hashPass(oldP, rec.salt)) === rec.hash : rec.pass === legacy(oldP);
      if (!ok) return toast('Current password is wrong.');
      if (newP.length < 8 || !/[A-Za-z]/.test(newP) || !/\d/.test(newP)) return toast('New password needs 8+ characters with letters and numbers.');
      rec.salt = newSalt();
      rec.hash = await hashPass(newP, rec.salt);
      delete rec.pass;
      if (!store.saveUsers(list)) return toast('Could not save your password in this browser.');
      $('#pwOld').value = $('#pwNew').value = '';
      toast('Password saved in this browser.');
    } catch {
      toast('Password update failed. Check browser storage and try again.');
    }
  });

  $('#themeSeg').addEventListener('click', e => {
    const btn = e.target.closest('.chip');
    if (!btn) return;
    try { localStorage.setItem('theme', btn.dataset.v); } catch {}
    setTheme(btn.dataset.v);
  });

  $('#exportData').onclick = () => {
    const data = { account: { name: fullName, email: EMAIL, created: account.created }, scans: store.scans().map(({ thumb, ...s }) => s), articlesRead: store.articleReads(), vouchers: store.vouchers(), spentPoints: store.spent(), business: load(localStorage, BIZ_KEY, null) };
    download('circutech-my-data.json', 'application/json', JSON.stringify(data, null, 2));
    toast('Your data was downloaded');
  };
  $('#clearData').onclick = () => {
    if (!confirm('Delete your scans, article reading activity, and vouchers from this browser?')) return;
    store.clear();
    updateSideLevel();
    toast('Your scans, article reads, and vouchers were cleared');
  };
  $('#delAcc').onclick = () => {
    if (!confirm('Delete your account and all your data? This cannot be undone.')) return;
    if (!store.saveUsers(store.users().filter(u => u.email !== EMAIL))) return toast('Could not delete your account from this browser.');
    store.clear();
    try { localStorage.removeItem(BIZ_KEY); } catch {}
    const listings = load(localStorage, 'circutech_listings', []);
    if (Array.isArray(listings)) save('circutech_listings', listings.filter(listing => listing.owner !== EMAIL && listing.buyer !== EMAIL));
    const reports = load(localStorage, 'circutech_reports', []);
    if (Array.isArray(reports)) save('circutech_reports', reports.filter(report => report.reporter !== EMAIL));
    signOut();
  };

  $('#exportCsv').onclick = () => {
    const scans = store.scans();
    if (!scans.length) return toast('No scans to export yet.');
    const header = ['Date', 'Device', 'Brand / model', 'Condition', 'Grade', 'Value min (JOD)', 'Value max (JOD)', 'CO2 avoided (kg)', 'Points'];
    const rows = scans.map(s => [new Date(s.date).toISOString().slice(0, 10), s.device, s.brand, s.cond, s.grade, s.lo, s.hi, s.co2, s.points]);
    download('circutech-scans.csv', 'text/csv;charset=utf-8', '\ufeff' + csvOf([header, ...rows]));
    toast('Report exported');
  };

  /* ========== 13. Hero banner ========== */
  const BANNER = {
    scanner:   ['Get a value for any device', 'Pick the type and condition. You get a price range, CO₂ saved and points in seconds.'],
    dashboard: ['Your impact so far', 'Every device you recover keeps metals in use and toxic material out of landfill.'],
    dropoff:   ['Hand it in nearby', 'Find an open collection point, get directions and bring your device.'],
    rewards:   ['Turn recycling into rewards', 'Collect points with every scan and redeem them for vouchers.'],
    business:  ['Run a greener company', 'Trade-in programmes, ESG reporting and bulk pick-up for your organisation.'],
    settings:  ['Your account', 'Manage your profile, password, theme and data.']
  };
  function renderBanner(id) {
    const ban = $('#heroBan');
    ban.hidden = isAdminUser || id === 'ecobot' || !BANNER[id];
    if (ban.hidden) return;
    const t = totals();
    $('#hbHi').textContent = hello + ', ' + first;
    $('#hbTitle').textContent = BANNER[id][0];
    $('#hbSub').textContent = BANNER[id][1];
    $('#hbStats').innerHTML = [[t.points, 'green points'], [t.n, 'devices'], [t.co2, 'kg CO₂ avoided']].map(s => `<div><b>${s[0]}</b><span>${s[1]}</span></div>`).join('');
  }

  /* ========== 14. Business ========== */
  const biz = { get: () => load(localStorage, BIZ_KEY, null), set: v => save(BIZ_KEY, v) };
  const hashStr = s => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
  const TEAM = ['Omar H.', 'Lina S.', 'Khaled A.', 'Sara M.', 'Yazan T.', 'Dana R.'];

  function bizData(b) {
    const t = totals();
    const team = TEAM.map(name => {
      const h = hashStr(b.company + name);
      const dev = 2 + (h % 9), co2 = Math.round(dev * (18 + (h >> 4) % 40));
      return { name, dev, co2, pts: Math.round(dev * 55 + co2 * 2) };
    });
    team.push({ name: first + ' (you)', dev: t.n, co2: t.co2, pts: t.points, me: true });
    team.sort((a, b2) => b2.pts - a.pts);
    const dev = team.reduce((a, x) => a + x.dev, 0);
    const co2 = Math.round(team.reduce((a, x) => a + x.co2, 0));
    const engaged = team.filter(x => x.dev > 0).length;
    const score = Math.min(100, Math.round(25 + dev * 1.6 + co2 / 40 + engaged * 3));
    const grade = score >= 85 ? 'Leader' : score >= 65 ? 'Advanced' : score >= 45 ? 'Progressing' : 'Getting started';
    return { team, dev, co2, engaged, score, grade };
  }

  function renderBusiness() {
    const b = biz.get();
    $('#bizSetup').hidden = !!b;
    $('#bizSpace').hidden = !b;
    if (!b) return;
    const d = bizData(b);
    $('#bzTitle').textContent = b.company;
    $('#bzMeta').textContent = b.industry + ' · ' + b.staff + ' employees · Free trial';
    $('#bScore').textContent = d.score;
    setRing($('#bf'), d.score);
    $('#bGrade').textContent = d.grade;
    $('#bHint').textContent = d.score >= 85 ? 'Top performance. Download your certificate.' : 'Invite more employees and request a pick-up to raise your score.';
    count($('#bDev'), d.dev);
    count($('#bCo2'), d.co2);
    count($('#bEmp'), d.engaged);
    $('#bTrees').textContent = '≈ ' + Math.max(1, Math.round(d.co2 / 21)) + ' tree-years of absorption';
    $('#bEmpOf').textContent = 'of ' + b.staff + ' employees';
    $('#bzCode').textContent = 'CO-' + hashStr(b.company).toString(36).toUpperCase().slice(0, 6);
    const top = Math.max(1, ...d.team.map(x => x.pts));
    $('#bzBoard').innerHTML = d.team.map((x, i) => `<div class="li" style="cursor:default${x.me ? ';border-color:var(--teal)' : ''}"><span class="rank${i < 3 ? ' r' + (i + 1) : ''}">${i + 1}</span><div class="tx"><b>${esc(x.name)}</b><small>${x.dev} devices · ${x.co2} kg CO₂</small><div class="mini"><i style="width:${Math.round(x.pts / top * 100)}%"></i></div></div><span class="end">${x.pts} pts</span></div>`).join('');
    const ps = b.pickups || [];
    $('#pkList').innerHTML = ps.length
      ? ps.map((p, i) => {
          const st = p.status || 'Requested';
          const cls = st === 'Confirmed' ? 'o' : st === 'Declined' ? 'b' : 'w';
          return `<div class="li" style="cursor:default"><span class="ph"><svg viewBox="0 0 24 24"><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7"/></svg></span><div class="tx"><b>${p.n} devices · ${esc(p.type)}</b><small>${esc(p.date || 'Date to confirm')} · ${esc(p.area)}</small></div><span class="pill-s ${cls}">${esc(st)}</span>${p.status ? '' : `<button class="cp" type="button" data-cancel="${i}">Cancel</button>`}</div>`;
        }).join('')
      : '<div class="li" style="cursor:default"><div class="tx"><b>No requests yet</b><small>Fill the form above to schedule a collection.</small></div></div>';
  }

  $('#bzCreate').onclick = () => {
    const company = $('#bzName').value.trim();
    if (company.length < 2) return toast('Enter your company name.');
    biz.set({ company, industry: $('#bzInd').value, staff: Math.max(1, +$('#bzStaff').value || 1), pickups: [] });
    toast('Workspace created. Welcome, ' + company);
    renderBusiness(); stagger();
  };
  $('#pkGo').onclick = () => {
    const b = biz.get(); if (!b) return;
    const n = +$('#pkN').value, area = $('#pkA').value.trim();
    if (!n || n < 1) return toast('Enter the number of devices.');
    if (!area) return toast('Enter your area so we can plan the route.');
    b.pickups = [{ n, type: $('#pkT').value, date: $('#pkD').value, area, at: Date.now() }, ...(b.pickups || [])];
    biz.set(b); $('#pkA').value = '';
    toast(n >= 10 ? 'Pick-up requested. It is free for 10+ devices.' : 'Pick-up requested. Fees may apply under 10 devices.');
    renderBusiness();
  };
  $('#pkList').addEventListener('click', e => {
    const btn = e.target.closest('[data-cancel]'); if (!btn) return;
    const b = biz.get(); b.pickups.splice(+btn.dataset.cancel, 1); biz.set(b); renderBusiness();
  });
  $('#bzCopy').onclick = () => {
    const code = $('#bzCode').textContent;
    (navigator.clipboard ? navigator.clipboard.writeText(code) : Promise.reject()).then(() => toast('Code copied'), () => toast(code));
  };
  $('#bzCsv').onclick = () => {
    const b = biz.get(); if (!b) return;
    const d = bizData(b);
    const rows = [['Company', b.company], ['Industry', b.industry], ['Employees', b.staff], ['Devices recovered', d.dev], ['CO2 avoided (kg)', d.co2], ['ESG score', d.score], ['Generated', new Date().toISOString().slice(0, 10)], [], ['Team member', 'Devices', 'CO2 (kg)', 'Points'], ...d.team.map(x => [x.name, x.dev, x.co2, x.pts])];
    download('circutech-esg-report.csv', 'text/csv;charset=utf-8', '\ufeff' + csvOf(rows));
    toast('ESG report exported');
  };
  $('#bzCert').onclick = () => {
    const b = biz.get(); if (!b) return;
    const d = bizData(b), id = 'CERT-' + hashStr(b.company + d.dev).toString(36).toUpperCase().slice(0, 7);
    const w = window.open('', '_blank');
    if (!w) return toast('Allow pop-ups to print the certificate.');
    w.document.write(`<!doctype html><title>Impact certificate</title><style>body{font-family:system-ui,sans-serif;margin:0;padding:40px;color:#0d3b2e}.c{border:6px double #0d3b2e;border-radius:18px;padding:48px;text-align:center;max-width:760px;margin:auto}h1{font-size:34px;margin:6px 0}h2{font-size:30px;margin:18px 0;color:#157a3c}.g{display:flex;justify-content:center;gap:40px;margin:28px 0}.g b{display:block;font-size:34px}.g span{font-size:13px;color:#536961}small{color:#536961}</style><div class="c"><small>CIRCUTECH JO</small><h1>Certificate of Environmental Impact</h1><p>This certifies that</p><h2>${esc(b.company)}</h2><p>has responsibly recovered electronic devices through the CircuTech Jo platform.</p><div class="g"><div><b>${d.dev}</b><span>devices recovered</span></div><div><b>${d.co2} kg</b><span>CO₂ avoided</span></div><div><b>${d.score}</b><span>ESG score</span></div></div><small>${id} · Issued ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} · Demo figures</small></div><script>onload=()=>print()<\/script>`);
    w.document.close();
  };

  /* ========== 15. Admin dashboard (browser-stored project data) ========== */
  const ADMIN_LISTINGS_KEY = 'circutech_listings';
  const ADMIN_REPORTS_KEY = 'circutech_reports';
  const adminRows = (rows, colspan, message) => rows || `<tr><td colspan="${colspan}">${message}</td></tr>`;
  const adminDate = value => value ? new Date(value).toLocaleDateString() : '—';
  const adminScans = () => Object.keys(localStorage).filter(key => key.startsWith('circutech_scans:'))
    .flatMap(key => {
      const email = key.slice('circutech_scans:'.length);
      const scans = load(localStorage, key, []);
      return Array.isArray(scans) ? scans.map(scan => ({ ...scan, email })) : [];
    }).sort((a, b) => (+b.date || 0) - (+a.date || 0));
  const adminVouchers = () => Object.keys(localStorage).filter(key => key.startsWith('circutech_vouchers:'))
    .flatMap(key => {
      const email = key.slice('circutech_vouchers:'.length);
      const vouchers = load(localStorage, key, []);
      return Array.isArray(vouchers) ? vouchers.map(voucher => ({ ...voucher, email })) : [];
    });
  const adminBusinesses = () => Object.keys(localStorage).filter(key => key.startsWith('circutech_biz:'))
    .map(key => ({ key, ...load(localStorage, key, {}) })).filter(business => business.company);
  const adminListings = () => {
    const listings = load(localStorage, ADMIN_LISTINGS_KEY, []);
    return Array.isArray(listings) ? listings : [];
  };
  const adminPlaces = () => {
    const places = load(localStorage, 'circutech_places', PLACES);
    return Array.isArray(places) ? places : PLACES;
  };
  const adminTiers = () => {
    const tiers = load(localStorage, 'circutech_tiers', TIERS);
    return Array.isArray(tiers) ? tiers : TIERS;
  };
  const adminSet = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
  };
  const adminArticles = () => window.CircuTechNews ? window.CircuTechNews.list() : [];
  const slugifyArticle = title => title.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
  const articleBodyText = body => {
    const parsed = new DOMParser().parseFromString(String(body || ''), 'text/html');
    return parsed.body.textContent.replace(/\n{3,}/g, '\n\n').trim();
  };
  const articleBodyHtml = text => text.split(/\r?\n\s*\r?\n/).map(paragraph => paragraph.trim()).filter(Boolean)
    .map(paragraph => '<p>' + esc(paragraph).replace(/\r?\n/g, '<br>') + '</p>').join('');

  function resetArticleForm() {
    $('#adminArticleForm').reset();
    $('#adminArticleId').value = '';
    $('#adminArticleRead').value = '4';
    $('#adminArticleStatus').value = 'published';
    $('#adminArticleDate').value = new Date().toISOString().slice(0, 10);
    $('#adminArticleSave').textContent = 'Publish article';
    $('#adminArticleCancel').hidden = true;
    $('#adminArticleMessage').textContent = '';
  }

  function editAdminArticle(id) {
    const article = adminArticles().find(item => item.id === id);
    if (!article) return toast('Article no longer exists.');
    $('#adminArticleId').value = article.id;
    $('#adminArticleTitle').value = article.title || '';
    $('#adminArticleCategory').value = article.cat || '';
    $('#adminArticleDate').value = article.date || '';
    $('#adminArticleRead').value = article.read || 4;
    $('#adminArticleStatus').value = article.status === 'draft' ? 'draft' : 'published';
    $('#adminArticleImage').value = article.img || '';
    $('#adminArticleLead').value = article.lead || '';
    $('#adminArticleBody').value = articleBodyText(article.body);
    $('#adminArticleSave').textContent = 'Save changes';
    $('#adminArticleCancel').hidden = false;
    $('#adminArticleTitle').focus();
  }

  function renderAdminNews() {
    const articles = adminArticles().slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const query = $('#adminArticleSearch').value.trim().toLowerCase();
    const status = $('#adminArticleFilter').value;
    const filtered = articles.filter(article => {
      const matchesStatus = status === 'all' || (article.status === 'draft' ? 'draft' : 'published') === status;
      const searchable = [article.title, article.cat, article.lead].join(' ').toLowerCase();
      return matchesStatus && (!query || searchable.includes(query));
    });
    $('#adminArticleRows').innerHTML = adminRows(filtered.map(article => `<tr><td>${esc(article.title)}</td><td>${esc(article.cat)}</td><td>${adminDate(article.date)}</td><td>${article.status === 'draft' ? 'Draft' : 'Published'}</td><td class="admin-actions"><button class="btn out sm" type="button" data-admin-action="edit-article" data-id="${esc(article.id)}">Edit</button> <button class="btn out sm" type="button" data-admin-action="delete-article" data-id="${esc(article.id)}">Delete</button></td></tr>`).join(''), 5, articles.length ? 'No articles match these filters.' : 'No articles yet.');
  }

  function renderAdmin(id) {
    const scans = adminScans();
    const users = store.users().filter(item => item.role !== 'admin');
    const publishedArticles = adminArticles().filter(article => article.status !== 'draft').length;
    const listings = adminListings();
    const vouchers = adminVouchers();
    const businesses = adminBusinesses();
    const pickupCount = businesses.reduce((count, business) => count + (business.pickups || []).filter(item => !item.status).length, 0);
    const pendingListings = listings.filter(item => item.status === 'pending').length;

    if (id === 'adminOverview') {
      const sum = key => scans.reduce((total, scan) => total + (+scan[key] || 0), 0);
      $('#adminStats').innerHTML = [
        ['User accounts', users.length], ['Device scans', scans.length],
        ['Estimated value', 'JOD ' + Math.round(sum('mid'))],
        ['CO₂ avoided', Math.round(sum('co2')) + ' kg'],
        ['Voucher redemptions', vouchers.length], ['Businesses', businesses.length], ['Published news', publishedArticles]
      ].map(([label, value]) => `<div class="card admin-stat"><span>${label}</span><b>${value}</b></div>`).join('');
      $('#adminRecentScans').innerHTML = adminRows(scans.slice(0, 6).map(scan => `<tr><td>${adminDate(scan.date)}</td><td>${esc(scan.device || 'Device')}</td><td>${esc(scan.email)}</td><td>JOD ${esc(scan.mid || 0)}</td></tr>`).join(''), 4, 'No saved scans yet.');
      $('#adminPending').innerHTML = `<a href="#adminListings"><span>Marketplace listings awaiting review</span><b>${pendingListings}</b></a><a href="#adminBusiness"><span>Business pickups awaiting action</span><b>${pickupCount}</b></a><a href="#adminPlaces"><span>Collection points</span><b>${adminPlaces().filter(place => !place.off).length}</b></a>`;
      const announcement = load(localStorage, 'circutech_announce', null) || {};
      $('#adminAnnouncement').value = announcement.text || '';
      $('#adminAnnouncementOn').checked = !!announcement.on;
      $('#adminAnnouncementKind').value = announcement.kind === 'warn' ? 'warn' : 'info';
    }

    if (id === 'adminUsers') {
      $('#adminUserRows').innerHTML = adminRows(users.map(account => {
        const ownScans = load(localStorage, 'circutech_scans:' + account.email, []);
        const points = Array.isArray(ownScans) ? ownScans.reduce((total, scan) => total + (+scan.points || 0), 0) : 0;
        const role = account.role === 'business' ? 'business' : 'user';
        return `<tr><td>${esc(account.name || 'User')}</td><td>${esc(account.email)}</td><td><select class="admin-role" aria-label="Role for ${esc(account.email)}" data-admin-role="${esc(account.email)}"><option value="user"${role === 'user' ? ' selected' : ''}>User</option><option value="business"${role === 'business' ? ' selected' : ''}>Business</option></select></td><td>${adminDate(account.created)}</td><td>${Array.isArray(ownScans) ? ownScans.length : 0}</td><td>${Math.round(points)}</td><td><button class="btn out sm" type="button" data-admin-action="delete-user" data-id="${esc(account.email)}">Delete</button></td></tr>`;
      }).join(''), 7, 'No user accounts yet.');
    }

    if (id === 'adminNews') renderAdminNews();

    if (id === 'adminScans') {
      $('#adminScanRows').innerHTML = adminRows(scans.map(scan => `<tr><td>${adminDate(scan.date)}</td><td>${esc(scan.email)}</td><td>${esc(scan.device || 'Device')}</td><td>${esc(scan.brand || '—')}</td><td>${esc(scan.cond || '—')}</td><td>JOD ${esc(scan.lo || 0)}–${esc(scan.hi || 0)}</td><td>${esc(scan.co2 || 0)} kg</td><td>${esc(scan.points || 0)}</td></tr>`).join(''), 8, 'No saved scans yet.');
    }

    if (id === 'adminListings') {
      $('#adminListingRows').innerHTML = adminRows(listings.map(listing => {
        const actions = listing.status === 'pending'
          ? `<button class="btn sm" type="button" data-admin-action="approve-listing" data-id="${esc(listing.id)}">Approve</button> <button class="btn out sm" type="button" data-admin-action="reject-listing" data-id="${esc(listing.id)}">Reject</button>`
          : ['live', 'reserved'].includes(listing.status)
            ? `<button class="btn out sm" type="button" data-admin-action="remove-listing" data-id="${esc(listing.id)}">Remove</button>` : '—';
        return `<tr><td>${esc(listing.title || 'Untitled')}</td><td>${esc(listing.ownerName || listing.owner || '—')}</td><td>${esc(listing.cat || '—')}</td><td>JOD ${esc(listing.price || 0)}</td><td>${esc(listing.status || '—')}</td><td class="admin-actions">${actions}</td></tr>`;
      }).join(''), 6, 'No marketplace listings yet.');
    }

    if (id === 'adminPlaces') {
      $('#adminPlaceRows').innerHTML = adminRows(adminPlaces().map((place, index) => `<tr><td>${esc(place.name)}</td><td>${esc(place.area)}</td><td>${esc(place.hours || 'Hours not set')}</td><td><button class="btn out sm" type="button" data-admin-action="delete-place" data-id="${index}">Remove</button></td></tr>`).join(''), 4, 'No collection points configured.');
    }

    if (id === 'adminRewards') {
      $('#adminTierRows').innerHTML = adminRows(adminTiers().map((tier, index) => `<tr><td>${esc(tier[2])}</td><td>${esc(tier[0])}</td><td>JOD ${esc(tier[1])}</td><td><button class="btn out sm" type="button" data-admin-action="delete-tier" data-id="${index}">Remove</button></td></tr>`).join(''), 4, 'No reward tiers configured.');
      $('#adminVoucherRows').innerHTML = adminRows(vouchers.map(voucher => `<tr><td>${adminDate(voucher.date)}</td><td>${esc(voucher.email)}</td><td>${esc(voucher.name)} · JOD ${esc(voucher.jod)}</td><td>${esc(voucher.code)}</td></tr>`).join(''), 4, 'No redeemed vouchers yet.');
    }

    if (id === 'adminBusiness') {
      $('#adminBusinessRows').innerHTML = adminRows(businesses.map(business => `<tr><td>${esc(business.company)}</td><td>${esc(business.industry || '—')}</td><td>${esc(business.staff || 0)}</td><td>${esc(business.email)}</td></tr>`).join(''), 4, 'No business workspaces yet.');
      const pickups = businesses.flatMap(business => (business.pickups || []).map((pickup, index) => ({ business, pickup, index })));
      $('#adminPickupRows').innerHTML = adminRows(pickups.map(({ business, pickup, index }) => {
        const actions = pickup.status ? '—' : `<button class="btn sm" type="button" data-admin-action="pickup-confirm" data-id="${esc(business.key)}" data-index="${index}">Confirm</button> <button class="btn out sm" type="button" data-admin-action="pickup-decline" data-id="${esc(business.key)}" data-index="${index}">Decline</button>`;
        return `<tr><td>${esc(business.company)}</td><td>${esc(pickup.n || 0)}</td><td>${esc(pickup.type || '—')}</td><td>${esc(pickup.date || 'To confirm')}</td><td>${esc(pickup.area || '—')}</td><td>${esc(pickup.status || 'Requested')}</td><td class="admin-actions">${actions}</td></tr>`;
      }).join(''), 7, 'No pickup requests yet.');
    }
  }

  document.addEventListener('click', e => {
    const button = e.target.closest('[data-admin-action]');
    if (!button || !isAdminUser) return;
    const action = button.dataset.adminAction;
    const id = button.dataset.id;
    if (action === 'delete-user') {
      if (!confirm('Delete this user and their browser-stored data?')) return;
      store.saveUsers(store.users().filter(account => account.email !== id));
      ['circutech_scans:', 'circutech_spent:', 'circutech_vouchers:', 'circutech_article_reads:', 'circutech_biz:'].forEach(prefix => localStorage.removeItem(prefix + id));
      adminSet(ADMIN_LISTINGS_KEY, adminListings().filter(listing => listing.owner !== id && listing.buyer !== id));
      adminSet(ADMIN_REPORTS_KEY, load(localStorage, ADMIN_REPORTS_KEY, []).filter(report => report.reporter !== id));
    }
    if (action === 'approve-listing' || action === 'reject-listing' || action === 'remove-listing') {
      const listings = adminListings();
      const listing = listings.find(item => item.id === id);
      if (listing) {
        listing.status = action === 'approve-listing' ? 'live' : action === 'reject-listing' ? 'rejected' : 'removed';
        listing.reason = action === 'reject-listing' ? 'Not approved by an administrator.' : '';
        listing.history = Array.isArray(listing.history) ? listing.history : [];
        listing.history.push({ ev: action === 'approve-listing' ? 'Approved' : action === 'reject-listing' ? 'Rejected' : 'Removed', at: Date.now() });
        adminSet(ADMIN_LISTINGS_KEY, listings);
      }
    }
    if (action === 'delete-place') {
      const places = adminPlaces();
      places.splice(+id, 1);
      adminSet('circutech_places', places);
    }
    if (action === 'delete-tier') {
      const tiers = adminTiers();
      if (tiers.length <= 1) return toast('Keep at least one reward tier.');
      tiers.splice(+id, 1);
      adminSet('circutech_tiers', tiers);
    }
    if (action === 'pickup-confirm' || action === 'pickup-decline') {
      const business = load(localStorage, id, null);
      if (business && business.pickups && business.pickups[+button.dataset.index]) {
        business.pickups[+button.dataset.index].status = action === 'pickup-confirm' ? 'Confirmed' : 'Declined';
        adminSet(id, business);
      }
    }
    if (action === 'edit-article') {
      editAdminArticle(id);
    }
    if (action === 'delete-article') {
      if (!confirm('Delete this article from this browser?')) return;
      const remaining = adminArticles().filter(article => article.id !== id);
      if (!window.CircuTechNews.save(remaining)) return toast('Could not save changes in this browser.');
      if ($('#adminArticleId').value === id) resetArticleForm();
      toast('Article deleted from this browser.');
    }
    renderAdmin(location.hash.slice(1) || 'adminOverview');
  });

  document.addEventListener('change', e => {
    const select = e.target.closest('[data-admin-role]');
    if (!select || !isAdminUser) return;
    const nextRole = select.value === 'business' ? 'business' : 'user';
    const accounts = store.users();
    const target = accounts.find(account => account.email === select.dataset.adminRole && account.role !== 'admin');
    if (!target) return renderAdmin('adminUsers');
    target.role = nextRole;
    if (!store.saveUsers(accounts)) {
      toast('Could not save this role in the browser.');
      return renderAdmin('adminUsers');
    }
    renderAdmin('adminUsers');
    toast(nextRole === 'business' ? 'Business workspace access granted in this browser.' : 'Business workspace access removed in this browser.');
  });

  $('#adminArticleForm').addEventListener('submit', e => {
    e.preventDefault();
    const idField = $('#adminArticleId');
    const title = $('#adminArticleTitle').value.trim();
    const category = $('#adminArticleCategory').value.trim();
    const date = $('#adminArticleDate').value;
    const lead = $('#adminArticleLead').value.trim();
    const bodyText = $('#adminArticleBody').value.trim();
    const image = $('#adminArticleImage').value.trim();
    const message = $('#adminArticleMessage');
    message.textContent = '';
    if (!title || !category || !date || !lead || !bodyText) {
      message.textContent = 'Complete the title, category, date, summary, and article content.';
      return;
    }
    if (image && !/^https?:\/\//i.test(image)) {
      message.textContent = 'Use an HTTPS or HTTP image URL, or leave it blank.';
      return;
    }
    const articles = adminArticles();
    const oldId = idField.value;
    const existingIndex = oldId ? articles.findIndex(article => article.id === oldId) : -1;
    if (oldId && existingIndex < 0) {
      message.textContent = 'This article no longer exists. Refresh the list and try again.';
      return;
    }
    let id = oldId || slugifyArticle(title) || 'article';
    if (!oldId) {
      const base = id;
      let suffix = 2;
      while (articles.some(article => article.id === id)) id = base + '-' + suffix++;
    }
    const article = {
      ...(existingIndex >= 0 ? articles[existingIndex] : {}),
      id,
      cat: category.toUpperCase(),
      tag: category,
      date,
      read: Math.max(1, Math.min(60, Number($('#adminArticleRead').value) || 4)),
      img: image,
      title,
      lead,
      body: articleBodyHtml(bodyText),
      status: $('#adminArticleStatus').value === 'draft' ? 'draft' : 'published'
    };
    if (existingIndex >= 0) articles[existingIndex] = article;
    else articles.push(article);
    if (!window.CircuTechNews.save(articles)) {
      message.textContent = 'Could not save this article in browser storage.';
      return;
    }
    resetArticleForm();
    renderAdminNews();
    toast(oldId ? 'Article changes saved in this browser.' : 'Article saved in this browser.');
  });
  $('#adminArticleCancel').addEventListener('click', resetArticleForm);
  $('#adminArticleSearch').addEventListener('input', renderAdminNews);
  $('#adminArticleFilter').addEventListener('change', renderAdminNews);

  $('#adminExportScans').onclick = () => {
    const scans = adminScans();
    if (!scans.length) return toast('No scans to export yet.');
    const header = ['Date', 'User', 'Device', 'Model', 'Condition', 'Grade', 'Value min (JOD)', 'Value max (JOD)', 'CO2 avoided (kg)', 'Points'];
    const rows = scans.map(scan => [adminDate(scan.date), scan.email, scan.device, scan.brand, scan.cond, scan.grade, scan.lo, scan.hi, scan.co2, scan.points]);
    download('circutech-admin-scans.csv', 'text/csv;charset=utf-8', '\ufeff' + csvOf([header, ...rows]));
  };

  $('#adminAnnouncementForm').addEventListener('submit', e => {
    e.preventDefault();
    const text = $('#adminAnnouncement').value.trim();
    if ($('#adminAnnouncementOn').checked && !text) return toast('Enter an announcement before showing it.');
    if (!adminSet('circutech_announce', { text, on: $('#adminAnnouncementOn').checked, kind: $('#adminAnnouncementKind').value })) return toast('Could not save in this browser.');
    toast('Announcement saved in this browser.');
  });

  $('#adminPlaceForm').addEventListener('submit', e => {
    e.preventDefault();
    const open = +$('#adminPlaceOpen').value, close = +$('#adminPlaceClose').value;
    if (close <= open) { $('#adminPlaceClose').setCustomValidity('Closing time must be after opening time.'); $('#adminPlaceClose').reportValidity(); return; }
    $('#adminPlaceClose').setCustomValidity('');
    const daily = $('#adminPlaceDays').value === 'daily';
    const place = {
      name: $('#adminPlaceName').value.trim(), area: $('#adminPlaceArea').value.trim(), open, close,
      days: daily ? [0, 1, 2, 3, 4, 5, 6] : [0, 1, 2, 3, 4],
      hours: `${daily ? 'Daily' : 'Sun to Thu'} ${open}:00 to ${close}:00`,
      q: $('#adminPlaceArea').value.trim().replace('·', ',') + ', Jordan'
    };
    if (!adminSet('circutech_places', [...adminPlaces(), place])) return toast('Could not save in this browser.');
    e.target.reset();
    renderAdmin('adminPlaces');
    toast('Collection point saved in this browser.');
  });

  $('#adminTierForm').addEventListener('submit', e => {
    e.preventDefault();
    const tiers = [...adminTiers(), [+$('#adminTierPoints').value, +$('#adminTierValue').value, $('#adminTierName').value.trim()]]
      .sort((a, b) => a[0] - b[0]);
    if (!adminSet('circutech_tiers', tiers)) return toast('Could not save in this browser.');
    e.target.reset();
    renderAdmin('adminRewards');
    toast('Reward tier saved in this browser.');
  });

  /* ========== Start ========== */
  updateSideLevel();
  route();
})();