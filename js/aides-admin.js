(() => {
  'use strict';

  const DB_BASE = 'https://mix-martial-academy-default-rtdb.europe-west1.firebasedatabase.app';
  const DB_PATH = 'aides_inscription_v1';
  let privateKey = null;
  let rows = [];

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
    const keyInput = $('private-key');
    keyInput.addEventListener('change', async () => {
      const file = keyInput.files && keyInput.files[0];
      if (!file) return;
      try {
        const pem = await file.text();
        privateKey = await importPrivateKey(pem);
        $('load-aids').disabled = false;
        setMessage('Clé privée chargée. Vous pouvez afficher les demandes.');
      } catch (error) {
        privateKey = null;
        $('load-aids').disabled = true;
        setMessage('Cette clé privée n’est pas valide.', true);
      }
    });

    $('load-aids').addEventListener('click', async () => {
      if (!privateKey) return;
      $('load-aids').disabled = true;
      try {
        await loadRequests();
      } catch (error) {
        console.error(error);
        setMessage('Impossible de lire les demandes. Vérifiez l’accès à la base.', true);
      } finally {
        $('load-aids').disabled = false;
      }
    });

    $('export-csv').addEventListener('click', exportCsv);
  });
})();