(function () {
  var validViews = ["accueil", "cours", "tarifs", "materiel", "contact"];

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
