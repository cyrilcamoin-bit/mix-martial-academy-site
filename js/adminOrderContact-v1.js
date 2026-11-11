(function () {
  "use strict";

  var API_BASE = "https://mma-lerove-api.cyril-camoin.workers.dev";
  var input = document.getElementById("order-contact-id");
  var button = document.getElementById("order-contact-search");
  var status = document.getElementById("order-contact-status");
  var result = document.getElementById("order-contact-result");

  function token() {
    return sessionStorage.getItem("mma_cert_admin_token")
      || String(document.getElementById("admin-token")?.value || "").trim();
  }

  function esc(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function phoneHref(value) {
    return String(value || "").replace(/\D/g, "");
  }

  function setStatus(message, error) {
    if (!status) return;
    status.textContent = message || "";
    status.hidden = !message;
    status.classList.toggle("is-error", Boolean(error));
    status.classList.toggle("is-success", Boolean(message) && !error);
  }

  function row(label, value, href) {
    var content = value ? esc(value) : "—";
    if (href && value) {
      content = "<a href='" + esc(href) + "'>" + esc(value) + "</a>";
    }
    return "<div class='admin-order-contact-row'><span>" + esc(label) + "</span><strong>" + content + "</strong></div>";
  }

  function render(contact) {
    var payer = contact?.payer || {};
    var members = Array.isArray(contact?.members) ? contact.members : [];
    var address = [payer.address, [payer.postalCode, payer.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
    var membersHtml = members.length
      ? members.map(function (m) {
          return "<li>" + esc([m.firstName, m.lastName].filter(Boolean).join(" "))
            + (m.email ? " — " + esc(m.email) : "")
            + (m.phone ? " — " + esc(m.phone) : "")
            + "</li>";
        }).join("")
      : "<li>—</li>";

    result.innerHTML =
      "<div class='admin-order-contact-grid'>" +
        row("Commande", contact.orderId || "") +
        row("Payeur", [payer.firstName, payer.lastName].filter(Boolean).join(" ")) +
        row("E-mail", payer.email || "", payer.email ? "mailto:" + payer.email : "") +
        row("Téléphone", payer.phone || "", payer.phone ? "tel:" + phoneHref(payer.phone) : "") +
        row("Adresse", address) +
      "</div>" +
      "<div class='admin-order-contact-members'><span>Adhérent(s) lié(s)</span><ul>" + membersHtml + "</ul></div>";
    result.hidden = false;
  }

  async function search() {
    if (!input || !button || !result) return;
    var orderId = String(input.value || "").trim();
    if (!/^\d+$/.test(orderId)) {
      setStatus("Saisissez un numéro de commande HelloAsso valide.", true);
      return;
    }
    var adminToken = token();
    if (!adminToken) {
      setStatus("Déverrouillez d’abord l’administration.", true);
      return;
    }

    button.disabled = true;
    result.hidden = true;
    result.innerHTML = "";
    setStatus("Recherche de la commande HelloAsso…", false);

    try {
      var response = await fetch(API_BASE + "/admin/orders/contact?orderId=" + encodeURIComponent(orderId), {
        headers: { "Authorization": "Bearer " + adminToken },
        cache: "no-store"
      });
      var data = await response.json().catch(function () { return {}; });
      if (response.status === 401) throw new Error("unauthorized");
      if (response.status === 404) throw new Error("order_not_found");
      if (!response.ok || !data.ok) throw new Error(data.error || "load_failed");

      render(data.contact || {});
      setStatus("", false);
    } catch (error) {
      if (error.message === "unauthorized") {
        setStatus("Votre accès administrateur a expiré. Reconnectez-vous.", true);
      } else if (error.message === "order_not_found") {
        setStatus("Commande introuvable dans HelloAsso.", true);
      } else {
        setStatus("La recherche par commande n’est pas encore active sur le Worker Cloudflare.", true);
      }
    } finally {
      button.disabled = false;
    }
  }

  button?.addEventListener("click", search);
  input?.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
      event.preventDefault();
      search();
    }
  });
})();