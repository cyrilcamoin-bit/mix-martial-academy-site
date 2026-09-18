(() => {
  'use strict';

  const DB_BASE = 'https://mix-martial-academy-default-rtdb.europe-west1.firebasedatabase.app';
  const DB_PATH = 'aides_inscription_v1';
  let privateKey = null;
  let rows = [];

  const ADMIN_KEY_BLOB = {"v":1,"iterations":310000,"salt":"Dv2n6e2L9Kq714ffJZnGAg==","iv":"xKYSnBuCKL9XH5zp","ciphertext":"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"};

  async function unlockWithCode(code) {
    const salt = new Uint8Array(fromBase64(ADMIN_KEY_BLOB.salt));
    const iv = new Uint8Array(fromBase64(ADMIN_KEY_BLOB.iv));
    const material = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(code),
      'PBKDF2',
      false,
      ['deriveKey']
    );
    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        hash: 'SHA-256',
        salt,
        iterations: ADMIN_KEY_BLOB.iterations
      },
      material,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      fromBase64(ADMIN_KEY_BLOB.ciphertext)
    );
    return new TextDecoder().decode(plaintext);
  }

  const $ = (id) => document.getElementById(id);

  const fromBase64 = (value) => {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  };

  const pemToArrayBuffer = (pem) => {
    const b64 = pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, '');
    if (!b64) throw new Error('invalid_private_key');
    return fromBase64(b64);
  };

  async function importPrivateKey(pem) {
    return crypto.subtle.importKey(
      'pkcs8',
      pemToArrayBuffer(pem),
      { name: 'RSA-OAEP', hash: 'SHA-256' },
      false,
      ['decrypt']
    );
  }

  async function decryptEnvelope(entry) {
    const rawAesKey = await crypto.subtle.decrypt(
      { name: 'RSA-OAEP' },
      privateKey,
      fromBase64(entry.wrappedKey)
    );

    const aesKey = await crypto.subtle.importKey(
      'raw',
      rawAesKey,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );

    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(fromBase64(entry.iv)) },
      aesKey,
      fromBase64(entry.ciphertext)
    );

    return JSON.parse(new TextDecoder().decode(plaintext));
  }

  const euro = (value) => Number(value || 0).toLocaleString('fr-FR', {
    style: 'currency',
    currency: 'EUR'
  });

  const dateFr = (value) => {
    if (!value) return '—';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('fr-FR');
  };

  function setMessage(message, error = false) {
    const el = $('admin-message');
    el.textContent = message;
    el.style.color = error ? '#ff5a64' : '#aaa';
  }

  function renderMetrics() {
    const total = rows.reduce((sum, row) => sum + Number(row.data.montant || 0), 0);
    const refunded = rows.reduce((sum, row) => sum + (row.meta.refunded ? Number(row.data.montant || 0) : 0), 0);
    $('metric-count').textContent = String(rows.length);
    $('metric-total').textContent = euro(total);
    $('metric-refunded').textContent = euro(refunded);
    $('metric-remaining').textContent = euro(Math.max(0, total - refunded));
  }

  function checkboxCell(checked, label, onChange) {
    const td = document.createElement('td');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = Boolean(checked);
    input.setAttribute('aria-label', label);
    input.addEventListener('change', onChange);
    td.appendChild(input);
    return td;
  }

  async function patchMeta(id, patch) {
    const response = await fetch(`${DB_BASE}/${DB_PATH}/${encodeURIComponent(id)}.json`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch)
    });
    if (!response.ok) throw new Error('firebase_patch_failed');
  }

  function renderTable() {
    const body = $('admin-aids-body');
    body.textContent = '';

    if (!rows.length) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 10;
      td.className = 'admin-aids-empty';
      td.textContent = 'Aucune demande enregistrée.';
      tr.appendChild(td);
      body.appendChild(tr);
      renderMetrics();
      return;
    }

    rows
      .slice()
      .sort((a, b) => String(b.meta.createdAt || '').localeCompare(String(a.meta.createdAt || '')))
      .forEach((row) => {
        const tr = document.createElement('tr');
        const values = [
          dateFr(row.meta.createdAt),
          `${row.data.nom || ''} ${row.data.prenom || ''}`.trim(),
          row.data.categorie || '—',
          row.data.responsable || '—',
          row.data.dispositif || '—',
          row.data.code || '—',
          euro(row.data.montant)
        ];

        values.forEach((value) => {
          const td = document.createElement('td');
          td.textContent = value;
          tr.appendChild(td);
        });

        tr.appendChild(checkboxCell(row.meta.verified, 'Code vérifié', async (event) => {
          event.target.disabled = true;
          try {
            await patchMeta(row.id, { verified: event.target.checked });
            row.meta.verified = event.target.checked;
            setMessage('Statut de vérification mis à jour.');
          } catch (error) {
            event.target.checked = !event.target.checked;
            setMessage('Impossible de mettre à jour la vérification.', true);
          } finally {
            event.target.disabled = false;
          }
        }));

        tr.appendChild(checkboxCell(row.meta.refunded, 'Remboursé', async (event) => {
          event.target.disabled = true;
          const refunded = event.target.checked;
          try {
            await patchMeta(row.id, {
              refunded,
              refundedAt: refunded ? new Date().toISOString() : null
            });
            row.meta.refunded = refunded;
            row.meta.refundedAt = refunded ? new Date().toISOString() : null;
            renderMetrics();
            setMessage('Statut de remboursement mis à jour.');
          } catch (error) {
            event.target.checked = !event.target.checked;
            setMessage('Impossible de mettre à jour le remboursement.', true);
          } finally {
            event.target.disabled = false;
          }
        }));

        const dateTd = document.createElement('td');
        dateTd.textContent = dateFr(row.meta.refundedAt);
        tr.appendChild(dateTd);
        body.appendChild(tr);
      });

    renderMetrics();
  }

  async function loadRequests() {
    setMessage('Chargement des demandes…');
    const response = await fetch(`${DB_BASE}/${DB_PATH}.json`, { cache: 'no-store' });
    if (!response.ok) throw new Error('firebase_read_failed');
    const raw = await response.json();
    const entries = raw && typeof raw === 'object' ? Object.entries(raw) : [];

    const decoded = [];
    for (const [id, meta] of entries) {
      if (!meta || !meta.ciphertext || !meta.wrappedKey || !meta.iv) continue;
      try {
        const data = await decryptEnvelope(meta);
        decoded.push({
          id,
          data,
          meta: {
            createdAt: meta.createdAt || data.submittedAt || null,
            verified: Boolean(meta.verified),
            refunded: Boolean(meta.refunded),
            refundedAt: meta.refundedAt || null
          }
        });
      } catch (error) {
        console.error('Unable to decrypt aid request', id, error);
      }
    }

    rows = decoded;
    renderTable();
    $('export-csv').disabled = rows.length === 0;
    setMessage(`${rows.length} demande(s) chargée(s).`);
  }

  function csvValue(value) {
    const s = String(value ?? '').replace(/"/g, '""');
    return `"${s}"`;
  }

  function exportCsv() {
    const header = [
      'Date', 'Nom', 'Prénom', 'Catégorie', 'Responsable légal', 'Dispositif',
      'Code', 'Montant', 'Code vérifié', 'Remboursé', 'Date remboursement'
    ];
    const lines = [header.map(csvValue).join(';')];
    rows.forEach((row) => {
      lines.push([
        dateFr(row.meta.createdAt),
        row.data.nom,
        row.data.prenom,
        row.data.categorie,
        row.data.responsable,
        row.data.dispositif,
        row.data.code,
        Number(row.data.montant || 0).toFixed(2).replace('.', ','),
        row.meta.verified ? 'Oui' : 'Non',
        row.meta.refunded ? 'Oui' : 'Non',
        dateFr(row.meta.refundedAt)
      ].map(csvValue).join(';'));
    });

    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `aides-mix-martial-academy-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  document.addEventListener('DOMContentLoaded', () => {
    const codeInput = $('admin-code');
    const unlockButton = $('unlock-admin');

    const unlock = async () => {
      const code = codeInput.value.trim();
      if (!code) {
        setMessage('Saisissez votre code personnel.', true);
        return;
      }
      unlockButton.disabled = true;
      try {
        const pem = await unlockWithCode(code);
        privateKey = await importPrivateKey(pem);
        codeInput.value = '';
        setMessage('Accès autorisé. Chargement des demandes…');
        await loadRequests();
      } catch (error) {
        privateKey = null;
        setMessage('Code personnel incorrect.', true);
      } finally {
        unlockButton.disabled = false;
      }
    };

    unlockButton.addEventListener('click', unlock);
    codeInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') unlock();
    });
    $('export-csv').addEventListener('click', exportCsv);
    setTimeout(() => codeInput.focus(), 50);
  });
})();