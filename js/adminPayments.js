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
  var selectAll = document.getElementById("payments-refused-select-all");
  var sendSelected = document.getElementById("payments-refused-send-selected");
  var testMailButton = document.getElementById("payments-mail-test");
  var mailState = document.getElementById("payments-mail-state");
  var loadedKey = "";
  var currentData = null;
  var mailConfigured = false;

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

  function setMailState(message, kind) {
    mailState.textContent = message || "";
    mailState.className = "payment-mail-state" + (kind ? " is-" + kind : "");
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

  function selectedPaymentIds() {
    return Array.from(tbody.querySelectorAll(".payment-row-check:checked")).map(function (checkbox) {
      return checkbox.value;
    });
  }

  function updateBulkButton() {
    if (!sendSelected) return;
    var count = selectedPaymentIds().length;
    sendSelected.disabled = !mailConfigured || count === 0;
    sendSelected.textContent = count > 0
      ? "Envoyer " + count + " relance" + (count > 1 ? "s" : "")
      : "Envoyer les relances sélectionnées";
  }

  function render(data) {
    currentData = data;
    var payments = Array.isArray(data.payments) ? data.payments : [];
    countBox.textContent = String(payments.length);
    totalBox.textContent = euro(data.totalAmount || 0);
    selectAll.checked = false;

    if (!payments.length) {
      tbody.innerHTML = "<tr><td colspan='9' class='admin-aids-empty'>Aucune échéance refusée pour cette date.</td></tr>";
      updateBulkButton();
      return;
    }

    tbody.innerHTML = payments.map(function (payment, index) {
      var payer = payment.payer || {};
      var email = String(payer.email || "").trim();
      var alreadySent = Boolean(payment.reminder && payment.reminder.sentAt);
      var selectable = Boolean(email) && !alreadySent;
      var reminderStatus = alreadySent
        ? "<span class='payment-sent-badge'>Envoyé le " + escapeHtml(dateTimeFr(payment.reminder.sentAt)) + "</span>"
        : "<span class='payment-refused-badge'>À relancer</span>";

      return "<tr>" +
        "<td><input class='payment-row-check' type='checkbox' value='" + escapeHtml(payment.paymentId) + "' " + (selectable ? "" : "disabled") + " aria-label='Sélectionner cette relance'></td>" +
        "<td>" + escapeHtml(dateTimeFr(payment.paymentDate)) + "</td>" +
        "<td><strong>" + escapeHtml(memberNames(payment)) + "</strong></td>" +
        "<td>" + escapeHtml(payerName(payment)) + "</td>" +
        "<td>" + (email ? "<a href='mailto:" + encodeURIComponent(email) + "'>" + escapeHtml(email) + "</a>" : "—") + "</td>" +
        "<td>" + escapeHtml(payment.installmentNumber == null ? "—" : String(payment.installmentNumber)) + "</td>" +
        "<td>" + escapeHtml(euro(payment.amount)) + "</td>" +
        "<td>" + reminderStatus + "</td>" +
        "<td><div class='certificate-row-actions'>" +
          "<button class='button button-small payment-send-mail' data-index='" + index + "' type='button' " + (selectable && mailConfigured ? "" : "disabled") + ">" + (alreadySent ? "Déjà envoyé" : "Envoyer") + "</button>" +
          "<button class='button button-small button-outline payment-copy-mail' data-index='" + index + "' type='button' " + (email ? "" : "disabled") + ">Copier</button>" +
          "<a class='button button-small button-outline payment-open-mail' data-index='" + index + "' href='#' " + (email ? "" : "aria-disabled='true'") + ">Préparer</a>" +
        "</div></td>" +
      "</tr>";
    }).join("");

    tbody.querySelectorAll(".payment-row-check").forEach(function (checkbox) {
      checkbox.addEventListener("change", updateBulkButton);
    });

    tbody.querySelectorAll(".payment-send-mail").forEach(function (button) {
      button.addEventListener("click", function () {
        var payment = payments[Number(button.getAttribute("data-index"))];
        sendPayments([String(payment.paymentId)]);
      });
    });

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

    updateBulkButton();
  }

  async function loadMailStatus() {
    var token = adminToken();
    if (!token) return;

    setMailState("Vérification de l’envoi iCloud…", "");
    try {
      var response = await fetch(API_BASE + "/admin/mail/status", {
        headers: { "Authorization": "Bearer " + token },
        cache: "no-store"
      });
      var data = await response.json().catch(function () { return {}; });
      if (!response.ok || !data.ok) throw new Error(data.error || "mail_status_failed");

      mailConfigured = Boolean(data.configured);
      testMailButton.disabled = !mailConfigured;
      if (mailConfigured) {
        setMailState("Envoi direct actif depuis " + (data.sender || "l’adresse iCloud du club") + ".", "success");
      } else {
        setMailState("Envoi direct iCloud à configurer : le mot de passe spécifique à l’app Apple manque dans Cloudflare.", "warning");
      }

      if (currentData) render(currentData);
    } catch (error) {
      mailConfigured = false;
      setMailState("Impossible de vérifier la configuration iCloud.", "error");
      updateBulkButton();
    }
  }

  async function sendTestMail() {
    var token = adminToken();
    if (!token || !mailConfigured) return;

    var confirmed = window.confirm(
      "Envoyer un e-mail de test à mixmartialacademy@icloud.com ?\n\n" +
      "Aucun adhérent ne sera contacté."
    );
    if (!confirmed) return;

    testMailButton.disabled = true;
    setStatus("Envoi du message de test iCloud…", "");

    try {
      var response = await fetch(API_BASE + "/admin/mail/test", {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + token,
          "Content-Type": "application/json"
        }
      });
      var data = await response.json().catch(function () { return {}; });

      if (response.status === 401) throw new Error("unauthorized");
      if (!response.ok || !data.ok) throw new Error(data.error || "test_failed");

      setStatus("E-mail de test envoyé à " + (data.recipient || "l’adresse iCloud du club") + ".", "success");
    } catch (error) {
      if (error.message === "mail_not_configured") {
        setStatus("Le mot de passe spécifique à l’app Apple n’est pas encore configuré dans Cloudflare.", "error");
      } else if (error.message === "unauthorized") {
        setStatus("Votre accès administrateur a expiré.", "error");
      } else {
        setStatus("Échec du test iCloud. Vérifiez le mot de passe spécifique à l’app Apple.", "error");
      }
    } finally {
      testMailButton.disabled = !mailConfigured;
    }
  }

  async function sendPayments(paymentIds) {
    var token = adminToken();
    var date = String(dateInput.value || "").trim();
    if (!token || !paymentIds.length) return;
    if (!mailConfigured) {
      setStatus("L’envoi direct iCloud n’est pas encore configuré.", "error");
      return;
    }

    var matching = (currentData && Array.isArray(currentData.payments) ? currentData.payments : []).filter(function (payment) {
      return paymentIds.includes(String(payment.paymentId));
    });
    var recipients = matching.map(function (payment) {
      return payerName(payment) + (memberNames(payment) !== "—" ? " — " + memberNames(payment) : "");
    });

    var confirmed = window.confirm(
      "Envoyer " + paymentIds.length + " relance" + (paymentIds.length > 1 ? "s" : "") +
      " depuis mixmartialacademy@icloud.com ?\n\n" +
      recipients.join("\n") +
      "\n\nChaque destinataire recevra un message individuel et personnalisé."
    );
    if (!confirmed) return;

    sendSelected.disabled = true;
    tbody.querySelectorAll(".payment-send-mail").forEach(function (button) { button.disabled = true; });
    setStatus("Envoi des relances depuis iCloud…", "");

    try {
      var response = await fetch(API_BASE + "/admin/payments/refused/send", {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + token,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          date: date,
          paymentIds: paymentIds
        })
      });
      var data = await response.json().catch(function () { return {}; });

      if (response.status === 401) throw new Error("unauthorized");
      if (!response.ok || !data.ok) throw new Error(data.error || "send_failed");

      var parts = [];
      if (data.sent) parts.push(data.sent + " envoyée(s)");
      if (data.alreadySent) parts.push(data.alreadySent + " déjà envoyée(s)");
      if (data.invalidEmail) parts.push(data.invalidEmail + " e-mail invalide");
      if (data.failed) parts.push(data.failed + " échec(s)");
      if (data.notFound) parts.push(data.notFound + " introuvable(s)");

      var summaryMessage = "Relances : " + (parts.length ? parts.join(" · ") : "aucun envoi");
      var summaryKind = data.failed || data.invalidEmail || data.notFound ? "error" : "success";

      loadedKey = "";
      await loadPayments(true);
      setStatus(summaryMessage, summaryKind);
    } catch (error) {
      if (error.message === "mail_not_configured") {
        setStatus("Le mot de passe spécifique à l’app Apple n’est pas encore configuré dans Cloudflare.", "error");
      } else if (error.message === "unauthorized") {
        setStatus("Votre accès administrateur a expiré.", "error");
      } else {
        setStatus("Impossible d’envoyer les relances pour le moment.", "error");
      }
    } finally {
      updateBulkButton();
    }
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

  dateInput.addEventListener("change", function () {
    loadedKey = "";
    currentData = null;
    selectAll.checked = false;
    updateBulkButton();
  });

  selectAll.addEventListener("change", function () {
    tbody.querySelectorAll(".payment-row-check:not(:disabled)").forEach(function (checkbox) {
      checkbox.checked = selectAll.checked;
    });
    updateBulkButton();
  });

  sendSelected.addEventListener("click", function () {
    sendPayments(selectedPaymentIds());
  });

  testMailButton.addEventListener("click", sendTestMail);

  document.querySelectorAll('[data-admin-view="paiements"]').forEach(function (button) {
    button.addEventListener("click", function () {
      window.setTimeout(function () {
        loadMailStatus();
        loadPayments(false);
      }, 250);
    });
  });
})();