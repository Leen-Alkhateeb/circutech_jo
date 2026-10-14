(() => {
  'use strict';

  const LISTINGS_KEY = 'circutech_listings';
  const REPORTS_KEY = 'circutech_reports';
  const CART_KEY = 'circutech_cart';
  const read = (key, fallback) => {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value == null ? fallback : value;
    } catch {
      return fallback;
    }
  };
  const write = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  };
  const users = () => read('circutech_users', []);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character]));
  const NAMES = {
    phone: 'Phone', laptop: 'Laptop', tablet: 'Tablet', tv: 'TV',
    router: 'Router', appliance: 'Appliance'
  };
  const CO2 = { phone: 60, laptop: 300, tablet: 110, tv: 400, router: 25, appliance: 20 };
  const SOFT = { phone: 2000, laptop: 2000, tablet: 2000, tv: 2000, router: 2000, appliance: 2000 };

  function pattern(value) {
    let seed = Array.from(String(value)).reduce((total, character) => (total * 31 + character.charCodeAt(0)) >>> 0, 7);
    const cells = [];
    for (let y = 0; y < 21; y++) {
      for (let x = 0; x < 21; x++) {
        const finder = (left, top) => x >= left && x < left + 7 && y >= top && y < top + 7;
        if (finder(0, 0) || finder(14, 0) || finder(0, 14)) {
          const left = x >= 14 ? 14 : 0;
          const top = y >= 14 ? 14 : 0;
          const dx = x - left;
          const dy = y - top;
          if (dx === 0 || dx === 6 || dy === 0 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4)) {
            cells.push(`<rect x="${x + 2}" y="${y + 2}" width="1" height="1"/>`);
          }
          continue;
        }
        seed = (seed * 1664525 + 1013904223) >>> 0;
        if (seed & 1) cells.push(`<rect x="${x + 2}" y="${y + 2}" width="1" height="1"/>`);
      }
    }
    return `<svg viewBox="0 0 25 25" role="img" aria-label="Device passport code" xmlns="http://www.w3.org/2000/svg"><rect width="25" height="25" fill="white"/><g fill="#0d3b2e">${cells.join('')}</g></svg>`;
  }

  function art(category, size) {
    const label = esc(NAMES[category] || 'Device');
    const dimension = Math.max(120, Math.min(600, Number(size) || 240));
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${dimension}" height="${dimension}" viewBox="0 0 240 240"><rect width="240" height="240" fill="#eaf7f2"/><rect x="79" y="42" width="82" height="138" rx="13" fill="#0d3b2e"/><rect x="87" y="51" width="66" height="115" rx="5" fill="#ffffff"/><circle cx="120" cy="172" r="3" fill="#00a875"/><text x="120" y="211" text-anchor="middle" fill="#536961" font-family="sans-serif" font-size="14">${label}</text></svg>`;
    return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
  }

  window.CT = {
    CO2,
    FEE: 0.05,
    NAMES,
    SOFT,
    esc,
    art,
    uid: () => window.crypto && crypto.randomUUID ? crypto.randomUUID() : 'L' + Date.now().toString(36) + Math.random().toString(36).slice(2, 9),
    settings: () => ({ maxLive: 10, reviewFactor: 1, banned: [], ...read('circutech_market_settings', {}) }),
    isAdmin: email => users().some(user => user.email === email && user.role === 'admin'),
    suspended: () => users().filter(user => user.suspended).map(user => user.email),
    listings: () => {
      const listings = read(LISTINGS_KEY, []);
      return Array.isArray(listings) ? listings : [];
    },
    saveListings: listings => write(LISTINGS_KEY, listings),
    reports: () => {
      const reports = read(REPORTS_KEY, []);
      return Array.isArray(reports) ? reports : [];
    },
    saveReports: reports => write(REPORTS_KEY, reports),
    cart: () => {
      const cart = read(CART_KEY, []);
      return Array.isArray(cart) ? cart : [];
    },
    saveCart: cart => write(CART_KEY, cart),
    ev: (listing, event) => {
      listing.history = Array.isArray(listing.history) ? listing.history : [];
      listing.history.push({ ev: event, at: Date.now() });
    },
    pattern,
    passportId: id => 'CT-' + String(id).replace(/[^a-z0-9]/gi, '').slice(-10).toUpperCase()
  };
})();