(() => {
  'use strict';

  const $ = selector => document.querySelector(selector);
  const ids = [...new Set(CT.cart().map(item => typeof item === 'string' ? item : item.id).filter(Boolean))];
  const listings = CT.listings();
  const lines = ids.map(id => ({ id, listing: listings.find(item => item.id === id) }));
  const activeLines = lines.filter(line => line.listing && line.listing.status === 'live' && Number.isFinite(Number(line.listing.price)) && Number(line.listing.price) > 0);

  $('#checkoutEmpty').hidden = ids.length > 0;
  $('#checkoutSubmit').disabled = ids.length === 0;
  $('#checkoutItems').innerHTML = lines.map(({ id, listing }) => listing
    ? `<div class="checkout-item"><img src="${CT.esc(listing.img || CT.art(listing.cat, 120))}" data-category="${CT.esc(listing.cat)}" alt=""><div><b>${CT.esc(listing.title)}</b><small>${listing.status === 'live' ? 'Quantity 1 · unique listing' : 'Unavailable: ' + CT.esc(listing.status)}</small></div><span class="price">${listing.status === 'live' ? 'JOD ' + Number(listing.price).toFixed(2) : '—'}</span></div>`
    : `<div class="checkout-item"><div></div><div><b>Listing unavailable</b><small>Remove it from your cart on the marketplace.</small></div><span class="price">—</span></div>`
  ).join('');
  $('#checkoutSubtotal').textContent = 'JOD ' + activeLines.reduce((sum, line) => sum + Number(line.listing.price), 0).toFixed(2);
  $('#checkoutItems').querySelectorAll('img').forEach(image => image.addEventListener('error', () => {
    image.src = CT.art(image.dataset.category, 120);
  }, { once: true }));

  $('#checkoutForm').addEventListener('submit', event => {
    event.preventDefault();
    const message = $('#checkoutMessage');
    if (!ids.length) {
      message.textContent = 'Your cart is empty. Return to the marketplace to choose a listing.';
      return;
    }
    const current = CT.listings();
    const stillAvailable = ids.every(id => current.some(item => item.id === id && item.status === 'live'));
    if (!stillAvailable || activeLines.length !== ids.length) {
      message.textContent = 'A listing is no longer available. No order was placed; update your cart and try again.';
      return;
    }
    if (!$('#customerName').value.trim() || !$('#customerEmail').validity.valid) {
      message.textContent = 'Enter a valid name and email address.';
      return;
    }

    // Replace this guard with a server-created, provider-hosted checkout session before enabling real payments.
    message.textContent = 'Checkout is unavailable because no payment provider is configured. No order was placed and no payment was taken.';
  });
})();