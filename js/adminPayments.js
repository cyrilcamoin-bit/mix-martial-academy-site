(function () {
  "use strict";

  var API_BASE = "https://mma-lerove-api.cyril-camoin.workers.dev";
  var section = document.getElementById("admin-club-paiements");
  if (!section) return;

  var dateInput = document.getElementById("payments-refused-date");
  var loadButton = document.getElementById("payments-refused-load");
  var statusBox = document.getElementById("payments-refused-status");
  var countBox = document.getElementById("payments-refused-count");
  var totalBox = document.getElementById("payments-refused-total");
  var tbody = document.getElementById("payments-refused-body");
  var loadedKey = "";

  function adminToken() {
    return sessionStorage.getItem("mma_cert_admin_token") || "";
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function euro(cents) {
    return (Number(cents || 0) / 100).toLocaleString("fr-FR", {
      style: "currency",
      currency: "EUR"
    });
  }

  function dateTimeFr(value) {
    if (!value) return "—";
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleString("fr-FR", {
      timeZone: "Europe/Paris",
      dateStyle: "short",
      timeStyle: "short"
    });
  }

  function dateFr(value) {
    var parts = String(value || "").split("-");
    if (parts.length !== 3) return value || "—";
    return parts[2] + "/" + parts[1] + "/" + parts[0];
  }

  function payerName(payment) {
    var payer = payment.payer || {};
    return [payer.firstName, payer.lastName].filter(Boolean).join(" ").trim() || "—";
  }

  function memberNames(payment) {
    var members = Array.isArray(payment.members) ? payment.members : [];
    var names = members.map(function (member) {
      return [member.firstName, member.lastName].filter(Boolean).join(" ").trim();
    }).filter(Boolean);
    return names.length ? names.join(", ") : "—";
  }

  function setStatus(message, kind) {
    statusBox.hidden = !message;
    statusBox.textContent = message || "";
    statusBox.className = "admin-status" + (kind ? " is-" + kind : "");
  }

  function emailTemplate(payment, selectedDate) {
    var payer = payment.payer || {};
    var firstName = String(payer.firstName || "").trim();
    var adherents = memberNames(payment);
    var intro = firstName ? "Bonjour " + firstName + "," : "Bonjour,";
    var subject = "Échéance HelloAsso refusée — régularisation";
    var body = [
      intro,
      "",
      "Nous vous informons que l’échéance HelloAsso du " + dateFr(selectedDate) +
        (adherents !== "—" ? " concernant l’adhésion de " + adherents : "") + " a été refusée.",
      "",
      "HelloAsso a normalement dû vous envoyer un e-mail contenant le lien permettant de régulariser la situation. Merci de vérifier votre boîte de réception principale ainsi que vos messages indésirables / spams, puis d’effectuer la régularisation dès que possible.",
      "",
      "Si la régularisation a déjà été effectuée entre-temps, vous pouvez ne pas tenir compte de ce message.",
      "",
      "Cordialement,",
      "Mix Martial Academy — Le Rove"
    ].join("\n");

    return {
      email: String(payer.email || "").trim(),
      subject: subject,
      body: body
    };
  }

  function render(data) {
    var payments = Array.isArray(data.payments) ? data.payments : [];
    countBox.textContent = String(payments.length);
    totalBox.textContent = euro(data.totalAmount || 0);

    if (!payments.length) {
      tbody.innerHTML = "<tr><td colspan='8' class='admin-aids-empty'>Aucune échéance refusée pour cette date.</td></tr>";
      return;
    }

    tbody.innerHTML = payments.map(function (payment, index) {
      var payer = payment.payer || {};
      var email = String(payer.email || "").trim();
      return "<tr>" +
        "<td>" + escapeHtml(dateTimeFr(payment.paymentDate)) + "</td>" +
        "<td><strong>" + escapeHtml(memberNames(payment)) + "</strong></td>" +
        "<td>" + escapeHtml(payerName(payment)) + "</td>" +
        "<td>" + (email ? "<a href='mailto:" + encodeURIComponent(email) + "'>" + escapeHtml(email) + "</a>" : "—") + "</td>" +
        "<td>" + escapeHtml(payment.installmentNumber == null ? "—" : String(payment.installmentNumber)) + "</td>" +
        "<td>" + escapeHtml(euro(payment.amount)) + "</td>" +
        "<td><span class='payment-refused-badge'>Refusé</span></td>" +
        "<td><div class='certificate-row-actions'>" +
          "<button class='button button-small button-outline payment-copy-mail' data-index='" + index + "' type='button' " + (email ? "" : "disabled") + ">Copier la relance</button>" +
          "<a class='button button-small payment-open-mail' data-index='" + index + "' href='#' " + (email ? "" : "aria-disabled='true'") + ">Préparer l’e-mail</a>" +
        "</div></td>" +
      "</tr>";
    }).join("");

    tbody.querySelectorAll(".payment-copy-mail").forEach(function (button) {
      button.addEventListener("click", async function () {
        var payment = payments[Number(button.getAttribute("data-index"))];
        var template = emailTemplate(payment, data.date);
        var text = "À : " + template.email + "\nObjet : " + template.subject + "\n\n" + template.body;
        try {
          await navigator.clipboard.writeText(text);
          setStatus("Relance copiée dans le presse-papiers.", "success");
        } catch (error) {
          setStatus("Impossible de copier automatiquement la relance.", "error");
        }
      });
    });

    tbody.querySelectorAll(".payment-open-mail").forEach(function (link) {
      var payment = payments[Number(link.getAttribute("data-index"))];
      var template = emailTemplate(payment, data.date);
      if (!template.email) {
        link.addEventListener("click", function (event) { event.preventDefault(); });
        return;
      }
      link.href = "mailto:" + encodeURIComponent(template.email) +
        "?subject=" + encodeURIComponent(template.subject) +
        "&body=" + encodeURIComponent(template.body);
    });
  }

  async function loadPayments(force) {
    var token = adminToken();
    var date = String(dateInput.value || "").trim();
    if (!token) {
      setStatus("Déverrouillez d’abord l’administration avec votre mot de passe.", "error");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setStatus("Choisissez une date valide.", "error");
      return;
    }

    var key = token + "|" + date;
    if (!force && loadedKey === key) return;

    loadButton.disabled = true;
    setStatus("Recherche des échéances refusées dans HelloAsso…", "");

    try {
      var response = await fetch(API_BASE + "/admin/payments/refused?date=" + encodeURIComponent(date), {
        headers: { "Authorization": "Bearer " + token },
        cache: "no-store"
      });
      var data = await response.json().catch(function () { return {}; });

      if (response.status === 401) throw new Error("unauthorized");
      if (!response.ok || !data.ok) throw new Error(data.error || "load_failed");

      loadedKey = key;
      render(data);
      setStatus(
        data.total
          ? data.total + " échéance(s) refusée(s) trouvée(s) pour le " + dateFr(date) + "."
          : "Aucune échéance refusée trouvée pour le " + dateFr(date) + ".",
        data.total ? "error" : "success"
      );
    } catch (error) {
      if (error.message === "unauthorized") {
        setStatus("Votre accès administrateur a expiré. Déverrouillez de nouveau la page.", "error");
      } else {
        setStatus("Impossible de charger les paiements refusés pour le moment.", "error");
      }
    } finally {
      loadButton.disabled = false;
    }
  }

  loadButton.addEventListener("click", function () { loadPayments(true); });
  dateInput.addEventListener("change", function () { loadedKey = ""; });

  document.querySelectorAll('[data-admin-view="paiements"]').forEach(function (button) {
    button.addEventListener("click", function () {
      window.setTimeout(function () { loadPayments(false); }, 250);
    });
  });
})();