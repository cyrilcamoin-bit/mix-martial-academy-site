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

  function renderConditions(data) {
    var cards = [
      ["Adh\u00e9sion annuelle", "L'inscription est annuelle, ferme et d\u00e9finitive."],
      ["Aucun remboursement", "Aucun remboursement total ou partiel ne pourra \u00eatre effectu\u00e9, y compris en cas d'arr\u00eat, d'absence prolong\u00e9e, de blessure ou de changement de situation personnelle."],
      ["Paiement HelloAsso", data.prices.paymentRule],
      ["\u00c9ch\u00e9ance refus\u00e9e", data.signup.unpaidRule],
      ["R\u00e8glement et mat\u00e9riel", "L'inscription vaut acceptation du r\u00e8glement int\u00e9rieur, du mat\u00e9riel obligatoire selon la section, et de la r\u00e8gle des gants de boxe 16 oz uniquement."]
    ];

    document.querySelectorAll('[data-render="condition-cards"], [data-render="condition-cards-detail"]').forEach(function (container) {
      var visibleCards = container.getAttribute("data-render") === "condition-cards" ? cards.slice(0, 4) : cards;
      visibleCards.forEach(function (card) {
        var article = el("article", "condition-card");
        article.appendChild(el("h3", "", card[0]));
        article.appendChild(el("p", "", card[1]));
        container.appendChild(article);
      });
    });

    var listContainer = document.querySelector('[data-render="condition-list"]');
    if (!listContainer) return;
    data.signup.conditions.forEach(function (condition) {
      listContainer.appendChild(el("li", "", condition));
    });
  }

  function renderMaterials(data) {
    var rulesContainer = document.querySelector('[data-render="material-rules"]');
    if (rulesContainer) {
      var ruleList = el("div", "chip-list");
      data.equipment.globalRules.forEach(function (rule) {
        ruleList.appendChild(el("span", "chip", rule));
      });
      rulesContainer.appendChild(ruleList);
      rulesContainer.appendChild(el("p", "note", data.equipment.sectionsRule));
    }

    var materialContainer = document.querySelector('[data-render="materials"]');
    if (!materialContainer) return;
    data.equipment.sections.forEach(function (section, index) {
      var card = el("article", "material-card" + (index === 0 ? " is-active" : ""));
      card.setAttribute("data-material-panel", section.key);
      if (index !== 0) card.hidden = true;
      card.appendChild(el("h3", "", section.section + " - " + section.age));
      card.appendChild(el("strong", "material-heading", "Obligatoire"));
      card.appendChild(list(section.required));
      card.appendChild(el("strong", "material-heading", "Optionnel"));
      card.appendChild(list(section.optional));
      if (section.note) card.appendChild(el("p", "note", section.note));
      materialContainer.appendChild(card);
    });
  }

  function icon(label) {
    return '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 3.2 1.9 4 4.4.6-3.2 3.1.8 4.4-3.9-2.1-3.9 2.1.8-4.4-3.2-3.1 4.4-.6L12 5.2Z"/></svg><span>' + label + "</span>";
  }

  function renderSocials(data) {
    var container = document.querySelector('[data-render="socials"]');
    if (!container) return;
    var links = [
      ["whatsapp", data.contacts.whatsappUrl],
      ["instagram", data.contacts.instagram],
      ["facebook", data.contacts.facebook],
      ["tiktok", data.contacts.tiktokUrl],
      ["discord", data.contacts.discord]
    ];
    links.forEach(function (item) {
      var key = item[0];
      var a = el("a", "social-link");
      a.href = item[1];
      a.target = "_blank";
      a.rel = "noopener";
      a.setAttribute("aria-label", data.socialLabels[key]);
      a.innerHTML = icon(data.socialLabels[key].replace("Suivre le club sur ", "").replace("Nous \u00e9crire sur ", "").replace("Rejoindre le ", ""));
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

  function setupSignup(data) {
    var form = document.getElementById("signup-conditions");
    var link = document.getElementById("helloasso-link");
    var placeholder = document.getElementById("helloasso-placeholder");
    if (!form || !link) return;
    var inputs = Array.prototype.slice.call(form.querySelectorAll('input[type="checkbox"]'));
    link.href = data.signup.helloAssoUrl;

    function update() {
      var complete = inputs.every(function (input) { return input.checked; });
      var missingHelloAsso = data.signup.helloAssoUrl.indexOf("A_COMPLETER") >= 0;
      link.classList.toggle("disabled", !complete);
      link.classList.toggle("placeholder-active", complete && missingHelloAsso);
      link.setAttribute("aria-disabled", String(!complete));
      link.textContent = complete ? "Continuer vers HelloAsso" : "Acceptez les conditions pour acc\u00e9der \u00e0 HelloAsso";
      if (placeholder) placeholder.hidden = !(complete && missingHelloAsso);
    }

    inputs.forEach(function (input) {
      input.addEventListener("change", update);
    });
    link.addEventListener("click", function (event) {
      if (link.getAttribute("aria-disabled") === "true") event.preventDefault();
      if (link.classList.contains("placeholder-active")) event.preventDefault();
    });
    update();
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
    renderConditions(data);
    renderMaterials(data);
    renderSocials(data);
    renderLegal(data);
    setupSignup(data);
    setupNav();
    var year = document.getElementById("year");
    if (year) year.textContent = String(new Date().getFullYear());
  });
})();
