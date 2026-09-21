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

  const CODE_RULES = {
    'Pass CAF Loisirs': {
      placeholder: '1234567-1234',
      message: 'Format obligatoire : 7 chiffres + 4 chiffres (ex. 1234567-1234).',
      inputMode: 'numeric',
      maxLength: 12,
      regex: /^\d{7}-\d{4}$/,
      pattern: '[0-9]{7}-[0-9]{4}',
      format(value) {
        const digits = String(value || '').replace(/\D/g, '').slice(0, 11);
        return digits.length > 7 ? digits.slice(0, 7) + '-' + digits.slice(7) : digits;
      }
    },
    'Pass’Sport': {
      placeholder: '12-ABCD-EFGH',
      message: 'Format obligatoire : 2 chiffres - 4 lettres - 4 lettres (ex. 12-ABCD-EFGH).',
      inputMode: 'text',
      maxLength: 12,
      regex: /^\d{2}-[A-Z]{4}-[A-Z]{4}$/,
      pattern: '[0-9]{2}-[A-Z]{4}-[A-Z]{4}',
      format(value) {
        const raw = String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        let cleaned = '';
        for (const char of raw) {
          const pos = cleaned.length;
          if (pos < 2 && /\d/.test(char)) cleaned += char;
          else if (pos >= 2 && pos < 10 && /[A-Z]/.test(char)) cleaned += char;
          if (cleaned.length >= 10) break;
        }
        const parts = [];
        if (cleaned.length) parts.push(cleaned.slice(0, 2));
        if (cleaned.length > 2) parts.push(cleaned.slice(2, 6));
        if (cleaned.length > 6) parts.push(cleaned.slice(6, 10));
        return parts.join('-');
      }
    }
  };

  function getCodeRule(dispositif) {
    const normalized = String(dispositif || '')
      .toLowerCase()
      .replace(/[’']/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (normalized === 'passsport') return CODE_RULES['Pass’Sport'];
    if (normalized === 'pass caf loisirs') return CODE_RULES['Pass CAF Loisirs'];
    return null;
  }

  function updateCodeField(dispositif, codeInput, hint) {
    const rule = getCodeRule(dispositif);
    codeInput.setCustomValidity('');

    if (!rule) {
      codeInput.placeholder = 'Saisir le code attribué';
      codeInput.inputMode = 'text';
      codeInput.maxLength = 80;
      codeInput.removeAttribute('pattern');
      codeInput.removeAttribute('title');
      if (hint) hint.textContent = 'Saisissez le code exactement comme il vous a été communiqué.';
      return;
    }

    codeInput.placeholder = rule.placeholder;
    codeInput.inputMode = rule.inputMode;
    codeInput.maxLength = rule.maxLength;
    codeInput.pattern = rule.pattern;
    codeInput.title = rule.message;
    codeInput.value = rule.format(codeInput.value);
    if (hint) hint.textContent = rule.message;

    if (codeInput.value && !rule.regex.test(codeInput.value)) {
      codeInput.setCustomValidity(rule.message);
    }
  }

  function validateCode(dispositif, codeInput, hint) {
    const rule = getCodeRule(dispositif);
    if (!rule) {
      codeInput.setCustomValidity('');
      return true;
    }

    codeInput.value = rule.format(codeInput.value);
    const valid = rule.regex.test(codeInput.value);
    codeInput.setCustomValidity(valid ? '' : rule.message);
    if (hint) hint.textContent = rule.message;
    return valid;
  }


  async function submitForm(form, status) {
    const button = form.querySelector('button[type="submit"]');
    const dispositifInput = form.elements.dispositif;
    const codeInput = form.elements.code;
    const hint = document.getElementById('aid-code-hint');

    if (!validateCode(dispositifInput.value, codeInput, hint)) {
      codeInput.reportValidity();
      status.textContent = 'Vérifiez le format du code indiqué.';
      status.className = 'aid-form-status is-error';
      return;
    }

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
      submittedAt: new Date().toISOString(),
      validationVersion: 2
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
      updateCodeField('', form.elements.code, document.getElementById('aid-code-hint'));
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

    const dispositifInput = form.elements.dispositif;
    const codeInput = form.elements.code;
    const hint = document.getElementById('aid-code-hint');

    updateCodeField(dispositifInput.value, codeInput, hint);

    dispositifInput.addEventListener('change', () => {
      codeInput.value = '';
      updateCodeField(dispositifInput.value, codeInput, hint);
    });

    codeInput.addEventListener('input', () => {
      const rule = getCodeRule(dispositifInput.value);
      if (rule) codeInput.value = rule.format(codeInput.value);
      validateCode(dispositifInput.value, codeInput, hint);
    });

    codeInput.addEventListener('blur', () => {
      validateCode(dispositifInput.value, codeInput, hint);
    });

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      submitForm(form, status);
    });
  });
})();