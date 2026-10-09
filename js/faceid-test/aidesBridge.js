(() => {
  "use strict";
  // Pont chiffré local : seul un ciphertext AES-GCM reste dans IndexedDB.
  // Ni le code des aides, ni la clé privée RSA, ni le secret PRF ne sont
  // envoyés au Worker Cloudflare ou enregistrés en clair.
  const DB = "mma-aides-faceid-v1";
  const KEY = "private-key-wrap";
  const AAD = new TextEncoder().encode("mma-lerove.fr:aides:faceid-prf:v1");
  const panel = document.getElementById("aides-faceid-bridge");
  const codeInput = document.getElementById("aides-faceid-once-code");
  const button = document.getElementById("aides-faceid-activate");
  const status = document.getElementById("aides-faceid-bridge-status");
  let cryptoKey = null;
  let ready = false;
  let pending = false;

  const explain = (message, error = false) => {
    if (!status) return;
    status.textContent = message;
    status.style.color = error ? "#ffb3b3" : "#c7d0d4";
  };
  const openDatabase = () => new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore("keys");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || Error("indexeddb_unavailable"));
  });
  async function stored() {
    const db = await openDatabase();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction("keys", "readonly");
        const req = tx.objectStore("keys").get(KEY);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error || Error("storage_read_failed"));
      });
    } finally { db.close(); }
  }
  async function store(record) {
    const db = await openDatabase();
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction("keys", "readwrite");
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error || Error("storage_write_failed"));
        tx.onabort = () => reject(tx.error || Error("storage_write_aborted"));
        tx.objectStore("keys").put(record, KEY);
      });
    } finally { db.close(); }
  }
  async function openWithLocalKey() {
    const saved = await stored();
    if (!saved) return false;
    if (saved.version !== 1 || !Array.isArray(saved.iv) || !Array.isArray(saved.ciphertext)) {
      throw Error("invalid_vault");
    }
    const raw = await crypto.subtle.decrypt(
      {name:"AES-GCM", iv:new Uint8Array(saved.iv), additionalData:AAD, tagLength:128},
      cryptoKey, new Uint8Array(saved.ciphertext)
    );
    let pem = new TextDecoder().decode(raw);
    try {
      if (!window.MMAAidesPreview) throw Error("missing_aids_module");
      await window.MMAAidesPreview.unlockWithPem(pem);
      ready = true;
      explain("✅ Aides déchiffrées automatiquement avec Face ID sur cet iPhone.");
      panel?.classList.add("is-unlocked");
      if (codeInput) codeInput.value="";
    } finally { pem = ""; new Uint8Array(raw).fill(0); }
    return true;
  }

  // Doit être appelé uniquement après vérification cryptographique de
  // l'assertion par Cloudflare; le PRF n'est jamais inclus dans cette requête.
  async function onVerifiedPRF(resultBuffer) {
    if (panel) panel.hidden = false;
    if (!resultBuffer || !(resultBuffer instanceof ArrayBuffer) || resultBuffer.byteLength !== 32) {
      if (button) button.disabled=true;
      explain("La clé d'accès actuelle ne fournit pas encore la fonction de chiffrement Face ID (PRF). Les autres modules fonctionnent. Il faudra réactiver une clé d'accès compatible avant de déverrouiller les aides sans code.",true);
      return {available:false,ready:false};
    }
    const secret = new Uint8Array(resultBuffer).slice();
    try {
      cryptoKey = await crypto.subtle.importKey(
        "raw",secret,{name:"AES-GCM"},false,["encrypt","decrypt"]
      );
    } finally {
      secret.fill(0);
      new Uint8Array(resultBuffer).fill(0);
    }
    if (button)button.disabled=false;
    try {
      if (await openWithLocalKey()) return {available:true,ready:true};
      explain("Face ID peut protéger les aides. Saisis ton code habituel une dernière fois pour chiffrer la clé uniquement sur cet iPhone.");
      codeInput?.focus();
      return {available:true,ready:false};
    } catch {
      explain("La clé locale ne correspond plus à Face ID. Le code habituel reste disponible pour ouvrir les aides. Ne supprime pas l'ancienne clé avant de réactiver.",true);
      return {available:true,ready:false};
    }
  }
  async function activate() {
    if (pending || !cryptoKey || ready) return;
    if (!window.MMAAidesPreview) {
      explain("Le module des aides n'est pas chargé. Actualise la page.",true);return;
    }
    const code=(codeInput?.value||"").trim();
    if (!code) {explain("Entre ton code Admin une dernière fois.",true);return;}
    pending=true;
    button.disabled=true;
    explain("Vérification du code et chiffrement de la clé sur ton iPhone…");
    let pem="";
    try {
      // L'unique vérification du code est locale, via le conteneur RSA
      // déjà utilisé par le module des aides en production.
      pem=await window.MMAAidesPreview.decryptPemWithCode(code);
      if (!pem.startsWith("-----BEGIN PRIVATE KEY-----"))throw Error("invalid_pem");
      // Première ouverture vérifiée AVANT de sauver le coffre.
      await window.MMAAidesPreview.unlockWithPem(pem);
      const iv=crypto.getRandomValues(new Uint8Array(12));
      const plaintext=new TextEncoder().encode(pem);
      let ciphertext;
      try {
        ciphertext=await crypto.subtle.encrypt(
          {name:"AES-GCM",iv,additionalData:AAD,tagLength:128},
          cryptoKey,plaintext
        );
      } finally { plaintext.fill(0); }
      await store({
        version:1,
        iv:Array.from(iv),
        ciphertext:Array.from(new Uint8Array(ciphertext)),
        // Aucune clé publique/privée ni mot de passe ne sont enregistrés.
        createdAt:new Date().toISOString()
      });
      ready=true;
      codeInput.value="";
      panel?.classList.add("is-unlocked");
      explain("✅ Passerelle Face ID activée ! La prochaine ouverture déchiffrera automatiquement les aides, sans code.");
    } catch(e) {
      explain("Activation impossible : code incorrect, ou stockage privé indisponible. Aucune modification du coffre existant n'a été faite.",true);
    } finally {
      pem="";
      pending=false;
      button.disabled=ready;
    }
  }
  button?.addEventListener("click",activate);
  codeInput?.addEventListener("keydown", e=>{if(e.key==="Enter")activate();});
  window.MMAAidesBridge={
    onVerifiedPRF,
    // Exposer seulement l'état ; ne pas exposer cryptoKey/PEM.
    isReady:()=>ready
  };
})();
