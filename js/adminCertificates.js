(function () {
  "use strict";

  var API_BASE = "https://mma-lerove-api.cyril-camoin.workers.dev";
  var tokenInput = document.getElementById("admin-token");
  var loginButton = document.getElementById("admin-login-button");
  var logoutButton = document.getElementById("admin-logout-button");
  var panel = document.getElementById("certificates-admin-panel");
  var loginCard = document.getElementById("certificates-admin-login");
  var stats = document.getElementById("certificates-admin-stats");
  var tbody = document.getElementById("certificates-admin-body");
  var search = document.getElementById("certificates-admin-search");
  var filter = document.getElementById("certificates-admin-filter");
  var selectAll = document.getElementById("certificates-select-all");
  var reminderSelectAll = document.getElementById("certificates-reminder-select-all");
  var downloadSelected = document.getElementById("certificates-download-selected");
  var downloadAll = document.getElementById("certificates-download-all");
  var statusBox = document.getElementById("certificates-admin-status");
  var mailState = document.getElementById("certificates-mail-state");
  var testMailButton = document.getElementById("certificates-mail-test");
  var sendSelected = document.getElementById("certificates-reminder-send-selected");
  var historyRefresh = document.getElementById("certificates-history-refresh");
  var historyBody = document.getElementById("certificates-history-body");

  var members = [];
  var token = sessionStorage.getItem("mma_cert_admin_token") || "";
  var mailConfigured = false;

  function setStatus(message, kind) {
    statusBox.hidden = !message;
    statusBox.textContent = message || "";
    statusBox.className = "admin-status" + (kind ? " is-" + kind : "");
  }

  function setMailState(message, kind) {
    if (!mailState) return;
    mailState.textContent = message || "";
    mailState.className = "payment-mail-state" + (kind ? " is-" + kind : "");
  }

  function authHeaders(extra) {
    return Object.assign({
      "Authorization": "Bearer " + token
    }, extra || {});
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function validEmail(value) {
    var email = String(value || "").trim();
    return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email) && !/[\r\n]/.test(email);
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

  function fullName(member) {
    return [member.firstName, String(member.lastName || "").toUpperCase()].filter(Boolean).join(" ").trim();
  }

  function visibleMembers() {
    var query = (search.value || "").trim().toLowerCase();
    var mode = filter.value;
    return members.filter(function (member) {
      var matchesSearch = !query || (member.lastName + " " + member.firstName).toLowerCase().includes(query);
      var matchesFilter =
        mode === "all" ||
        (mode === "received" && member.received) ||
        (mode === "missing" && !member.received);
      return matchesSearch && matchesFilter;
    });
  }

  function renderStats() {
    var received = members.filter(function (member) { return member.received; }).length;
    stats.innerHTML =
      "<div><strong>" + members.length + "</strong><span>Adhérents</span></div>" +
      "<div><strong>" + received + "</strong><span>Reçus</span></div>" +
      "<div><strong>" + (members.length - received) + "</strong><span>Manquants</span></div>";
  }

  function selectedDownloadIds() {
    return Array.from(tbody.querySelectorAll(".certificate-download-check:checked")).map(function (checkbox) {
      return checkbox.value;
    });
  }

  function selectedReminderIds() {
    return Array.from(tbody.querySelectorAll(".certificate-reminder-check:checked")).map(function (checkbox) {
      return checkbox.value;
    });
  }

  function updateReminderBulkButton() {
    if (!sendSelected) return;
    var count = selectedReminderIds().length;
    sendSelected.disabled = !mailConfigured || count === 0;
    sendSelected.textContent = count > 0
      ? "Envoyer " + count + " relance" + (count > 1 ? "s" : "")
      : "Envoyer les relances sélectionnées";
  }

  function renderTable() {
    var rows = visibleMembers();

    tbody.innerHTML = rows.map(function (member) {
      var email = String(member.email || "").trim();
      var canRemind = !member.received && validEmail(email);
      var reminderText = member.lastReminderAt
        ? "<span class='payment-sent-badge'>Dernière : " + escapeHtml(dateTimeFr(member.lastReminderAt)) + "</span>"
        : (member.received
          ? "<span class='certificate-reminder-na'>—</span>"
          : "<span class='payment-refused-badge'>À relancer</span>");

      var actionHtml = "";
      if (member.received) {
        actionHtml =
          "<div class='certificate-row-actions'>" +
            "<button class='button button-small button-outline certificate-download-one' data-member-id='" + escapeHtml(member.memberId) + "' type='button'>Télécharger</button>" +
            "<button class='button button-small certificate-delete-one' data-member-id='" + escapeHtml(member.memberId) + "' data-member-name='" + escapeHtml(member.firstName + " " + member.lastName) + "' type='button'>Supprimer</button>" +
          "</div>";
      } else if (canRemind) {
        actionHtml =
          "<div class='certificate-row-actions'>" +
            "<button class='button button-small certificate-reminder-send-one' data-member-id='" + escapeHtml(member.memberId) + "' type='button' " + (mailConfigured ? "" : "disabled") + ">Envoyer</button>" +
          "</div>";
      } else {
        actionHtml = "<span class='certificate-email-missing'>E-mail indisponible</span>";
      }

      return "<tr>" +
        "<td data-label='PDF'><input class='certificate-download-check' type='checkbox' value='" + escapeHtml(member.memberId) + "' " + (member.received ? "" : "disabled") + " aria-label='Sélectionner ce certificat reçu'></td>" +
        "<td data-label='Relance'><input class='certificate-reminder-check' type='checkbox' value='" + escapeHtml(member.memberId) + "' " + (canRemind ? "" : "disabled") + " aria-label='Sélectionner cette relance'></td>" +
        "<td data-label='Nom'><strong>" + escapeHtml(String(member.lastName || "").toUpperCase()) + "</strong></td>" +
        "<td data-label='Prénom'>" + escapeHtml(member.firstName) + "</td>" +
        "<td data-label='Certificat'><span class='certificate-status " + (member.received ? "is-received" : "is-missing") + "'>" + (member.received ? "Reçu" : "Manquant") + "</span></td>" +
        "<td data-label='E-mail'>" + (email ? "<a href='mailto:" + encodeURIComponent(email) + "'>" + escapeHtml(email) + "</a>" : "—") + "</td>" +
        "<td data-label='Relance'>" + reminderText + "</td>" +
        "<td data-label='Action'>" + actionHtml + "</td>" +
      "</tr>";
    }).join("");

    tbody.querySelectorAll(".certificate-download-one").forEach(function (button) {
      button.addEventListener("click", function () {
        downloadOne(button.getAttribute("data-member-id"));
      });
    });

    tbody.querySelectorAll(".certificate-delete-one").forEach(function (button) {
      button.addEventListener("click", function () {
        deleteOne(
          button.getAttribute("data-member-id"),
          button.getAttribute("data-member-name")
        );
      });
    });

    tbody.querySelectorAll(".certificate-reminder-check").forEach(function (checkbox) {
      checkbox.addEventListener("change", updateReminderBulkButton);
    });

    tbody.querySelectorAll(".certificate-reminder-send-one").forEach(function (button) {
      button.addEventListener("click", function () {
        sendReminders([String(button.getAttribute("data-member-id"))]);
      });
    });

    updateReminderBulkButton();
  }

  async function loadMailStatus() {
    if (!token || !mailState) return;
    setMailState("Vérification de l’envoi iCloud…", "");
    try {
      var response = await fetch(API_BASE + "/admin/mail/status", {
        headers: authHeaders(),
        cache: "no-store"
      });
      var data = await response.json().catch(function () { return {}; });
      if (response.status === 401) throw new Error("unauthorized");
      if (!response.ok || !data.ok) throw new Error(data.error || "mail_status_failed");

      mailConfigured = Boolean(data.configured);
      if (testMailButton) testMailButton.disabled = !mailConfigured;
      setMailState(
        mailConfigured
          ? "Envoi direct actif depuis " + (data.sender || "l’adresse iCloud du club") + "."
          : "Envoi direct iCloud indisponible.",
        mailConfigured ? "success" : "warning"
      );
      renderTable();
    } catch (error) {
      mailConfigured = false;
      if (testMailButton) testMailButton.disabled = true;
      setMailState("Impossible de vérifier la configuration iCloud.", "error");
      updateReminderBulkButton();
    }
  }

  async function loadHistory() {
    if (!token || !historyBody) return;
    if (historyRefresh) historyRefresh.disabled = true;

    try {
      var response = await fetch(API_BASE + "/admin/certificates/reminders?limit=200", {
        headers: authHeaders(),
        cache: "no-store"
      });
      var data = await response.json().catch(function () { return {}; });
      if (response.status === 401) throw new Error("unauthorized");
      if (!response.ok || !data.ok) throw new Error(data.error || "history_failed");

      var reminders = Array.isArray(data.reminders) ? data.reminders : [];
      if (!reminders.length) {
        historyBody.innerHTML = "<tr><td colspan='4' class='admin-aids-empty'>Aucune relance envoyée pour le moment.</td></tr>";
        return;
      }

      historyBody.innerHTML = reminders.map(function (entry) {
        var memberName = [entry.firstName, String(entry.lastName || "").toUpperCase()].filter(Boolean).join(" ").trim() || "—";
        return "<tr>" +
          "<td>" + escapeHtml(dateTimeFr(entry.sentAt)) + "</td>" +
          "<td><strong>" + escapeHtml(memberName) + "</strong></td>" +
          "<td>" + escapeHtml(entry.email || "—") + "</td>" +
          "<td><span class='payment-sent-badge'>Envoyé</span></td>" +
        "</tr>";
      }).join("");
    } catch (error) {
      historyBody.innerHTML = "<tr><td colspan='4' class='admin-aids-empty'>Impossible de charger l’historique pour le moment.</td></tr>";
    } finally {
      if (historyRefresh) historyRefresh.disabled = false;
    }
  }

  async function loadStatus() {
    setStatus("Chargement des adhérents...", "");
    try {
      var response = await fetch(API_BASE + "/admin/certificates/status", {
        headers: authHeaders(),
        cache: "no-store"
      });
      var data = await response.json().catch(function () { return {}; });

      if (response.status === 401) throw new Error("unauthorized");
      if (!response.ok || !data.ok) throw new Error(data.error || "load_failed");

      members = data.members || [];
      loginCard.hidden = true;
      panel.hidden = false;
      if (selectAll) selectAll.checked = false;
      if (reminderSelectAll) reminderSelectAll.checked = false;
      renderStats();
      renderTable();
      setStatus("", "");
      await loadMailStatus();
      await loadHistory();
    } catch (error) {
      panel.hidden = true;
      loginCard.hidden = false;
      sessionStorage.removeItem("mma_cert_admin_token");
      token = "";
      if (error.message === "unauthorized") {
        setStatus("Code administrateur incorrect.", "error");
      } else if (error.message === "storage_not_configured") {
        setStatus("Le stockage des certificats n’est pas encore activé.", "error");
      } else {
        setStatus("Impossible de charger le suivi pour le moment.", "error");
      }
    }
  }

  loginButton.addEventListener("click", function () {
    token = tokenInput.value.trim();
    if (!token) {
      setStatus("Saisissez le code administrateur.", "error");
      return;
    }
    sessionStorage.setItem("mma_cert_admin_token", token);
    loadStatus();
  });

  logoutButton.addEventListener("click", function () {
    sessionStorage.removeItem("mma_cert_admin_token");
    token = "";
    members = [];
    panel.hidden = true;
    loginCard.hidden = false;
    tokenInput.value = "";
    setStatus("", "");
  });

  search.addEventListener("input", renderTable);
  filter.addEventListener("change", renderTable);

  selectAll.addEventListener("change", function () {
    tbody.querySelectorAll(".certificate-download-check:not(:disabled)").forEach(function (checkbox) {
      checkbox.checked = selectAll.checked;
    });
  });

  if (reminderSelectAll) {
    reminderSelectAll.addEventListener("change", function () {
      tbody.querySelectorAll(".certificate-reminder-check:not(:disabled)").forEach(function (checkbox) {
        checkbox.checked = reminderSelectAll.checked;
      });
      updateReminderBulkButton();
    });
  }

  async function downloadBlob(response, fallbackName) {
    if (!response.ok) {
      var data = await response.json().catch(function () { return {}; });
      throw new Error(data.error || "download_failed");
    }
    var blob = await response.blob();
    var disposition = response.headers.get("Content-Disposition") || "";
    var match = disposition.match(/filename="?([^"]+)"?/i);
    var name = match ? match[1] : fallbackName;
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }

  async function deleteOne(memberId, memberName) {
    var displayName = memberName || "cet adhérent";
    var confirmed = window.confirm(
      "Supprimer définitivement le certificat de " + displayName + "?\n\n" +
      "Le fichier sera supprimé du stockage et l’adhérent repassera en « Manquant ». " +
      "Cette action ne modifie pas son inscription HelloAsso."
    );

    if (!confirmed) return;

    setStatus("Suppression du certificat...", "");

    try {
      var response = await fetch(API_BASE + "/admin/certificates/delete", {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ memberId: memberId })
      });
      var data = await response.json().catch(function () { return {}; });

      if (!response.ok || !data.ok) throw new Error(data.error || "delete_failed");

      await loadStatus();
      setStatus("Certificat supprimé. L’adhérent est de nouveau indiqué comme « Manquant ».", "success");
    } catch (error) {
      setStatus("Impossible de supprimer ce certificat pour le moment.", "error");
    }
  }

  async function downloadOne(memberId) {
    setStatus("Préparation du PDF...", "");
    try {
      var response = await fetch(API_BASE + "/admin/certificates/download?memberId=" + encodeURIComponent(memberId), {
        headers: authHeaders()
      });
      await downloadBlob(response, "certificat.pdf");
      setStatus("", "");
    } catch (error) {
      setStatus("Impossible de télécharger ce certificat.", "error");
    }
  }

  downloadSelected.addEventListener("click", async function () {
    var ids = selectedDownloadIds();
    if (!ids.length) {
      setStatus("Sélectionnez au moins un certificat reçu.", "error");
      return;
    }
    setStatus("Préparation du ZIP...", "");
    try {
      var response = await fetch(API_BASE + "/admin/certificates/download-selected", {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ memberIds: ids })
      });
      await downloadBlob(response, "Certificats_MMA_2026-2027.zip");
      setStatus("", "");
    } catch (error) {
      setStatus("Impossible de préparer la sélection.", "error");
    }
  });

  downloadAll.addEventListener("click", async function () {
    setStatus("Préparation de tous les certificats reçus...", "");
    try {
      var response = await fetch(API_BASE + "/admin/certificates/download-all", {
        headers: authHeaders()
      });
      await downloadBlob(response, "Certificats_MMA_2026-2027.zip");
      setStatus("", "");
    } catch (error) {
      setStatus("Impossible de préparer le téléchargement complet.", "error");
    }
  });

  async function sendTestReminder() {
    if (!token || !mailConfigured) return;
    var confirmed = window.confirm(
      "Envoyer à mixmartialacademy@icloud.com un exemple de relance certificat médical ?\n\n" +
      "Données fictives : Lucas MARTIN.\n\n" +
      "Aucun adhérent réel ne sera contacté."
    );
    if (!confirmed) return;

    testMailButton.disabled = true;
    setStatus("Envoi de la relance de test…", "");
    try {
      var response = await fetch(API_BASE + "/admin/certificates/reminders/test", {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" })
      });
      var data = await response.json().catch(function () { return {}; });
      if (response.status === 401) throw new Error("unauthorized");
      if (!response.ok || !data.ok) throw new Error(data.error || "test_failed");
      setStatus("Relance de test envoyée uniquement à " + (data.recipient || "l’adresse iCloud du club") + ".", "success");
    } catch (error) {
      setStatus("Impossible d’envoyer la relance de test pour le moment.", "error");
    } finally {
      testMailButton.disabled = !mailConfigured;
    }
  }

  async function sendReminders(memberIds) {
    if (!token || !memberIds.length) return;
    if (!mailConfigured) {
      setStatus("L’envoi direct iCloud n’est pas disponible.", "error");
      return;
    }

    var selectedMembers = members.filter(function (member) {
      return memberIds.includes(String(member.memberId));
    });
    var lines = selectedMembers.map(function (member) {
      var line = fullName(member) + " — " + (member.email || "e-mail indisponible");
      if (member.lastReminderAt) line += " — déjà relancé le " + dateTimeFr(member.lastReminderAt);
      return line;
    });

    var confirmed = window.confirm(
      "Envoyer " + memberIds.length + " relance" + (memberIds.length > 1 ? "s" : "") +
      " depuis mixmartialacademy@icloud.com ?\n\n" +
      lines.join("\n") +
      "\n\nChaque destinataire recevra un message individuel."
    );
    if (!confirmed) return;

    sendSelected.disabled = true;
    tbody.querySelectorAll(".certificate-reminder-send-one").forEach(function (button) {
      button.disabled = true;
    });
    setStatus("Envoi des relances certificats médicaux…", "");

    try {
      var response = await fetch(API_BASE + "/admin/certificates/reminders/send", {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ memberIds: memberIds })
      });
      var data = await response.json().catch(function () { return {}; });

      if (response.status === 401) throw new Error("unauthorized");
      if (!response.ok || !data.ok) throw new Error(data.error || "send_failed");

      var parts = [];
      if (data.sent) parts.push(data.sent + " envoyée(s)");
      if (data.received) parts.push(data.received + " certificat(s) déjà reçu(s)");
      if (data.invalidEmail) parts.push(data.invalidEmail + " e-mail invalide");
      if (data.failed) parts.push(data.failed + " échec(s)");
      if (data.notFound) parts.push(data.notFound + " introuvable(s)");

      await loadStatus();
      setStatus(
        "Relances : " + (parts.length ? parts.join(" · ") : "aucun envoi"),
        data.failed || data.invalidEmail || data.notFound ? "error" : "success"
      );
    } catch (error) {
      if (error.message === "unauthorized") {
        setStatus("Votre accès administrateur a expiré.", "error");
      } else {
        setStatus("Impossible d’envoyer les relances pour le moment.", "error");
      }
      updateReminderBulkButton();
    }
  }

  if (sendSelected) {
    sendSelected.addEventListener("click", function () {
      sendReminders(selectedReminderIds());
    });
  }

  if (testMailButton) testMailButton.addEventListener("click", sendTestReminder);
  if (historyRefresh) historyRefresh.addEventListener("click", loadHistory);

  if (token) loadStatus();
})();
