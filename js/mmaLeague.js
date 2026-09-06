(function () {
  function list(items) {
    return "<ul>" + items.map(function (item) { return "<li>" + item + "</li>"; }).join("") + "</ul>";
  }

  function weightBlock(weights) {
    if (weights.shared) return "<div class=\"weight-list\">" + weights.shared.map(function (weight) { return "<span>" + weight + "</span>"; }).join("") + "</div><p class=\"league-note\">" + weights.note + "</p>";
    return "<div class=\"weight-groups\"><div><h4>Garçons</h4><div class=\"weight-list\">" + weights.men.map(function (weight) { return "<span>" + weight + "</span>"; }).join("") + "</div></div><div><h4>Filles</h4><div class=\"weight-list\">" + weights.women.map(function (weight) { return "<span>" + weight + "</span>"; }).join("") + "</div></div></div>";
  }

  function renderCategory(category, data) {
    return "<article class=\"league-card\" id=\"league-" + category.id + "\" tabindex=\"-1\">" +
      "<header class=\"league-card-head\"><div><h2>" + category.label + " <span>— " + category.age + "</span></h2></div></header>" +
      "<div class=\"league-facts\"><div><strong>Combat</strong><span>" + category.duration + "</span></div><div><strong>Récupération</strong><span>" + category.recovery + "</span></div><div><strong>Grade minimum</strong><span>" + category.grade + "</span></div></div>" +
      "<section class=\"league-section\"><h3>Catégories de poids</h3>" + weightBlock(category.weights) + "</section>" +
      "<div class=\"league-rules-grid\"><section class=\"league-section allowed\"><h3>Autorisé</h3>" + list(category.allowed) + "</section><section class=\"league-section prohibited\"><h3>Interdit</h3>" + list(category.prohibited) + "</section></div>" +
      "<p class=\"league-disclaimer\">Cette synthèse ne remplace pas le Code sportif FMMAF applicable le jour de la compétition.</p>" +
      "<div class=\"league-actions\"><a class=\"button button-outline\" href=\"" + data.medicalDocumentsUrl + "\">Voir les documents médicaux <span aria-hidden=\"true\">↗</span></a><a class=\"button\" href=\"" + data.officialRulesUrl + "\">Voir le règlement officiel FMMAF <span aria-hidden=\"true\">↗</span></a></div>" +
      "</article>";
  }

  document.addEventListener("DOMContentLoaded", function () {
    var data = window.CLUB_DATA && window.CLUB_DATA.mmaLeague;
    var root = document.getElementById("mma-league-content");
    var tabs = document.getElementById("mma-league-tabs");
    if (!data || !root || !tabs) return;

    tabs.innerHTML = data.categories.map(function (category, index) {
      return "<button type=\"button\" class=\"league-tab\" role=\"tab\" aria-selected=\"" + (index === 0) + "\" aria-controls=\"league-" + category.id + "\" data-league-category=\"" + category.id + "\">" + category.label + "<small>" + category.age + "</small></button>";
    }).join("");
    root.innerHTML = data.categories.map(function (category) { return renderCategory(category, data); }).join("");
    document.querySelector("[data-render='mma-league-faults']").innerHTML = data.commonFaults.map(function (fault) { return "<li>" + fault + "</li>"; }).join("");

    function selectCategory(id, focus) {
      data.categories.forEach(function (category) {
        var selected = category.id === id;
        var card = document.getElementById("league-" + category.id);
        var tab = tabs.querySelector("[data-league-category='" + category.id + "']");
        card.hidden = !selected;
        tab.setAttribute("aria-selected", String(selected));
        tab.classList.toggle("is-active", selected);
        if (selected && focus) card.focus({ preventScroll: true });
      });
    }
    tabs.addEventListener("click", function (event) {
      var tab = event.target.closest("[data-league-category]");
      if (tab) selectCategory(tab.getAttribute("data-league-category"), true);
    });
    selectCategory(data.categories[0].id, false);
  });
})();
