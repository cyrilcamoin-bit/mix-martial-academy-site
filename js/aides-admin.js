(() => {
  'use strict';

  const DB_BASE = 'https://mix-martial-academy-default-rtdb.europe-west1.firebasedatabase.app';
  const DB_PATH = 'aides_inscription_v1';
  let privateKey = null;
  let rows = [];

  const ADMIN_KEY_BLOB = {"v":1,"iterations":310000,"salt":"Y7sDx6f+nkMOVmw/fMMeLg==","iv":"90AMJ//nkUnpuIxj","ciphertext":"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"};

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