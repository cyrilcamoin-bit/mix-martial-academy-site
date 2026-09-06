(function () {
  var validViews = ["accueil", "cours", "tarifs", "documents-medicaux", "materiel", "regles-mma-league", "contact"];
  var defaultTitle = "Mix Martial Academy - Club de MMA au Rove | Enfants, Ados & Adultes";
  var defaultDescription = "Club de MMA au Rove pour enfants, ados et adultes. 3 cours d'essai offerts à la Salle Jennifer, proche Côte Bleue, lundi et mercredi.";
  var medicalTitle = "Documents médicaux MMA au Rove | Certificats FMMAF - Mix Martial Academy";
  var medicalDescription = "Documents médicaux MMA et formulaires FMMAF pour les compétitions Junior, Amateur et Professionnel à Mix Martial Academy, club de MMA au Rove.";
  var leagueTitle = "Règles MMA League | Mix Martial Academy Le Rove";
  var leagueDescription = "Règles MMA League FMMAF : catégories U14, U16, U18, U21 et 21+, poids, durées et grades à Mix Martial Academy Le Rove.";

  function updateMetadata(view) {
    var isMedical = view === "documents-medicaux";
    var isLeague = view === "regles-mma-league";
    var description = document.querySelector('meta[name="description"]');
    var canonical = document.querySelector('link[rel="canonical"]');
    document.title = isMedical ? medicalTitle : (isLeague ? leagueTitle : defaultTitle);
    if (description) description.setAttribute("content", isMedical ? medicalDescription : (isLeague ? leagueDescription : defaultDescription));
    if (canonical) canonical.setAttribute("href", isMedical ? "https://www.mma-lerove.fr/#documents-medicaux" : (isLeague ? "https://www.mma-lerove.fr/#regles-mma-league" : "https://www.mma-lerove.fr/"));
  }

  function getViewFromHash() {
    var hash = window.location.hash.replace("#", "");
    if (hash === "tarifs-inscription") return "tarifs";
    if (hash === "club") return "contact";
    return validViews.indexOf(hash) >= 0 ? hash : "accueil";
  }

  function setActiveView(view) {
    var hash = window.location.hash.replace("#", "");
    document.querySelectorAll("[data-view]").forEach(function (panel) {
      var active = panel.getAttribute("data-view") === view;
      panel.classList.toggle("is-active", active);
      panel.hidden = !active;
    });

    document.querySelectorAll(".nav-links a[href^='#']").forEach(function (link) {
      var active = link.getAttribute("href") === "#" + view;
      link.classList.toggle("is-active", active);
      if (active) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });

    updateMetadata(view);

    var navToggle = document.querySelector(".nav-toggle");
    var navLinks = document.getElementById("nav-links");
    if (navToggle && navLinks) {
      navToggle.setAttribute("aria-expanded", "false");
      navLinks.classList.remove("open");
    }

    if (hash === "tarifs-inscription") {
      var target = document.getElementById("tarifs-inscription");
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  document.addEventListener("DOMContentLoaded", function () {
    setActiveView(getViewFromHash());
  });

  window.addEventListener("hashchange", function () {
    setActiveView(getViewFromHash());
  });
})();
