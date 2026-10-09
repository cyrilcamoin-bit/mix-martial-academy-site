(() => {
  'use strict';

  const API_BASE = 'https://mma-lerove-api.cyril-camoin.workers.dev';
  const validViews = new Set(['dashboard', 'aides', 'certificats', 'paiements', 'adherents']);
  const views = {
    dashboard: document.getElementById('admin-club-dashboard'),
    aides: document.getElementById('admin-club-aides'),
    certificats: document.getElementById('admin-club-certificats'),
    paiements: document.getElementById('admin-club-paiements'),
    adherents: document.getElementById('admin-club-adherents')
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

  function waitForAidsUnlockResult(timeoutMs = 12000) {
    return new Promise((resolve) => {
      const started = Date.now();
      const timer = window.setInterval(() => {
        const aidsMessage = document.getElementById('admin-message')?.textContent || '';
        const aidsOk = /demande\(s\) chargée\(s\)\./i.test(aidsMessage);
        const aidsBad = /code personnel incorrect/i.test(aidsMessage);

        if (aidsOk || aidsBad) {
          window.clearInterval(timer);
          resolve({ aidsOk, aidsBad });
          return;
        }

        if (Date.now() - started >= timeoutMs) {
          window.clearInterval(timer);
          resolve({ aidsOk, aidsBad, timeout: true });
        }
      }, 150);
    });
  }

  async function verifyCertificateAccess(code) {
    try {
      const response = await fetch(API_BASE + '/admin/mail/status', {
        headers: { Authorization: 'Bearer ' + code },
        cache: 'no-store'
      });

      if (response.status === 401) return { ok: false, badCode: true };
      if (!response.ok) return { ok: false, unavailable: true };
      return { ok: true };
    } catch (error) {
      return { ok: false, unavailable: true };
    }
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

    const certificateCheckPromise = verifyCertificateAccess(code);

    aidsButton?.click();
    certificatesButton?.click();

    const [aidsResult, certificateResult] = await Promise.all([
      waitForAidsUnlockResult(),
      certificateCheckPromise
    ]);

    if (aidsResult.aidsOk && certificateResult.ok) {
      document.body.classList.add('admin-club-unlocked');
      protectedControlsEnabled(true);
      if (masterInput) {
        masterInput.value = '';
        masterInput.disabled = true;
      }
      masterButton.hidden = true;
      accessCard?.classList.add('is-unlocked');
      setMasterStatus('Administration déverrouillée : aides, certificats, échéances refusées et listing adhérents sont accessibles.');
    } else if (certificateResult.unavailable) {
      setMasterStatus('Impossible de vérifier l’accès Cloudflare pour le moment. Réessayez dans quelques secondes.', true);
    } else if (aidsResult.aidsOk && certificateResult.badCode) {
      setMasterStatus('Le mot de passe ouvre les aides, mais pas les certificats. Vérifiez le code administrateur Cloudflare.', true);
    } else if (aidsResult.aidsBad && certificateResult.ok) {
      setMasterStatus('Le mot de passe ouvre les certificats, mais pas les aides. Vérifiez le code des aides.', true);
    } else if (aidsResult.timeout) {
      setMasterStatus('La vérification des aides prend plus de temps que prévu. Réessayez dans quelques secondes.', true);
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
