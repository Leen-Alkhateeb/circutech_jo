(() => {
  'use strict';

  const KEY = 'circutech_cookie_preferences_v1';
  const banner = document.getElementById('cookieBanner');
  const dialog = document.getElementById('cookieDialog');
  if (!banner || !dialog) return;

  const analytics = document.getElementById('cookieAnalytics');
  const marketing = document.getElementById('cookieMarketing');
  const necessary = document.getElementById('cookieNecessary');
  const getSaved = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY));
      return saved && saved.version === 1 && saved.necessary === true && typeof saved.analytics === 'boolean' && typeof saved.marketing === 'boolean'
        ? saved : null;
    } catch {
      return null;
    }
  };

  function feedback(message) {
    const target = dialog.open ? document.getElementById('cookieDialogFeedback') : document.getElementById('cookieBannerFeedback');
    if (target) {
      target.textContent = message;
      target.hidden = !message;
    }
  }

  function save(preferences) {
    const record = { version: 1, necessary: true, analytics: !!preferences.analytics, marketing: !!preferences.marketing, updatedAt: new Date().toISOString() };
    try {
      localStorage.setItem(KEY, JSON.stringify(record));
      banner.hidden = true;
      feedback('');
      if (dialog.open) dialog.close();
      return true;
    } catch {
      feedback('Your choice could not be saved in this browser. Please allow browser storage and try again.');
      return false;
    }
  }

  function openSettings() {
    const saved = getSaved();
    necessary.checked = true;
    analytics.checked = !!(saved && saved.analytics);
    marketing.checked = !!(saved && saved.marketing);
    feedback('');
    if (!dialog.open) dialog.showModal();
  }

  document.addEventListener('click', event => {
    const settingsLink = event.target.closest('[data-cookie-settings]');
    if (settingsLink) {
      event.preventDefault();
      openSettings();
      return;
    }

    const action = event.target.closest('[data-cookie-action]');
    if (!action) return;
    if (action.dataset.cookieAction === 'settings') openSettings();
    if (action.dataset.cookieAction === 'accept') save({ analytics: true, marketing: true });
    if (action.dataset.cookieAction === 'reject') save({ analytics: false, marketing: false });
  });

  document.querySelector('[data-cookie-save]')?.addEventListener('click', () => {
    save({ analytics: analytics.checked, marketing: marketing.checked });
  });
  document.querySelector('[data-cookie-close]')?.addEventListener('click', () => dialog.close());

  banner.hidden = !!getSaved();
})();