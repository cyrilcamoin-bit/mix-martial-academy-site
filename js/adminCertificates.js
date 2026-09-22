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
  var downloadSelected = document.getElementById("certificates-download-selected");
  var downloadAll = document.getElementById("certificates-download-all");
  var statusBox = document.getElementById("certificates-admin-status");

  var members = [];
  var token = sessionStorage.getItem("mma_cert_admin_token") || "";

  function setStatus(message, kind) {
    statusBox.hidden = !message;
    statusBox.textContent = message || "";
    statusBox.className = "admin-status" + (kind ? " is-" + kind : "");
  }

  function authHeaders(extra) {
    return Object.assign({
      "Authorization": "Bearer " + token
    }, extra || {});
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

  function renderTable() {
    var rows = visibleMembers();
    tbody.innerHTML = rows.map(function (member) {
      return "<tr>" +
        "<td><input class='certificate-row-check' type='checkbox' value='" + member.memberId + "' " + (member.received ? "" : "disabled") + "></td>" +
        "<td><strong>" + escapeHtml(String(member.lastName || "").toUpperCase()) + "</strong></td>" +
        "<td>" + escapeHtml(member.firstName) + "</td>" +
        "<td><span class='certificate-status " + (member.received ? "is-received" : "is-missing") + "'>" + (member.received ? "Reçu" : "Manquant") + "</span></td>" +
        "<td>" + (member.received
          ? "<div class='certificate-row-actions'>" +
              "<button class='button button-small button-outline certificate-download-one' data-member-id='" + member.memberId + "'>Télécharger</button>" +
              "<button class='button button-small certificate-delete-one' data-member-id='" + member.memberId + "' data-member-name='" + escapeHtml(member.firstName + " " + member.lastName) + "'>Supprimer</button>" +
            "</div>"
          : "") + "</td>" +
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
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  async function loadStatus() {
    setStatus("Chargement des adhérents...", "");
    try {
      var response = await fetch(API_BASE + "/admin/certificates/status", {
        headers: authHeaders()
      });
      var data = await response.json().catch(function () { return {}; });

      if (response.status === 401) throw new Error("unauthorized");
      if (!response.ok || !data.ok) throw new Error(data.error || "load_failed");

      members = data.members || [];
      loginCard.hidden = true;
      panel.hidden = false;
      renderStats();
      renderTable();
      setStatus("", "");
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
    tbody.querySelectorAll(".certificate-row-check:not(:disabled)").forEach(function (checkbox) {
      checkbox.checked = selectAll.checked;
    });
  });

  function selectedIds() {
    return Array.from(tbody.querySelectorAll(".certificate-row-check:checked")).map(function (checkbox) {
      return checkbox.value;
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
      "Supprimer définitivement le certificat de " + displayName + " ?\n\n" +
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

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "delete_failed");
      }

      var member = members.find(function (entry) {
        return String(entry.memberId) === String(memberId);
      });
      if (member) member.received = false;

      selectAll.checked = false;
      renderStats();
      renderTable();
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
    var ids = selectedIds();
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

  if (token) loadStatus();
})();
