(function () {
  var storageKey = "mixMartialAcademyStudioV13";

  var defaultText = {
    hero: {
      title: "mix martial academy",
      eyebrow: "Club de MMA au Rove",
      subtitle: "Club de MMA au Rove. Enfants, ados et adultes dans un cadre sérieux pour apprendre et progresser.",
      buttonCourses: "Voir les cours",
      buttonSignup: "S'inscrire",
      buttonContact: "Nous contacter",
      cardTitle: "MMA structuré, cadre familial."
    },
    nav: {
      home: "Accueil",
      courses: "Cours",
      prices: "Tarifs",
      equipment: "Matériel",
      club: "Vie du club",
      contact: "Contact"
    },
    footer: {
      short: "MIX MARTIAL ACADEMY - Club de MMA au Rove."
    },
    chatbot: {
      fallback: "Je n'ai pas encore cette information. Pour une réponse précise, contactez le club par WhatsApp ou par email.",
      quickActions: {
        hours: "Horaires",
        prices: "Tarifs",
        signup: "Inscription",
        equipment: "Matériel"
      }
    }
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function getPath(source, path) {
    return path.split(".").reduce(function (current, key) {
      return current && current[key];
    }, source);
  }

  function setPath(source, path, value) {
    var parts = path.split(".");
    var target = source;
    parts.slice(0, -1).forEach(function (part) {
      target[part] = target[part] || {};
      target = target[part];
    });
    target[parts[parts.length - 1]] = value;
  }

  function merge(base, custom) {
    var output = clone(base);
    Object.keys(custom || {}).forEach(function (key) {
      if (custom[key] && typeof custom[key] === "object" && !Array.isArray(custom[key])) {
        output[key] = merge(output[key] || {}, custom[key]);
      } else {
        output[key] = custom[key];
      }
    });
    return output;
  }

  function readSaved() {
    try {
      return JSON.parse(localStorage.getItem(storageKey) || "{}");
    } catch (error) {
      return {};
    }
  }

  function stateFromStorage() {
    var saved = readSaved();
    return {
      theme: merge(window.SITE_THEME_DEFAULTS || {}, saved.theme || {}),
      texts: merge(defaultText, saved.texts || {})
    };
  }

  var state = stateFromStorage();

  function saveState() {
    localStorage.setItem(storageKey, JSON.stringify(state));
    updateExportPreview();
  }

  function fillInputs() {
    document.querySelectorAll("[data-theme-path]").forEach(function (input) {
      var value = getPath(state.theme, input.getAttribute("data-theme-path"));
      if (value !== undefined) input.value = value;
    });
    document.querySelectorAll("[data-text-path]").forEach(function (input) {
      var value = getPath(state.texts, input.getAttribute("data-text-path"));
      if (value !== undefined) input.value = value;
    });
  }

  function renderPreviewTexts() {
    document.querySelectorAll("[data-preview]").forEach(function (node) {
      var value = getPath(state.texts, node.getAttribute("data-preview"));
      if (value !== undefined) node.textContent = value;
    });
    document.querySelectorAll("[data-preview-theme]").forEach(function (node) {
      var value = getPath(state.theme, node.getAttribute("data-preview-theme"));
      if (value !== undefined) node.textContent = value;
    });
  }

  function applyPreview() {
    if (typeof window.applySiteTheme === "function") {
      window.applySiteTheme(state.theme);
    }
    renderPreviewTexts();
    updateExportPreview();
  }

  function updateExportPreview() {
    var output = document.getElementById("export-preview");
    if (!output) return;
    output.value = JSON.stringify({
      theme: state.theme,
      texts: state.texts,
      note: "Ce fichier est un export de préparation. Il ne publie rien automatiquement."
    }, null, 2);
  }

  function bindInputs() {
    document.querySelectorAll("[data-theme-path]").forEach(function (input) {
      input.addEventListener("input", function () {
        setPath(state.theme, input.getAttribute("data-theme-path"), input.value);
        applyPreview();
        saveState();
      });
    });
    document.querySelectorAll("[data-text-path]").forEach(function (input) {
      input.addEventListener("input", function () {
        setPath(state.texts, input.getAttribute("data-text-path"), input.value);
        renderPreviewTexts();
        saveState();
      });
    });
  }

  function bindTabs() {
    document.querySelectorAll("[data-tab]").forEach(function (button) {
      button.addEventListener("click", function () {
        var key = button.getAttribute("data-tab");
        document.querySelectorAll("[data-tab]").forEach(function (item) {
          item.classList.toggle("is-active", item === button);
        });
        document.querySelectorAll("[data-panel]").forEach(function (panel) {
          panel.classList.toggle("is-active", panel.getAttribute("data-panel") === key);
        });
      });
    });
  }

  function themeFileContent() {
    return "(function () {\n" +
      "  var defaultTheme = " + JSON.stringify(state.theme, null, 2) + ";\n" +
      "  function setVar(root, name, value) {\n" +
      "    if (value !== undefined && value !== null && value !== \"\") root.style.setProperty(name, value);\n" +
      "  }\n" +
      "  function applySiteTheme(theme) {\n" +
      "    var activeTheme = theme || defaultTheme;\n" +
      "    var root = document.documentElement;\n" +
      "    setVar(root, \"--font-body\", activeTheme.fonts.body);\n" +
      "    setVar(root, \"--font-club-name\", activeTheme.fonts.clubName);\n" +
      "    setVar(root, \"--font-headings\", activeTheme.fonts.headings);\n" +
      "    setVar(root, \"--color-bg\", activeTheme.colors.background);\n" +
      "    setVar(root, \"--color-bg-soft\", activeTheme.colors.backgroundSoft);\n" +
      "    setVar(root, \"--color-card\", activeTheme.colors.card);\n" +
      "    setVar(root, \"--color-card-soft\", activeTheme.colors.cardSoft);\n" +
      "    setVar(root, \"--color-text\", activeTheme.colors.text);\n" +
      "    setVar(root, \"--color-muted\", activeTheme.colors.textMuted);\n" +
      "    setVar(root, \"--color-red\", activeTheme.colors.red);\n" +
      "    setVar(root, \"--color-red-hover\", activeTheme.colors.redHover);\n" +
      "    setVar(root, \"--color-red-dark\", activeTheme.colors.redDark);\n" +
      "    setVar(root, \"--color-border\", activeTheme.colors.border);\n" +
      "    setVar(root, \"--fs-nav\", activeTheme.fontSizes.nav);\n" +
      "    setVar(root, \"--fs-hero-title\", activeTheme.fontSizes.heroTitle);\n" +
      "    setVar(root, \"--fs-hero-subtitle\", activeTheme.fontSizes.heroSubtitle);\n" +
      "    setVar(root, \"--fs-section-title\", activeTheme.fontSizes.sectionTitle);\n" +
      "    setVar(root, \"--fs-card-title\", activeTheme.fontSizes.cardTitle);\n" +
      "    setVar(root, \"--fs-body\", activeTheme.fontSizes.body);\n" +
      "    setVar(root, \"--fs-small\", activeTheme.fontSizes.small);\n" +
      "    setVar(root, \"--fs-chatbot\", activeTheme.fontSizes.chatbot);\n" +
      "    setVar(root, \"--max-width\", activeTheme.layout.maxWidth);\n" +
      "    setVar(root, \"--section-padding-desktop\", activeTheme.layout.sectionPaddingDesktop);\n" +
      "    setVar(root, \"--section-padding-mobile\", activeTheme.layout.sectionPaddingMobile);\n" +
      "    setVar(root, \"--card-radius\", activeTheme.layout.cardRadius);\n" +
      "    setVar(root, \"--button-radius\", activeTheme.layout.buttonRadius);\n" +
      "    setVar(root, \"--hero-gap\", activeTheme.layout.heroGap);\n" +
      "    setVar(root, \"--grid-gap\", activeTheme.layout.gridGap);\n" +
      "    setVar(root, \"--logo-header-size\", activeTheme.logo.headerSize);\n" +
      "    setVar(root, \"--logo-hero-card-size\", activeTheme.logo.heroCardSize);\n" +
      "    setVar(root, \"--card-shadow\", activeTheme.effects.cardShadow);\n" +
      "    setVar(root, \"--border-opacity\", activeTheme.effects.borderOpacity);\n" +
      "    setVar(root, \"--background-glow\", activeTheme.effects.backgroundGlow);\n" +
      "    if (window.CLUB_DATA && window.CLUB_DATA.chatbot) {\n" +
      "      window.CLUB_DATA.chatbot.welcome = activeTheme.chatbot.welcome;\n" +
      "      window.CLUB_DATA.chatbot.name = activeTheme.chatbot.title;\n" +
      "      window.CLUB_DATA.chatbot.fallback = activeTheme.chatbot.fallback;\n" +
      "    }\n" +
      "    document.querySelectorAll(\".chatbot-toggle\").forEach(function (node) { node.textContent = activeTheme.chatbot.buttonLabel; });\n" +
      "    document.querySelectorAll(\".chatbot-head strong\").forEach(function (node) { node.textContent = activeTheme.chatbot.title; });\n" +
      "    window.SITE_THEME = activeTheme;\n" +
      "    return activeTheme;\n" +
      "  }\n" +
      "  window.SITE_THEME_DEFAULTS = defaultTheme;\n" +
      "  window.SITE_THEME = defaultTheme;\n" +
      "  window.applySiteTheme = applySiteTheme;\n" +
      "  applySiteTheme(defaultTheme);\n" +
      "})();\n";
  }

  function download(filename, content, type) {
    var blob = new Blob([content], { type: type });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function bindActions() {
    var apply = document.getElementById("apply-preview");
    var reset = document.getElementById("reset-studio");
    var downloadTheme = document.getElementById("download-theme");
    var downloadJson = document.getElementById("download-json");
    var copy = document.getElementById("copy-config");

    if (apply) apply.addEventListener("click", applyPreview);
    if (reset) reset.addEventListener("click", function () {
      state = {
        theme: clone(window.SITE_THEME_DEFAULTS || {}),
        texts: clone(defaultText)
      };
      localStorage.removeItem(storageKey);
      fillInputs();
      applyPreview();
      saveState();
    });
    if (downloadTheme) downloadTheme.addEventListener("click", function () {
      download("siteTheme.js", themeFileContent(), "application/javascript");
    });
    if (downloadJson) downloadJson.addEventListener("click", function () {
      download("custom-export.json", JSON.stringify({ theme: state.theme, texts: state.texts }, null, 2), "application/json");
    });
    if (copy) copy.addEventListener("click", function () {
      var content = JSON.stringify({ theme: state.theme, texts: state.texts }, null, 2);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(content).then(function () {
          copy.textContent = "Configuration copiée";
          setTimeout(function () { copy.textContent = "Copier la configuration"; }, 1600);
        });
      }
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    fillInputs();
    bindTabs();
    bindInputs();
    bindActions();
    applyPreview();
  });
})();
