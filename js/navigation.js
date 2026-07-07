(function () {
  var validViews = ["accueil", "cours", "inscription", "materiel", "club", "contact"];

  function getViewFromHash() {
    var hash = window.location.hash.replace("#", "");
    return validViews.indexOf(hash) >= 0 ? hash : "accueil";
  }

  function setActiveView(view) {
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

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function setupMaterialTabs() {
    var tabs = Array.prototype.slice.call(document.querySelectorAll("[data-material-tab]"));
    var panels = Array.prototype.slice.call(document.querySelectorAll("[data-material-panel]"));
    if (!tabs.length || !panels.length) return;

    function activate(key) {
      tabs.forEach(function (tab) {
        var active = tab.getAttribute("data-material-tab") === key;
        tab.classList.toggle("is-active", active);
        tab.setAttribute("aria-selected", String(active));
      });
      panels.forEach(function (panel) {
        var active = panel.getAttribute("data-material-panel") === key;
        panel.classList.toggle("is-active", active);
        panel.hidden = !active;
      });
    }

    tabs.forEach(function (tab) {
      tab.setAttribute("role", "tab");
      tab.addEventListener("click", function () {
        activate(tab.getAttribute("data-material-tab"));
      });
    });

    panels.forEach(function (panel) {
      panel.setAttribute("role", "tabpanel");
    });
    activate("enfant");
  }

  document.addEventListener("DOMContentLoaded", function () {
    setActiveView(getViewFromHash());
    setupMaterialTabs();
  });

  window.addEventListener("hashchange", function () {
    setActiveView(getViewFromHash());
  });
})();
