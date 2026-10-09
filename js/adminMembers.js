(() => {
  "use strict";
  const API = "https://mma-lerove-api.cyril-camoin.workers.dev";
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
    status.textContent = text;
    status.classList.toggle("is-error", error);
    status.classList.toggle("is-success", !error);
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
      const response = await fetch(API + "/admin/members/summary", {
        headers: { Authorization: "Bearer " + password },
        cache: "no-store"
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) throw new Error(response.status === 401 ? "Accès administrateur expiré ou incorrect." : "Impossible de lire la campagne HelloAsso.");
      setCounts(result);
      message(result.total + " adhérents actualisés depuis HelloAsso."
        + (result.incomplete ? " Attention : " + result.incomplete + " fiche(s) sans adresse, téléphone ou code postal complet." : ""));
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
    message("Génération du fichier Excel à jour…");
    try {
      const response = await fetch(API + "/admin/members/export.xlsx", {
        headers: { Authorization: "Bearer " + password },
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