(() => {
  'use strict';

  const validViews = new Set(['dashboard', 'aides', 'certificats']);
  const views = {
    dashboard: document.getElementById('admin-club-dashboard'),
    aides: document.getElementById('admin-club-aides'),
    certificats: document.getElementById('admin-club-certificats')
  };

  function normalizeView(value) {
    return validViews.has(value) ? value : 'dashboard';
  }

  function currentHashView() {
    return normalizeView((window.location.hash || '').replace(/^#/, ''));
  }

  function setView(nextView, updateHash = true) {
    const view = normalizeView(nextView);

    Object.entries(views).forEach(([name, element]) => {
      if (element) element.hidden = name !== view;
    });

    document.querySelectorAll('.admin-club-tab').forEach((button) => {
      const active = button.dataset.adminView === view;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-current', active ? 'page' : 'false');
    });

    if (updateHash) {
      const hash = view === 'dashboard' ? '' : '#' + view;
      history.replaceState(null, '', window.location.pathname + window.location.search + hash);
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-admin-view]').forEach((button) => {
      button.addEventListener('click', () => setView(button.dataset.adminView));
    });

    setView(currentHashView(), false);
  });

  window.addEventListener('hashchange', () => setView(currentHashView(), false));
})();
