(() => {
  'use strict';

  const DB_BASE = 'https://mix-martial-academy-default-rtdb.europe-west1.firebasedatabase.app';
  const DB_PATH = 'aides_inscription_v1';
  let privateKey = null;
  let rows = [];

  const ADMIN_KEY_BLOB = {"v":1,"iterations":310000,"salt":"g9RLTDX5uUXb95MPMn7rGA==","iv":"2mwl089N1J5pYrx3","ciphertext":"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"};

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