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
    var container = document.querySelector('[data-render="schedule"]');
    if (!container) return;
    data.schedule.forEach(function (day) {
      var card = el("article", "schedule-card");
      card.appendChild(el("h3", "", day.day));
      var ul = el("ul", "schedule-list");
      day.slots.forEach(function (slot) {
        var item = el("li", "schedule-row");
        var label = el("span", "schedule-label");
        label.appendChild(el("strong", "", slot.section));
        label.appendChild(el("small", "", slot.age));
        item.appendChild(label);
        item.appendChild(el("span", "schedule-time", slot.time));
        ul.appendChild(item);
      });
      card.appendChild(ul);
      container.appendChild(card);
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

  function renderSocials(data) {
    var container = document.querySelector('[data-render="socials"]');
    if (!container) return;
    var links = [
      ["whatsapp", data.contacts.whatsappUrl],
      ["instagram", data.contacts.instagram],
      ["facebook", data.contacts.facebook],
      ["tiktok", data.contacts.tiktokUrl],
      ["discord", data.contacts.discord],
      ["google", data.contacts.google]
    ];
    links.forEach(function (item) {
      var key = item[0];
      var a = el("a", "social-link");
      a.href = item[1];
      a.target = "_blank";
      a.rel = "noopener";
      a.setAttribute("aria-label", data.socialLabels[key]);
      a.innerHTML = icon(key, data.socialLabels[key].replace("Suivre le club sur ", "").replace("Nous \u00e9crire sur ", "").replace("Rejoindre le ", ""));
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

  var helloAssoResizeReady = false;

  function setupHelloAssoResize() {
    if (helloAssoResizeReady) return;
    helloAssoResizeReady = true;
    window.addEventListener("message", function (event) {
      if (event.origin && event.origin !== "https://www.helloasso.com") return;
      var height = event.data && Number(event.data.height);
      var iframe = document.getElementById("haWidget");
      if (!iframe || !Number.isFinite(height)) return;
      iframe.style.height = Math.max(750, height) + "px";
    });
  }

  function loadHelloAssoWidget(data, container) {
    if (!container || container.querySelector("#haWidget")) return;
    setupHelloAssoResize();
    var label = el("p", "helloasso-secure-label", "Formulaire s\u00e9curis\u00e9 HelloAsso");
    var iframe = document.createElement("iframe");
    iframe.id = "haWidget";
    iframe.title = "Formulaire d'inscription HelloAsso Mix Martial Academy";
    iframe.allowTransparency = "true";
    iframe.scrolling = "auto";
    iframe.src = data.signup.helloAssoWidgetUrl;
    iframe.style.width = "100%";
    iframe.style.height = "750px";
    iframe.style.border = "none";
    container.appendChild(label);
    container.appendChild(iframe);
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
    renderSocials(data);
    renderLegal(data);
    setupSignup(data);
    setupNav();
    var year = document.getElementById("year");
    if (year) year.textContent = String(new Date().getFullYear());
  });
})();
