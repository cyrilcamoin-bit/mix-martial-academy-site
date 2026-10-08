(function () {
  "use strict";

  var API_BASE = "https://mma-lerove-api.cyril-camoin.workers.dev";
  var section = document.getElementById("admin-club-paiements");
  if (!section) return;

  var loadButton = document.getElementById("payments-refused-load");
  var statusBox = document.getElementById("payments-refused-status");
  var countBox = document.getElementById("payments-refused-count");
  var totalBox = document.getElementById("payments-refused-total");
  var tbody = document.getElementById("payments-refused-body");
  var selectAll = document.getElementById("payments-refused-select-all");
  var sendSelected = document.getElementById("payments-refused-send-selected");
  var testMailButton = document.getElementById("payments-mail-test");
  var mailState = document.getElementById("payments-mail-state");
  var historyRefresh = document.getElementById("payments-history-refresh");
  var historyBody = document.getElementById("payments-history-body");
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

  function smsTemplate(payment) {
    var payer = payment.payer || {};
    var firstName = String(payer.firstName || "").trim();
    var adherents = memberNames(payment);
    var intro = firstName ? "Bonjour " + firstName + ", " : "Bonjour, ";
    return intro +
      "l’échéance HelloAsso du " + dateFr(payment.dateKey) +
      (adherents !== "—" ? " concernant l’adhésion de " + adherents : "") +
      " est actuellement refusée. Pour régulariser, rendez-vous sur https://auth.helloasso.com/connexion " +
      "puis : 1) cliquez sur « Mot de passe oublié » ; 2) saisissez l’adresse e-mail utilisée lors du paiement ; " +
      "3) ouvrez le lien reçu par e-mail et créez/réinitialisez votre mot de passe ; 4) connectez-vous à votre espace HelloAsso ; " +
      "5) retrouvez le paiement au statut « Refusé » et régularisez-le. Une fois régularisé, son statut passera à « Payé ». " +
      "Mix Martial Academy — Le Rove";
  }

  function openSms(payment) {
    var phone = String(payment.smsPhone || "").trim();
    if (!phone) {
      setStatus("Aucun numéro de téléphone exploitable n’a été trouvé dans HelloAsso.", "error");
      return;
    }

    var message = smsTemplate(payment);
    var isAppleMobile = /iPhone|iPad|iPod/i.test(navigator.userAgent || "");
    var separator = isAppleMobile ? "&" : "?";
    var smsUrl = "sms:" + phone + separator + "body=" + encodeURIComponent(message);
    var launchSms = function () {
      window.location.href = smsUrl;
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(message).then(launchSms, launchSms);
    } else {
      launchSms();
    }
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

  function emailTemplate(payment) {
    var payer = payment.payer || {};
    var firstName = String(payer.firstName || "").trim();
    var adherents = memberNames(payment);
    var intro = firstName ? "Bonjour " + firstName + "," : "Bonjour,";
    var subject = "Échéance HelloAsso refusée — régularisation";
    var body = [
      intro,
      "",
      "Nous vous informons que l’échéance HelloAsso du " + dateFr(payment.dateKey) +
        (adherents !== "—" ? " concernant l’adhésion de " + adherents : "") + " a été refusée.",
      "",
      "HelloAsso vous a envoyé un e-mail contenant le lien permettant de régulariser la situation. Merci de vérifier votre boîte de réception principale ainsi que vos messages indésirables / spams, puis d’effectuer la régularisation dès que possible.",
      "",
      "Vous ne retrouvez pas l’e-mail HelloAsso ? Aucun problème.",
      "",
      "Vous pouvez accéder directement à votre espace HelloAsso et retrouver votre paiement :",
      "1. Rendez-vous sur la page de connexion HelloAsso : https://auth.helloasso.com/connexion",
      "2. Cliquez sur « Mot de passe oublié »",
      "3. Saisissez l’adresse e-mail utilisée lors du paiement",
      "4. Utilisez le lien reçu par e-mail pour créer ou réinitialiser votre mot de passe",
      "5. Connectez-vous à votre espace HelloAsso",
      "6. Retrouvez votre paiement au statut « Refusé » et procédez à sa régularisation",
      "",
      "Une fois la régularisation effectuée, le statut du paiement passera à « Payé ».",
      "",
      "Cette procédure vous permet donc de régulariser votre échéance même si vous ne retrouvez plus l’e-mail initial envoyé par HelloAsso.",
      "",
      "Si la régularisation a déjà été effectuée entre-temps, vous pouvez ne pas tenir compte de ce message.",
      "",
      "Cordialement,",
      "Mix Martial Academy — Le Rove",
      "www.mma-lerove.fr"
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
      tbody.innerHTML = "<tr><td colspan='9' class='admin-aids-empty'>Aucune échéance refusée actuellement sur cette campagne.</td></tr>";
      updateBulkButton();
      return;
    }

    tbody.innerHTML = payments.map(function (payment, index) {
      var payer = payment.payer || {};
      var email = String(payer.email || "").trim();
      var alreadySent = Boolean(payment.reminder && payment.reminder.sentAt);
      var selectable = Boolean(email);
      var reminderStatus = alreadySent
        ? "<span class='payment-sent-badge'>Envoyé le " + escapeHtml(dateTimeFr(payment.reminder.sentAt)) + "</span>"
        : "<span class='payment-refused-badge'>À relancer</span>";

      var hasPhone = Boolean(String(payment.smsPhone || "").trim());
      return "<tr>" +
        "<td data-label='Sélection'><input class='payment-row-check' type='checkbox' value='" + escapeHtml(payment.paymentId) + "' " + (selectable ? "" : "disabled") + " aria-label='Sélectionner cette relance'></td>" +
        "<td data-label='Date'>" + escapeHtml(dateTimeFr(payment.paymentDate)) + "</td>" +
        "<td data-label='Adhérent'><strong>" + escapeHtml(memberNames(payment)) + "</strong></td>" +
        "<td data-label='Payeur'>" + escapeHtml(payerName(payment)) + "</td>" +
        "<td data-label='E-mail'>" + (email ? "<a href='mailto:" + encodeURIComponent(email) + "'>" + escapeHtml(email) + "</a>" : "—") + "</td>" +
        "<td data-label='Échéance'>" + escapeHtml(payment.installmentNumber == null ? "—" : String(payment.installmentNumber)) + "</td>" +
        "<td data-label='Montant'>" + escapeHtml(euro(payment.amount)) + "</td>" +
        "<td data-label='Statut'>" + reminderStatus + "</td>" +
        "<td data-label='Actions'><div class='certificate-row-actions'>" +
          "<button class='button button-small payment-send-mail' data-index='" + index + "' type='button' " + (selectable && mailConfigured ? "" : "disabled") + ">" + (alreadySent ? "Relancer" : "Envoyer") + "</button>" +
          "<button class='button button-small button-outline payment-sms' data-index='" + index + "' type='button' " + (hasPhone ? "" : "disabled") + ">SMS</button>" +
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

    tbody.querySelectorAll(".payment-sms").forEach(function (button) {
      button.addEventListener("click", function () {
        var payment = payments[Number(button.getAttribute("data-index"))];
        openSms(payment);
      });
    });

    tbody.querySelectorAll(".payment-copy-mail").forEach(function (button) {
      button.addEventListener("click", async function () {
        var payment = payments[Number(button.getAttribute("data-index"))];
        var template = emailTemplate(payment);
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
      var template = emailTemplate(payment);
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

  function mailErrorMessage(code) {
    var messages = {
      "mail_not_configured": "Le mot de passe spécifique à l’app Apple n’est pas configuré.",
      "invalid_recipient": "L’adresse e-mail du club est invalide.",
      "smtp_connection_failed": "Cloudflare n’arrive pas à ouvrir la connexion SMTP vers Apple.",
      "smtp_tls_failed": "La négociation TLS avec Apple a échoué.",
      "smtp_greeting_220": "Réponse inattendue du serveur iCloud à la connexion.",
      "smtp_ehlo_250": "Le serveur iCloud a refusé l’identification SMTP.",
      "smtp_starttls_220": "Apple a refusé le passage en connexion chiffrée STARTTLS.",
      "smtp_secure_ehlo_250": "La session sécurisée iCloud n’a pas accepté l’identification SMTP.",
      "smtp_auth_535": "Apple refuse l’authentification : vérifiez l’adresse iCloud et le mot de passe spécifique à l’app.",
      "smtp_auth_password_535": "Apple refuse le mot de passe spécifique à l’app.",
      "smtp_auth_user_334": "Apple n’a pas accepté l’identifiant iCloud.",
      "smtp_mail_from_250": "Apple refuse l’adresse d’expéditeur.",
      "smtp_rcpt_to_250": "Apple refuse l’adresse destinataire du test.",
      "smtp_data_354": "Apple refuse de recevoir le contenu du message.",
      "smtp_message_250": "Apple n’a pas accepté le message après son envoi.",
      "smtp_unknown_failure": "Échec SMTP iCloud non identifié."
    };
    return messages[code] || ("Erreur SMTP iCloud : " + String(code || "inconnue"));
  }

  async function sendTestMail() {
    var token = adminToken();
    if (!token || !mailConfigured) return;

    var confirmed = window.confirm(
      "Envoyer à mixmartialacademy@icloud.com un exemple identique au mail reçu par un adhérent ?\n\n" +
      "Données fictives : payeur Cyril / adhérent Lucas MARTIN / échéance du 05/10/2026.\n\n" +
      "Aucun adhérent réel ne sera contacté."
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

      setStatus("Exemple adhérent envoyé à " + (data.recipient || "l’adresse iCloud du club") + " avec des données fictives.", "success");
    } catch (error) {
      if (error.message === "unauthorized") {
        setStatus("Votre accès administrateur a expiré.", "error");
      } else {
        setStatus(mailErrorMessage(error.message), "error");
      }
    } finally {
      testMailButton.disabled = !mailConfigured;
    }
  }

  async function sendPayments(paymentIds) {
    var token = adminToken();
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
          paymentIds: paymentIds
        })
      });
      var data = await response.json().catch(function () { return {}; });

      if (response.status === 401) throw new Error("unauthorized");
      if (!response.ok || !data.ok) throw new Error(data.error || "send_failed");

      var parts = [];
      if (data.sent) parts.push(data.sent + " envoyée(s)");
      if (data.invalidEmail) parts.push(data.invalidEmail + " e-mail invalide");
      if (data.failed) parts.push(data.failed + " échec(s)");
      if (data.notFound) parts.push(data.notFound + " introuvable(s)");
      if (data.invalidPaymentDate) parts.push(data.invalidPaymentDate + " date invalide");

      var summaryMessage = "Relances : " + (parts.length ? parts.join(" · ") : "aucun envoi");
      var summaryKind = data.failed || data.invalidEmail || data.notFound || data.invalidPaymentDate ? "error" : "success";

      loadedKey = "";
      await loadPayments(true);
      await loadHistory();
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

  async function loadHistory() {
    var token = adminToken();
    if (!token || !historyBody) return;

    historyRefresh.disabled = true;
    try {
      var response = await fetch(API_BASE + "/admin/payments/reminders?limit=100", {
        headers: { "Authorization": "Bearer " + token },
        cache: "no-store"
      });
      var data = await response.json().catch(function () { return {}; });

      if (response.status === 401) throw new Error("unauthorized");
      if (!response.ok || !data.ok) throw new Error(data.error || "history_failed");

      var reminders = Array.isArray(data.reminders) ? data.reminders : [];
      if (!reminders.length) {
        historyBody.innerHTML = "<tr><td colspan='7' class='admin-aids-empty'>Aucune relance envoyée pour le moment.</td></tr>";
        return;
      }

      historyBody.innerHTML = reminders.map(function (entry) {
        var payer = [entry.payerFirstName, entry.payerLastName].filter(Boolean).join(" ").trim() || "—";
        var members = Array.isArray(entry.members) && entry.members.length ? entry.members.join(", ") : "—";
        return "<tr>" +
          "<td data-label='Envoyé le'>" + escapeHtml(dateTimeFr(entry.sentAt)) + "</td>" +
          "<td data-label='Échéance'>" + escapeHtml(dateFr(entry.date)) + "</td>" +
          "<td data-label='Adhérent'><strong>" + escapeHtml(members) + "</strong></td>" +
          "<td data-label='Payeur'>" + escapeHtml(payer) + "</td>" +
          "<td data-label='Destinataire'>" + escapeHtml(entry.email || "—") + "</td>" +
          "<td data-label='Montant'>" + escapeHtml(euro(entry.amount || 0)) + "</td>" +
          "<td data-label='Statut'><span class='payment-sent-badge'>Envoyé</span></td>" +
        "</tr>";
      }).join("");
    } catch (error) {
      historyBody.innerHTML = "<tr><td colspan='7' class='admin-aids-empty'>Impossible de charger l’historique pour le moment.</td></tr>";
    } finally {
      historyRefresh.disabled = false;
    }
  }

  async function loadPayments(force) {
    var token = adminToken();
    if (!token) {
      setStatus("Déverrouillez d’abord l’administration avec votre mot de passe.", "error");
      return;
    }

    var key = token + "|campaign";
    if (!force && loadedKey === key) return;

    loadButton.disabled = true;
    setStatus("Recherche de toutes les échéances refusées de la campagne dans HelloAsso…", "");

    try {
      var response = await fetch(API_BASE + "/admin/payments/refused", {
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
          ? data.total + " échéance(s) refusée(s) actuellement sur la campagne."
          : "Aucune échéance refusée actuellement sur la campagne.",
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

  historyRefresh.addEventListener("click", loadHistory);

  document.querySelectorAll('[data-admin-view="paiements"]').forEach(function (button) {
    button.addEventListener("click", function () {
      window.setTimeout(function () {
        loadMailStatus();
        loadPayments(false);
        loadHistory();
      }, 250);
    });
  });
})();