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
  const faceLoginButton = document.getElementById('admin-faceid-login');
  const faceLogoutButton = document.getElementById('admin-faceid-logout');
  let faceIdEnabled = false;
  let faceIdBusy = false;

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


  // Protection double : le site n'affiche Face ID QUE si le Worker
  // déclare officiellement une version en production permettant toutes
  // les opérations Admin. Le Worker preview n'autorise aucune écriture.
  async function checkFaceIdAvailability() {
    try {
      const response = await fetch(API_BASE + '/passkey-preview/health', { cache: 'no-store' });
      const state = await response.json().catch(() => null);
      faceIdEnabled = Boolean(
        response.ok && state?.ok && state.adminWritable === true &&
        state.storage === true &&
        state.version === 'faceid-full-admin-20261009-v1'
      );
      if (faceLoginButton) faceLoginButton.hidden = !faceIdEnabled;
    } catch (_) {
      faceIdEnabled = false;
      if (faceLoginButton) faceLoginButton.hidden = true;
    }
  }

  function bytesFromBase64Url(value) {
    const raw = String(value).replace(/-/g, '+').replace(/_/g, '/');
    return Uint8Array.from(atob(raw + '='.repeat((4 - raw.length % 4) % 4)), ch => ch.charCodeAt(0));
  }

  function bytesToBase64Url(buffer) {
    const bytes = new Uint8Array(buffer);
    let raw = '';
    for (let i = 0; i < bytes.length; i += 8192) {
      raw += String.fromCharCode(...bytes.subarray(i, i + 8192));
    }
    return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  // Ne PAS utiliser credential.toJSON() : l'extension PRF peut y ajouter
  // la matière secrète destinée aux aides. Elle reste sur cet iPhone.
  function serializeFaceIdAssertion(credential) {
    return {
      id: credential.id,
      rawId: bytesToBase64Url(credential.rawId),
      type: credential.type,
      authenticatorAttachment: credential.authenticatorAttachment,
      clientExtensionResults: {},
      response: {
        authenticatorData: bytesToBase64Url(credential.response.authenticatorData),
        clientDataJSON: bytesToBase64Url(credential.response.clientDataJSON),
        signature: bytesToBase64Url(credential.response.signature),
        userHandle: credential.response.userHandle ? bytesToBase64Url(credential.response.userHandle) : null
      }
    };
  }

  async function faceIdJson(path, data, authToken = '') {
    const headers = { 'Content-Type': 'application/json' };
    if (authToken) headers.Authorization = 'Bearer ' + authToken;
    const response = await fetch(API_BASE + path, {
      method: 'POST', headers,
      body: JSON.stringify(data),
      cache: 'no-store'
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.ok !== true) {
      throw new Error(response.status === 401
        ? 'Face ID non reconnu. Essaie de nouveau ou utilise ton mot de passe.'
        : 'Connexion Face ID indisponible (' + response.status + ').');
    }
    return body;
  }

  async function unlockWithFaceId() {
    if (!faceIdEnabled || faceIdBusy ||
        document.body.classList.contains('admin-club-unlocked')) return;
    faceIdBusy = true;
    if (faceLoginButton) faceLoginButton.disabled = true;
    masterButton.disabled = true;
    setMasterStatus('Reconnaissance Face ID en cours…');

    try {
      if (!window.PublicKeyCredential || !navigator.credentials?.get) {
        throw new Error('Ton navigateur ne prend pas en charge les clés d’accès Face ID.');
      }

      const { options, requestId } = await faceIdJson('/passkey-preview/login/options', {});
      const prfSalt = new Uint8Array(await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode('MMA-Le-Rove|aides|FaceID|PRF|v1')
      ));
      const publicKey = {
        ...options,
        challenge: bytesFromBase64Url(options.challenge),
        allowCredentials: (options.allowCredentials || []).map(c => ({
          ...c, id: bytesFromBase64Url(c.id)
        })),
        extensions: {
          ...(options.extensions || {}),
          prf: { eval: { first: prfSalt } }
        }
      };

      const credential = await navigator.credentials.get({ publicKey });
      if (!credential) throw new Error('Authentification Face ID annulée.');

      const signed = await faceIdJson('/passkey-preview/login/verify', {
        requestId,
        credential: serializeFaceIdAssertion(credential)
      });
      if (!signed.verified || !/^mma-fid1\.[A-Za-z0-9_-]{43}$/.test(signed.token || '')) {
        throw new Error('La session Face ID n’a pas été validée.');
      }

      // Ne déverrouiller visuellement que si une vraie route admin répond.
      const probe = await fetch(API_BASE + '/admin/mail/status', {
        headers: { Authorization: 'Bearer ' + signed.token },
        cache: 'no-store'
      });
      if (!probe.ok) throw new Error('La session Face ID n’a pas accès aux outils administratifs.');

      const input = document.getElementById('admin-token');
      const certButton = document.getElementById('admin-login-button');
      if (input) input.value = signed.token;
      certButton?.click();

      document.body.classList.add('admin-club-unlocked');
      protectedControlsEnabled(true);
      if (masterInput) { masterInput.value = ''; masterInput.disabled = true; }
      masterButton.hidden = true;
      if (faceLoginButton) faceLoginButton.hidden = true;
      if (faceLogoutButton) faceLogoutButton.hidden = false;
      accessCard?.classList.add('is-unlocked');

      const prf = credential.getClientExtensionResults?.()?.prf?.results?.first || null;
      try {
        const state = await window.MMAAidesBridge?.onVerifiedPRF(prf);
        if (state?.ready) {
          setMasterStatus('Face ID connecté : les quatre modules sont accessibles.');
        } else if (state?.available) {
          setMasterStatus('Face ID connecté. Dans « Aides à l’inscription », active une seule fois la passerelle avec ton code habituel.');
        } else {
          setMasterStatus('Face ID connecté aux outils Cloudflare. Les aides peuvent encore nécessiter le code habituel.');
        }
      } catch (_) {
        setMasterStatus('Face ID connecté. Les aides peuvent encore nécessiter le code habituel.');
      }

      // Expirer aussi l'interface locale lorsque le jeton serveur expire.
      const expires = Date.parse(signed.expiresAt || '');
      if (Number.isFinite(expires)) {
        const remaining = Math.max(0, expires - Date.now());
        window.setTimeout(() => {
          if (document.body.classList.contains('admin-club-unlocked') &&
              document.getElementById('admin-token')?.value === signed.token) {
            sessionStorage.removeItem('mma_cert_admin_token');
            location.reload();
          }
        }, remaining);
      }
    } catch (error) {
      const reason = error?.name === 'NotAllowedError'
        ? 'Face ID annulé sur l’iPhone.'
        : (error?.message || 'Échec de la connexion Face ID.');
      setMasterStatus(reason, true);
    } finally {
      faceIdBusy = false;
      if (faceLoginButton) faceLoginButton.disabled = false;
      masterButton.disabled = false;
    }
  }

  async function logoutFaceId() {
    const token = sessionStorage.getItem('mma_cert_admin_token');
    if (token?.startsWith('mma-fid1.')) {
      try {
        await faceIdJson('/passkey-preview/logout', {}, token);
      } catch (_) { /* Reload always clears the browser token. */ }
    }
    sessionStorage.removeItem('mma_cert_admin_token');
    location.reload();
  }

  document.addEventListener('DOMContentLoaded', () => {
    protectedControlsEnabled(false);

    document.querySelectorAll('[data-admin-view]').forEach((button) => {
      button.addEventListener('click', () => setView(button.dataset.adminView));
    });

    masterButton?.addEventListener('click', unlockAll);
    faceLoginButton?.addEventListener('click', unlockWithFaceId);
    faceLogoutButton?.addEventListener('click', logoutFaceId);
    checkFaceIdAvailability();
    masterInput?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') unlockAll();
    });

    setView('dashboard', false);
    setTimeout(() => masterInput?.focus(), 50);
  });

  window.addEventListener('hashchange', () => setView(currentHashView(), false));
})();
