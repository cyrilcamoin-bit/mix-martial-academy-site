(function () {
  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function list(items) {
    var ul = el("ul");
    items.forEach(function (item) {
      ul.appendChild(el("li", "", item));
    });
    return ul;
  }

  function renderSchedule(data) {
    var container = document.querySelector('[data-render="trial-schedule"]');
    if (!container || !data.schedule.length) return;

    var slots = data.schedule[0].slots;
    slots.forEach(function (slot, index) {
      var row = el("div", "home-trial-schedule-row");
      row.style.setProperty("--schedule-delay", String(90 + index * 90) + "ms");

      var label = el("span", "home-trial-schedule-label");
      label.appendChild(el("strong", "", slot.section));
      label.appendChild(el("small", "", slot.age));

      row.appendChild(label);
      row.appendChild(el("span", "home-trial-schedule-time", slot.time));
      container.appendChild(row);
    });
  }

  function renderPrices(data) {
    var container = document.querySelector('[data-render="prices"]');
    if (!container) return;
    data.prices.sections.forEach(function (price, index) {
      var card = el("article", "price-card" + (index === 1 ? " price-card-featured" : ""));
      card.appendChild(el("h3", "", price.section + " - " + price.age));
      card.appendChild(el("span", "price", price.price));
      card.appendChild(el("p", "price-note", "Licence : " + data.prices.license));
      card.appendChild(el("p", "price-note", data.prices.paymentRule));
      container.appendChild(card);
    });
  }

  function renderMaterials(data) {
    var materialContainer = document.querySelector('[data-render="materials"]');
    if (!materialContainer) return;
    data.equipment.sections.forEach(function (section) {
      var card = el("article", "material-card");
      card.appendChild(el("h3", "", section.section + " - " + section.age));
      card.appendChild(el("strong", "material-heading", "Obligatoire"));
      card.appendChild(list(section.required));
      card.appendChild(el("strong", "material-heading", "Optionnel"));
      card.appendChild(list(section.optional));
      if (section.note) card.appendChild(el("p", "note", section.note));
      materialContainer.appendChild(card);
    });
  }

  function icon(key, label) {
    return '<img src="assets/icons/' + key + '.svg?v=20260707-google" alt="" aria-hidden="true"><span>' + label + "</span>";
  }

  function renderCommunity(data) {
    var container = document.querySelector('[data-render="community"]');
    if (!container) return;
    var card = data.community.card;
    container.href = data.contacts.whatsappUrl;
    container.querySelector("h2").textContent = card.title;
    container.querySelector(".community-summary").textContent = card.text;
    container.querySelector(".community-reminder").textContent = card.reminder;
    var button = container.querySelector(".community-cta");
    button.lastChild.textContent = card.button;
  }

  function renderSocials(data) {
    var container = document.querySelector('[data-render="socials"]');
    if (!container) return;
    var links = [
      ["whatsapp", data.contacts.whatsappUrl],
      ["instagram", data.contacts.instagram],
      ["facebook", data.contacts.facebook],
      ["tiktok", data.contacts.tiktokUrl],
      ["google", data.contacts.google]
    ];
    links.forEach(function (item) {
      var key = item[0];
      var a = el("a", "social-link");
      a.href = item[1];
      a.target = "_blank";
      a.rel = "noopener";
      a.setAttribute("aria-label", data.socialLabels[key]);
      a.innerHTML = icon(key, key === "whatsapp" ? "WhatsApp" : data.socialLabels[key].replace("Suivre le club sur ", "").replace("Nous \u00e9crire sur ", "").replace("Rejoindre le ", ""));
      container.appendChild(a);
    });
  }

  function renderLegal(data) {
    var container = document.querySelector('[data-render="legal"]');
    if (!container) return;
    [
      ["D\u00e9nomination", data.legal.associationName],
      ["Forme", data.legal.legalForm],
      ["SIREN", data.legal.siren],
      ["SIRET", data.legal.siret],
      ["RNA", data.legal.rna],
      ["APE", data.legal.ape],
      ["Si\u00e8ge social", data.legal.legalAddress],
      ["Lieu des cours", data.legal.trainingAddress],
      ["Responsable de publication", data.legal.publicationManager],
      ["H\u00e9bergement", data.legal.hosting],
      ["Contact", data.contacts.email]
    ].forEach(function (row) {
      container.appendChild(el("dt", "", row[0]));
      container.appendChild(el("dd", "", row[1]));
    });
  }

  // L'iframe conserve une hauteur contrôlée : les messages de redimensionnement
  // de HelloAsso ne doivent pas produire des milliers de pixels blancs sur iOS.
  function loadHelloAssoWidget(data, container) {
    if (!container || container.querySelector("#haWidget")) return;
    var label = el("p", "helloasso-secure-label", "Formulaire sécurisé HelloAsso");
    var iframe = document.createElement("iframe");
    iframe.id = "haWidget";
    iframe.title = "Formulaire d'inscription HelloAsso Mix Martial Academy";
    iframe.allowTransparency = "true";
    iframe.setAttribute("scrolling", "yes");
    iframe.src = data.signup.helloAssoWidgetUrl;
    iframe.style.width = "100%";
    iframe.style.border = "none";
    iframe.style.height = "1650px";
    container.appendChild(label);
    container.appendChild(iframe);

    // HelloAsso communique la hauteur réelle via postMessage.
    // On suit aussi les diminutions de hauteur lors du changement d'étape.
    // Validation stricte de l'émetteur pour éviter les messages sans rapport.
    window.addEventListener("message", function (event) {
      if (event.origin !== "https://www.helloasso.com") return;
      if (event.source !== iframe.contentWindow) return;
      var height = Number(event.data && event.data.height);
      if (!Number.isFinite(height) || height < 300 || height > 20000) return;
      // Un plafond protège la page des grandes zones blanches parfois
      // envoyées par le widget. Au-delà, le formulaire défile en interne.
      var target = Math.max(750, Math.min(3600, Math.ceil(height + 24)));
      iframe.style.height = target + "px";
    });
  }

  function setupSignup(data) {
    var widgetContainer = document.getElementById("helloasso-widget-container");
    loadHelloAssoWidget(data, widgetContainer);
  }

  function setupNav() {
    var toggle = document.querySelector(".nav-toggle");
    var links = document.getElementById("nav-links");
    if (!toggle || !links) return;
    toggle.addEventListener("click", function () {
      var expanded = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", String(!expanded));
      links.classList.toggle("open", !expanded);
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    var data = window.CLUB_DATA;
    renderSchedule(data);
    renderPrices(data);
    renderMaterials(data);
    renderCommunity(data);
    renderSocials(data);
    renderLegal(data);
    setupSignup(data);
    setupNav();
    var year = document.getElementById("year");
    if (year) year.textContent = String(new Date().getFullYear());
  });
})();
