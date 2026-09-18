(() => {
  'use strict';

  const DB_BASE = 'https://mix-martial-academy-default-rtdb.europe-west1.firebasedatabase.app';
  const DB_PATH = 'aides_inscription_v1';
  let privateKey = null;
  let rows = [];

  const ADMIN_KEY_BLOB = {"v":1,"iterations":310000,"salt":"yxgWi6PNAd3FbWu02PEQxw==","iv":"y1R4VIwAvEGwD9dS","ciphertext":"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"};

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