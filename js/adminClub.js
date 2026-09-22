(() => {
  'use strict';

  const validViews = new Set(['dashboard', 'aides', 'certificats']);
  const views = {
    dashboard: document.getElementById('admin-club-dashboard'),
    aides: document.getElementById('admin-club-aides'),
    certificats: document.getElementById('admin-club-certificats')
  };

  const accessCard = document.getElementById('admin-club-access');
  const masterInput = document.getElementById('admin-club-code');
  const masterButton = document.getElementById('admin-club-unlock');
  const masterStatus = document.getElementById('admin-club-access-status');

  function normalizeView(value) {
    return validViews.has(value) ? value : 'dashboard';
  }

  function currentHashView() {
    return normalizeView((window.location.hash || '').replace(/^#/, ''));
  }

  function setView(nextView, updateHash = true) {
    const view = normalizeView(nextView);

    if (view !== 'dashboard' && !document.body.classList.contains('admin-club-unlocked')) {
      masterInput?.focus();
      return;
    }

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

  function setMasterStatus(message, error = false) {
    if (!masterStatus) return;
    masterStatus.textContent = message;
    masterStatus.classList.toggle('is-error', error);
    masterStatus.classList.toggle('is-success', !error && message !== 'Saisissez votre mot de passe administrateur.');
  }

  function protectedControlsEnabled(enabled) {
    document.querySelectorAll('[data-admin-protected]').forEach((element) => {
      element.disabled = !enabled;
    });
  }

  function waitForUnlockResult(timeoutMs = 12000) {
    return new Promise((resolve) => {
      const started = Date.now();
      const timer = window.setInterval(() => {
        const aidsMessage = document.getElementById('admin-message')?.textContent || '';
        const certificatesPanel = document.getElementById('certificates-admin-panel');
        const certificatesStatus = document.getElementById('certificates-admin-status')?.textContent || '';

        const aidsOk = /demande\(s\) chargée\(s\)\./i.test(aidsMessage);
        const aidsBad = /code personnel incorrect/i.test(aidsMessage);
        const certificatesOk = certificatesPanel && certificatesPanel.hidden === false;
        const certificatesBad = /code administrateur incorrect/i.test(certificatesStatus);

        if ((aidsOk || aidsBad) && (certificatesOk || certificatesBad)) {
          window.clearInterval(timer);
          resolve({ aidsOk, certificatesOk, aidsBad, certificatesBad });
          return;
        }

        if (Date.now() - started >= timeoutMs) {
          window.clearInterval(timer);
          resolve({ aidsOk, certificatesOk, aidsBad, certificatesBad, timeout: true });
        }
      }, 150);
    });
  }

  async function unlockAll() {
    const code = masterInput?.value.trim() || '';
    if (!code) {
      setMasterStatus('Saisissez votre mot de passe administrateur.', true);
      masterInput?.focus();
      return;
    }

    masterButton.disabled = true;
    setMasterStatus('Vérification en cours…');

    const aidsInput = document.getElementById('admin-code');
    const aidsButton = document.getElementById('unlock-admin');
    const certificatesInput = document.getElementById('admin-token');
    const certificatesButton = document.getElementById('admin-login-button');

    if (aidsInput) aidsInput.value = code;
    if (certificatesInput) certificatesInput.value = code;

    aidsButton?.click();
    certificatesButton?.click();

    const result = await waitForUnlockResult();

    if (result.aidsOk && result.certificatesOk) {
      document.body.classList.add('admin-club-unlocked');
      protectedControlsEnabled(true);
      if (masterInput) {
        masterInput.value = '';
        masterInput.disabled = true;
      }
      masterButton.hidden = true;
      accessCard?.classList.add('is-unlocked');
      setMasterStatus('Administration déverrouillée : aides et certificats sont accessibles.');
    } else if (result.aidsOk && !result.certificatesOk) {
      setMasterStatus('Le mot de passe ouvre les aides, mais pas encore les certificats. Le code Cloudflare ADMIN_API_TOKEN doit être identique au code des aides.', true);
    } else if (!result.aidsOk && result.certificatesOk) {
      setMasterStatus('Le mot de passe ouvre les certificats, mais pas les aides. Utilisez le code actuel des aides comme mot de passe principal.', true);
    } else {
      setMasterStatus('Mot de passe incorrect.', true);
    }

    masterButton.disabled = false;
  }

  document.addEventListener('DOMContentLoaded', () => {
    protectedControlsEnabled(false);

    document.querySelectorAll('[data-admin-view]').forEach((button) => {
      button.addEventListener('click', () => setView(button.dataset.adminView));
    });

    masterButton?.addEventListener('click', unlockAll);
    masterInput?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') unlockAll();
    });

    setView('dashboard', false);
    setTimeout(() => masterInput?.focus(), 50);
  });

  window.addEventListener('hashchange', () => setView(currentHashView(), false));
})();
