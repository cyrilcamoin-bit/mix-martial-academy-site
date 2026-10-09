(() => {
  "use strict";
  const PRODUCTION_API = "https://mma-lerove-api.cyril-camoin.workers.dev";
  // Le listing passe par la version test tant que les routes n'ont pas
  // été activées sur le Worker de production. Aides, certificats et
  // échéances continuent à utiliser exclusivement PRODUCTION_API.
  const VERIFIED_LISTING_PREVIEW = "https://feature-admin-listing-adherents-mma-lerove-api.cyril-camoin.workers.dev";
  let listingApi = "";
  async function resolveListingApi(password) {
    if (listingApi) return listingApi;
    const response = await fetch(PRODUCTION_API + "/admin/members/summary", {
      headers: { Authorization: "Bearer " + password },
      cache: "no-store"
    });
    if (response.status === 404) return (listingApi = VERIFIED_LISTING_PREVIEW);
    return (listingApi = PRODUCTION_API);
  }
  const status = document.getElementById("members-status");
  const refresh = document.getElementById("members-refresh");
  const download = document.getElementById("members-download");
  let pending = false;

  function token() {
    if (!document.body.classList.contains("admin-club-unlocked")) return "";
    return document.getElementById("admin-token")?.value?.trim() || "";
  }

  function message(text, error = false) {
    if (!status) return;
    // Ne rien afficher sous les boutons pour les réussites ou le chargement.
    // Seules les erreurs doivent rester visibles et accessibles.
    status.textContent = error ? text : "";
    status.hidden = !error;
    status.classList.toggle("is-error", error);
    status.classList.remove("is-success");
  }

  function setCounts(counts) {
    const keys = ["enfants", "ados", "adultes", "total"];
    for (const key of keys) {
      const el = document.getElementById("members-count-" + key);
      if (el) el.textContent = String(counts[key] ?? "—");
    }
  }

  function busy(value) {
    pending = value;
    const allowed = Boolean(token());
    if (refresh) refresh.disabled = value || !allowed;
    if (download) download.disabled = value || !allowed;
  }

  async function loadSummary() {
    if (pending) return;
    const password = token();
    if (!password) {
      message("Déverrouillez d’abord l’administration.", true);
      return;
    }
    busy(true);
    message("Consultation des dernières inscriptions HelloAsso…");
    try {
      const api = await resolveListingApi(password);
      const response = await fetch(api + "/admin/members/summary", {
        headers: { Authorization: "Bearer " + password },
        cache: "no-store"
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) throw new Error(response.status === 401 ? "Accès administrateur expiré ou incorrect." : "Impossible de lire la campagne HelloAsso.");
      setCounts(result);
      message(result.total + " adhérents actualisés. Les coordonnées complètes seront vérifiées lors du téléchargement.");
    } catch (error) {
      message(error.message || "Erreur de connexion à HelloAsso.", true);
    } finally {
      busy(false);
    }
  }

  async function downloadExcel() {
    if (pending) return;
    const password = token();
    if (!password) {
      message("Déverrouillez d’abord l’administration.", true);
      return;
    }
    busy(true);
    message("Récupération des coordonnées complètes depuis HelloAsso…");
    try {
      const api = await resolveListingApi(password);
      const expectedResponse = await fetch(api + "/admin/members/summary", {
        headers: { Authorization: "Bearer " + password }, cache: "no-store"
      });
      const expected = await expectedResponse.json().catch(() => ({}));
      if (!expectedResponse.ok || !expected.ok) throw new Error("Impossible de vérifier l'effectif total HelloAsso.");
      const members = [];
      const fingerprints = new Set();
      let finished = false;
      for (let page = 1; page <= 100 && !finished; page++) {
        message("Lecture des commandes HelloAsso — lot " + page + "…");
        const part = await fetch(api + "/admin/members/page?page=" + page, {
          headers: { Authorization: "Bearer " + password },
          cache: "no-store"
        });
        const data = await part.json().catch(() => ({}));
        if (!part.ok || !data.ok || !Array.isArray(data.members)) {
          throw new Error("Impossible de charger toutes les commandes (lot " + page + ").");
        }
        const fingerprint = data.members.map(m => m.memberId || [m.lastName,m.firstName,m.birthDate].join("|")).join(",");
        if (data.members.length && fingerprints.has(fingerprint)) {
          throw new Error("Pagination HelloAsso répétée : téléchargement annulé.");
        }
        fingerprints.add(fingerprint);
        members.push(...data.members);
        finished = !data.hasMore;
      }
      if (!finished || !members.length) throw new Error("Export incomplet : impossible de récupérer tous les adhérents.");
      const unique = new Set(members.map(m => m.memberId || [m.lastName,m.firstName,m.birthDate].join("|")));
      if (unique.size !== expected.total) {
        throw new Error("Export interrompu : " + unique.size + " adhérents récupérés sur " + expected.total + ". Aucun fichier incomplet ne sera téléchargé.");
      }
      const groupCount = {
        Enfant: members.filter(m => m.category === "Enfant").length,
        Ado: members.filter(m => m.category === "Ado").length,
        Adulte: members.filter(m => m.category === "Adulte").length
      };
      if (groupCount.Enfant !== expected.enfants || groupCount.Ado !== expected.ados || groupCount.Adulte !== expected.adultes) {
        throw new Error("Les catégories HelloAsso ne correspondent pas : téléchargement annulé.");
      }
      message("Mise en forme du fichier Excel pour " + members.length + " adhérents…");
      const response = await fetch(api + "/admin/members/export.xlsx", {
        method: "POST",
        headers: { Authorization: "Bearer " + password, "Content-Type": "application/json" },
        body: JSON.stringify({ members }),
        cache: "no-store"
      });
      if (!response.ok) throw new Error(response.status === 401
        ? "Accès administrateur incorrect."
        : "Impossible de générer le listing. Vérifiez la disponibilité de HelloAsso.");
      const blob = await response.blob();
      if (!blob.size) throw new Error("Le fichier Excel généré est vide.");
      const matches = /filename="?([^";]+)"?/i.exec(response.headers.get("Content-Disposition") || "");
      const filename = (matches ? matches[1] : "listing_adherents_Mix_Martial_Academy_2026-2027.xlsx")
        .replace(/[^a-zA-Z0-9_.-]/g, "_");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      const total = response.headers.get("X-Members-Total");
      const enfants = response.headers.get("X-Members-Enfants");
      const ados = response.headers.get("X-Members-Ados");
      const adultes = response.headers.get("X-Members-Adultes");
      const incomplete = Number(response.headers.get("X-Members-Incomplete") || 0);
      setCounts({ total, enfants, ados, adultes });
      message("Téléchargement lancé : " + total + " adhérents."
        + (incomplete ? " " + incomplete + " fiche(s) contiennent des coordonnées incomplètes." : ""));
    } catch (error) {
      message(error.message || "Erreur lors du téléchargement.", true);
    } finally {
      busy(false);
    }
  }

  refresh?.addEventListener("click", loadSummary);
  download?.addEventListener("click", downloadExcel);
  document.querySelectorAll('[data-admin-view="adherents"]').forEach((button) => {
    button.addEventListener("click", () => {
      if (token()) loadSummary();
    });
  });
})();