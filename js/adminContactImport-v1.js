(function () {
  "use strict";

  var API_BASE = "https://mma-lerove-api.cyril-camoin.workers.dev";
  var PREFIX = "#contact-import=";
  var payload = null;
  var busy = false;
  var finished = false;
  var startedAt = Date.now();

  function decodeBase64Url(value) {
    var raw = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
    raw += "=".repeat((4 - raw.length % 4) % 4);
    var binary = atob(raw);
    var bytes = Uint8Array.from(binary, function (ch) { return ch.charCodeAt(0); });
    return new TextDecoder().decode(bytes);
  }

  function readPayload() {
    var hash = window.location.hash || "";
    if (!hash.startsWith(PREFIX)) return null;
    try {
      var data = JSON.parse(decodeBase64Url(hash.slice(PREFIX.length)));
      var email = String(data && data.email || "").trim().toLowerCase();
      var phone = String(data && data.phone || "").replace(/\D/g, "").slice(0, 10);
      if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) return null;
      if (!/^0\d{9}$/.test(phone)) return null;
      return { email: email, phone: phone };
    } catch (_) {
      return null;
    }
  }

  function adminToken() {
    return sessionStorage.getItem("mma_cert_admin_token")
      || String(document.getElementById("admin-token") && document.getElementById("admin-token").value || "").trim();
  }

  function showError(message) {
    var status = document.getElementById("admin-club-access-status");
    if (!status) return;
    status.textContent = message;
    status.classList.add("is-error");
    status.classList.remove("is-success");
  }

  async function saveContact() {
    if (!payload || busy || finished) return;
    if (!document.body.classList.contains("admin-club-unlocked")) return;
    var token = adminToken();
    if (!token) return;

    busy = true;
    try {
      var response = await fetch(API_BASE + "/admin/contact-overrides", {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + token,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload),
        cache: "no-store"
      });
      var data = await response.json().catch(function () { return {}; });
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "save_failed");
      }

      finished = true;
      history.replaceState(null, "", window.location.pathname + window.location.search + "#paiements");

      var paymentsTab = document.querySelector('.admin-club-tab[data-admin-view="paiements"]');
      if (paymentsTab && !paymentsTab.hidden) {
        paymentsTab.click();
        window.setTimeout(function () {
          document.getElementById("payments-refused-load")?.click();
        }, 500);
      }
    } catch (error) {
      if (error.message === "unauthorized") {
        showError("La session administrateur a expiré. Reconnecte-toi puis réessaie.");
      } else if (error.message === "invalid_contact") {
        showError("Le contact à enregistrer n’est pas valide.");
      } else if (error.message === "storage_not_configured") {
        showError("Le stockage privé des contacts n’est pas disponible.");
      } else {
        showError("La nouvelle fonction de contact privé n’est pas encore active sur Cloudflare.");
      }
    } finally {
      busy = false;
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    payload = readPayload();
    if (!payload) return;

    saveContact();
    var timer = window.setInterval(function () {
      if (finished || Date.now() - startedAt > 180000) {
        window.clearInterval(timer);
        return;
      }
      saveContact();
    }, 500);
  });
})();