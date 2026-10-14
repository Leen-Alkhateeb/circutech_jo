(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const { esc, CO2, NAMES } = CT;
  let user = null; try { user = JSON.parse(sessionStorage.getItem('circutech_session')); } catch {}
  const me = user ? user.email : '', S = CT.settings();
  const needLogin = () => { toast('Sign in to do this. Redirecting to login…'); setTimeout(() => { location.href = '../loginpage/login.html'; }, 1100); };
  if (CT.isAdmin(me)) $('#menu').insertAdjacentHTML('beforeend', '<li><a href="../apppage/app.html#adminOverview">Admin</a></li>');

  const toast = t => { let el = $('.toast'); if (!el) { el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status'); document.body.append(el); }
    el.textContent = t; el.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('on'), 2800); };
  const fmt = t => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const update = (id, fn) => { const all = CT.listings(), l = all.find(x => x.id === id); if (!l) return; fn(l); CT.saveListings(all); };

  /* ---------- quality gate ---------- */
  let photo = '';
  function readForm() { return { title: $('#fTitle').value.trim(), cat: $('#fCat').value, cond: $('#fCond').value, price: Math.round(+$('#fPrice').value * 100) / 100 || 0, desc: $('#fDesc').value.trim(), img: photo }; }
  function check(d) {
    const soft = CT.SOFT[d.cat] * S.reviewFactor, w = (d.title + ' ' + d.desc).toLowerCase(), hit = S.banned.find(b => w.includes(b));
    return [
      { ok: d.title.length >= 3, hard: 1, t: 'Title of at least 3 characters' },
      { ok: ['like-new', 'good'].includes(d.cond), hard: 1, t: 'Condition is good or like new' },
      { ok: !!d.img, hard: 1, t: 'Clear photo added' },
      { ok: d.price >= 1 && d.price <= 2000, hard: 1, t: 'Price between 1 and 2000 JOD' },
      { ok: !hit, hard: 1, t: hit ? 'Remove the word "' + hit + '"' : 'No prohibited words' },
      { ok: d.desc.length >= 20, hard: 0, t: 'Description of at least 20 characters (needed for instant publishing)' },
      { ok: d.price <= soft, hard: 0, t: 'Price within the usual range (otherwise an admin reviews it)' }];
  }
  function paintGate() {
    const d = readForm(), touched = $('#sellForm').dataset.touched;
    $('#fee').textContent = d.price ? 'Platform fee ' + Math.round(CT.FEE * 100) + '% (JOD ' + (d.price * CT.FEE).toFixed(2) + ' only when it sells). You receive JOD ' + (d.price * (1 - CT.FEE)).toFixed(2) + '.' : 'A ' + Math.round(CT.FEE * 100) + '% fee applies only when your device sells.';
    $('#gate').innerHTML = check(d).map(c => `<li class="${c.ok ? 'ok' : !touched ? '' : c.hard ? 'bad' : 'soft'}">${esc(c.t)}</li>`).join('');
  }
  const shrink = file => new Promise(res => { const r = new FileReader();
    r.onload = () => { const im = new Image(); im.onload = () => { const k = Math.min(1, 560 / im.width), c = document.createElement('canvas');
      c.width = im.width * k; c.height = im.height * k; c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); res(c.toDataURL('image/jpeg', .72)); }; im.onerror = () => res(''); im.src = r.result; };
    r.onerror = () => res(''); r.readAsDataURL(file); });

  $('#fImg').addEventListener('change', async e => { photo = e.target.files[0] ? await shrink(e.target.files[0]) : ''; const p = $('#prev'); p.style.display = photo ? 'block' : 'none'; p.style.backgroundImage = photo ? `url(${photo})` : ''; $('#sellForm').dataset.touched = 1; paintGate(); });
  $('#sellForm').addEventListener('input', () => { $('#sellForm').dataset.touched = 1; paintGate(); });

  $('#publish').addEventListener('click', () => {
    if (!user) return needLogin();
    const msg = $('#fMsg'); msg.className = 'msg'; msg.textContent = ''; $('#sellForm').dataset.touched = 1; paintGate();
    if (CT.suspended().includes(me)) { msg.textContent = 'Your account is restricted from listing. Contact support.'; return; }
    const d = readForm(), res = check(d), bad = res.find(c => c.hard && !c.ok);
    if (bad) { msg.textContent = d.cond !== 'good' && d.cond !== 'like-new' ? 'Only devices in good or like-new condition can be sold. Damaged devices can be recycled for vouchers in the scanner.' : bad.t + '.'; return; }
    if (CT.listings().filter(l => l.owner === me && ['live', 'pending', 'reserved'].includes(l.status)).length >= S.maxLive) { msg.textContent = 'You can have up to ' + S.maxLive + ' active listings.'; return; }
    const review = res.some(c => !c.hard && !c.ok);
    const l = { ...d, id: CT.uid(), owner: me, ownerName: (user.name || 'Seller').split(' ')[0], status: review ? 'pending' : 'live', createdAt: Date.now(), history: [] };
    CT.ev(l, 'Listed'); if (review) l.reason = 'Sent for admin review because of price or description.'; else CT.ev(l, 'Published');
    if (!CT.saveListings([l, ...CT.listings()])) { msg.textContent = 'Storage is full. Delete an old listing first.'; return; }
    $('#dlg').close(); $$('#sellForm input, #sellForm textarea').forEach(i => { i.value = ''; }); photo = ''; $('#prev').style.display = 'none'; toast(review ? 'Submitted. An admin will review it shortly.' : 'Your listing is live.');
    tab = 'mine'; syncTabs(); render();
  });
  $('#sellBtn').onclick = () => { if (!user) return needLogin(); delete $('#sellForm').dataset.touched; paintGate(); $('#dlg').showModal(); };
  $('#cancel').onclick = () => $('#dlg').close();

  /* ---------- listing grid ---------- */
  let tab = 'browse';
  function syncTabs() { $$('.mk-tab').forEach(b => b.setAttribute('aria-selected', b.dataset.t === tab)); }
  const label = { live: 'Live', pending: 'In review', reserved: 'Reserved', sold: 'Sold', rejected: 'Rejected', removed: 'Removed' };

  function card(l) {
    const mine = l.owner === me, rsv = l.buyer === me && !mine;
    let acts = `<button class="btn out" data-a="pass" data-id="${l.id}" type="button">Details</button>`;
    if (tab === 'browse') acts = `<button class="btn out" data-a="cart" data-id="${esc(l.id)}" type="button">Add to cart</button><button class="btn" data-a="res" data-id="${esc(l.id)}" type="button">Reserve</button>` + acts + `<button class="btn out" data-a="rep" data-id="${esc(l.id)}" type="button">Report</button>`;
    else if (mine) {
      if (l.status === 'reserved') acts = `<button class="btn" data-a="sold" data-id="${l.id}" type="button">Mark as sold</button><button class="btn out" data-a="rel" data-id="${l.id}" type="button">Release</button>` + acts;
      if (['live', 'pending', 'rejected', 'removed'].includes(l.status)) acts += `<button class="btn out" data-a="del" data-id="${l.id}" type="button">Delete</button>`;
    } else if (rsv && l.status === 'reserved') acts = `<button class="btn out" data-a="cancel" data-id="${l.id}" type="button">Cancel reservation</button>` + acts;
    return `<article class="item"><div class="ph"><img src="${esc(l.img)}" data-category="${esc(l.cat)}" alt="${esc(l.title)}" loading="lazy"><span class="tg2">Saves ${CO2[l.cat]} kg CO₂</span><span class="vbadge">Photo supplied</span>${tab !== 'browse' ? `<span class="st ${l.status}">${label[l.status]}</span>` : ''}</div>
      <div class="bd"><h3>${esc(l.title)}</h3><small>${NAMES[l.cat]} · ${esc(l.cond.replace('-', ' '))} · ${esc(l.ownerName)}</small>${l.desc ? `<small>${esc(l.desc.slice(0, 90))}${l.desc.length > 90 ? '…' : ''}</small>` : ''}
      ${l.reason && mine ? `<span class="why">${esc(l.reason)}</span>` : ''}<div class="pr">${esc(l.price)} JOD</div><div class="acts">${acts}</div></div></article>`;
  }

  function render() {
    const all = CT.listings(), q = $('#q').value.trim().toLowerCase(), cat = $('#cat').value, cond = $('#cond').value, max = +$('#max').value || Infinity, sort = $('#sort').value;
    let list = tab === 'browse' ? all.filter(l => l.status === 'live' && l.owner !== me) : tab === 'mine' ? all.filter(l => l.owner === me) : all.filter(l => l.buyer === me && l.owner !== me && ['reserved', 'sold'].includes(l.status));
    list = list.filter(l => (!cat || l.cat === cat) && (!cond || l.cond === cond) && l.price <= max && (!q || (l.title + ' ' + l.desc).toLowerCase().includes(q)));
    list.sort((a, b) => sort === 'low' ? a.price - b.price : sort === 'high' ? b.price - a.price : b.createdAt - a.createdAt);
    const kg = all.filter(l => l.owner === me && l.status === 'sold').reduce((n, l) => n + CO2[l.cat], 0);
    $('#chip').textContent = kg ? 'You kept ' + kg + ' kg of CO₂ out of the atmosphere' : 'Sell a device to start your impact record';
    if (!user && tab !== 'browse') { $('#grid').innerHTML = '<p class="empty">Sign in to see this tab. <a href="../loginpage/login.html">Go to login</a></p>'; $('#chip').textContent = 'Sign in to track your impact'; return; }
    const empty = { browse: 'No devices match your filters. Clear a filter, or list one of your own.', mine: 'You have not listed anything yet. Choose “Sell a device” to start.', res: 'You have no reservations. Reserve a device from Browse.' }[tab];
    $('#grid').innerHTML = list.length ? list.map(card).join('') : `<p class="empty">${empty}</p>`;
    $$('#grid .item .ph img').forEach(img => img.addEventListener('error', () => {
      img.src = CT.art(img.dataset.category, 160);
    }, { once: true }));
    renderCart();
  }

  function cartIds() {
    return [...new Set(CT.cart().map(item => typeof item === 'string' ? item : item.id).filter(Boolean))];
  }

  function renderCart() {
    const ids = cartIds();
    const listings = CT.listings();
    const lines = ids.map(id => ({ id, listing: listings.find(item => item.id === id) }));
    const active = lines.filter(line => line.listing && line.listing.status === 'live');
    $('#cartCount').textContent = String(ids.length);
    $('#cartEmpty').hidden = ids.length > 0;
    $('#cartItems').innerHTML = lines.map(({ id, listing }) => listing
      ? `<article class="cart-line${listing.status === 'live' ? '' : ' unavailable'}"><img src="${esc(listing.img || CT.art(listing.cat, 160))}" data-category="${esc(listing.cat)}" alt=""><div><h3>${esc(listing.title)}</h3><p>${listing.status === 'live' ? 'Available listing' : 'Unavailable: ' + esc(listing.status)}</p><small>Quantity 1 · unique device</small></div><b>${listing.status === 'live' ? 'JOD ' + Number(listing.price).toFixed(2) : '—'}</b><button type="button" data-cart-remove="${esc(id)}" aria-label="Remove ${esc(listing.title)} from cart">Remove</button></article>`
      : `<article class="cart-line unavailable"><div></div><div><h3>Listing unavailable</h3><small>This item was removed from the marketplace.</small></div><b>—</b><button type="button" data-cart-remove="${esc(id)}" aria-label="Remove unavailable listing from cart">Remove</button></article>`
    ).join('');
    $('#cartSubtotal').textContent = 'JOD ' + active.reduce((sum, line) => sum + (Number(line.listing.price) || 0), 0).toFixed(2);
    $('#checkoutLink').setAttribute('aria-disabled', String(!ids.length || active.length !== ids.length));
    $$('#cartItems img').forEach(image => image.addEventListener('error', () => {
      image.src = CT.art(image.dataset.category, 160);
    }, { once: true }));
  }

  $('#cartOpen').addEventListener('click', () => { renderCart(); $('#cartDialog').showModal(); });
  $('#cartClose').addEventListener('click', () => $('#cartDialog').close());
  $('#cartItems').addEventListener('click', e => {
    const button = e.target.closest('[data-cart-remove]');
    if (!button) return;
    const remaining = cartIds().filter(id => id !== button.dataset.cartRemove);
    if (!CT.saveCart(remaining)) return toast('Could not update the cart in this browser.');
    renderCart();
  });
  $('#checkoutLink').addEventListener('click', e => {
    if (e.currentTarget.getAttribute('aria-disabled') === 'true') {
      e.preventDefault();
      toast('Remove unavailable listings before checkout.');
    }
  });

  /* ---------- passport ---------- */
  function passport(l) {
    const hist = (l.history || []).map(h => `<li>${esc(h.ev)}<small>${fmt(h.at)}</small></li>`).join('') || '<li>Listed<small>' + fmt(l.createdAt) + '</small></li>';
    $('#passBody').innerHTML = `<h2>${esc(l.title)}</h2><img class="pimg" src="${esc(l.img)}" alt="${esc(l.title)}"><p><b>JOD ${esc(l.price)}</b>${l.desc ? ' · ' + esc(l.desc) : ''}</p><h3 style="margin-top:14px;font-size:1.05rem">Device passport</h3><p style="color:var(--mut)">A verifiable record of this device's life on CircuTech Jo.</p>
      <div class="pp"><div class="qr">${CT.pattern(l.id)}</div><div><code>${CT.passportId(l.id)}</code><div style="margin-top:4px"><b>${esc(l.title)}</b></div><small style="color:var(--mut)">${NAMES[l.cat]} · ${esc(l.cond.replace('-', ' '))} · Seller ${esc(l.ownerName)}</small></div></div>
      <p class="mk-chip" style="margin:0 0 8px;display:inline-block">Reuse avoids about ${CO2[l.cat]} kg CO₂</p><ul class="tl">${hist}</ul>`;
    const image = $('#passBody .pimg');
    image.addEventListener('error', () => { image.src = CT.art(l.cat, 160); }, { once: true });
    $('#pass').showModal();
  }
  $('#printPass').onclick = () => print(); $('#closePass').onclick = () => $('#pass').close();

  /* ---------- report ---------- */
  let repId = null;
  $('#repForm').addEventListener('submit', e => {
    e.preventDefault(); const rs = CT.reports();
    if (!rs.some(r => r.listing === repId && r.reporter === me && r.status === 'open')) CT.saveReports([{ id: 'R' + Date.now().toString(36), listing: repId, reporter: me, reason: $('#repReason').value, at: Date.now(), status: 'open' }, ...rs]);
    $('#rep').close(); toast('Report sent. Our team will review it.');
  });
  $('#repCancel').onclick = () => $('#rep').close();

  $('#grid').addEventListener('click', e => {
    const b = e.target.closest('button[data-a]'); if (!b) return; const id = b.dataset.id, a = b.dataset.a, l = CT.listings().find(x => x.id === id); if (!l) return;
    if (a === 'pass') return passport(l);
    if (a === 'rep') { repId = id; return $('#rep').showModal(); }
    if (a === 'cart') {
      if (l.status !== 'live') return toast('This listing is no longer available.');
      if (cartIds().includes(id)) return toast('This unique device is already in your cart.');
      if (!CT.saveCart([...cartIds(), id])) return toast('Could not save the cart in this browser.');
      renderCart();
      toast('Added to cart.');
      return;
    }
    if (a === 'res') { if (!user) return needLogin(); if (l.owner === me) return toast('This is your own listing.'); if (l.status !== 'live') { toast('Someone already reserved this.'); return render(); } update(id, x => { x.status = 'reserved'; x.buyer = me; CT.ev(x, 'Reserved'); }); toast('Reserved. The seller can see your request.'); }
    if (a === 'cancel' || a === 'rel') { update(id, x => { x.status = 'live'; delete x.buyer; CT.ev(x, 'Reservation released'); }); toast('Released. The device is back on the marketplace.'); }
    if (a === 'sold') { update(id, x => { x.status = 'sold'; CT.ev(x, 'Sold'); }); toast('Marked as sold. ' + CO2[l.cat] + ' kg of CO₂ avoided.'); }
    if (a === 'del' && confirm('Delete this listing?')) CT.saveListings(CT.listings().filter(x => x.id !== id));
    render();
  });

  ['#q', '#cat', '#cond', '#max', '#sort'].forEach(s => $(s).addEventListener('input', render));
  $('#cats').addEventListener('click', e => {
    const button = e.target.closest('button[data-c]');
    if (!button) return;
    $$('#cats button').forEach(chip => chip.setAttribute('aria-pressed', chip === button));
    $('#cat').value = button.dataset.c;
    $('#cat').dispatchEvent(new Event('input', { bubbles: true }));
    $('#products').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  $$('.mk-tab').forEach(b => b.onclick = () => { tab = b.dataset.t; syncTabs(); render(); });
  addEventListener('storage', () => { render(); renderCart(); });
  paintGate(); render();
  const qp = new URLSearchParams(location.search);
  if (qp.get('sell') && user) {
    $('#fTitle').value = (qp.get('title') || '').slice(0, 60); if (['phone','laptop','tablet','tv','router','appliance'].includes(qp.get('cat'))) $('#fCat').value = qp.get('cat');
    $('#fPrice').value = qp.get('price') || ''; $('#sellBtn').click(); history.replaceState(null, '', location.pathname);
  } else if (qp.get('sell')) needLogin();
})();