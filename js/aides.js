(() => {
  'use strict';

  const DB_BASE = 'https://mix-martial-academy-default-rtdb.europe-west1.firebasedatabase.app';
  const DB_PATH = 'aides_inscription_v1';
  const PUBLIC_KEY_PEM = "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAomXTeh4qnnmdex4bs4+e\nYvakLAYeYZDuDUhZJNYp3L9lEhYIv1ysbWCiULjFqY6ZuKFxSWqc04VoyRFiMRGk\n66Ide/lFZ70VQYWeV16flw2viEujxfdZs0tGeXwa3HCOBD+4t2WWCUBi68kB8/UB\nQ/BWUaQ/kqL30muafqSygrLwRIkxEuQwIAAluRmA854rNkkPSRSQvCeQdzD+KQRz\nfP6UYb9rIhk3aopQPX5FXFdnmR5j0SRyYvCw97XFZ925p3X6QKlE+EiYQElRDOmA\nlYzmtCPZaDgnjgIgEBmonByTAR1SRZbo7/ldaKp0ygKefeEu0bfiZmnNQ6i9C5TV\n2QIDAQAB\n-----END PUBLIC KEY-----";

  const toBase64 = (buffer) => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  };

  const pemToArrayBuffer = (pem) => {
    const b64 = pem.replace(/-----BEGIN PUBLIC KEY-----|-----END PUBLIC KEY-----|\s/g, '');
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  };

  const importPublicKey = () => crypto.subtle.importKey(
    'spki',
    pemToArrayBuffer(PUBLIC_KEY_PEM),
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['encrypt']
  );

  async function encryptPayload(payload) {
    const publicKey = await importPublicKey();
    const aesKey = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const plaintext = new TextEncoder().encode(JSON.stringify(payload));
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, plaintext);
    const rawAesKey = await crypto.subtle.exportKey('raw', aesKey);
    const wrappedKey = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, publicKey, rawAesKey);

    return {
      v: 1,
      alg: 'RSA-OAEP+AES-256-GCM',
      iv: toBase64(iv),
      wrappedKey: toBase64(wrappedKey),
      ciphertext: toBase64(ciphertext)
    };
  }

  function clean(value) {
    return String(value || '').trim();
  }

  async function submitForm(form, status) {
    const button = form.querySelector('button[type="submit"]');
    const data = new FormData(form);

    if (clean(data.get('website'))) {
      form.reset();
      status.textContent = 'Votre demande a bien été envoyée.';
      status.className = 'aid-form-status is-success';
      return;
    }

    const payload = {
      nom: clean(data.get('nom')).toUpperCase(),
      prenom: clean(data.get('prenom')),
      categorie: clean(data.get('categorie')),
      responsable: clean(data.get('responsable')),
      dispositif: clean(data.get('dispositif')),
      code: clean(data.get('code')),
      montant: Number(String(data.get('montant')).replace(',', '.')),
      submittedAt: new Date().toISOString()
    };

    if (!payload.nom || !payload.prenom || !payload.categorie || !payload.responsable ||
        !payload.dispositif || !payload.code || !Number.isFinite(payload.montant) || payload.montant < 0) {
      status.textContent = 'Merci de compléter tous les champs.';
      status.className = 'aid-form-status is-error';
      return;
    }

    button.disabled = true;
    status.textContent = 'Envoi en cours…';
    status.className = 'aid-form-status';

    try {
      const encrypted = await encryptPayload(payload);
      const response = await fetch(`${DB_BASE}/${DB_PATH}.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...encrypted,
          createdAt: new Date().toISOString(),
          verified: false,
          refunded: false,
          refundedAt: null
        })
      });

      if (!response.ok) throw new Error('firebase_write_failed');

      form.reset();
      status.textContent = 'Demande envoyée. Le club pourra maintenant la vérifier.';
      status.className = 'aid-form-status is-success';
    } catch (error) {
      console.error('Aid form submission failed:', error);
      status.textContent = 'Impossible d’envoyer la demande pour le moment. Merci de réessayer un peu plus tard.';
      status.className = 'aid-form-status is-error';
    } finally {
      button.disabled = false;
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('aid-form');
    const status = document.getElementById('aid-form-status');
    if (!form || !status) return;

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      submitForm(form, status);
    });
  });
})();