(function () {
  var defaultTheme = {
    fonts: {
      body: "Inter, Arial, Helvetica, sans-serif",
      clubName: "\"Dream MMA\", Impact, Haettenschweiler, \"Arial Black\", sans-serif",
      headings: "Inter, Arial, Helvetica, sans-serif"
    },
    fontSizes: {
      nav: "0.95rem",
      heroTitle: "4.8rem",
      heroSubtitle: "1.25rem",
      sectionTitle: "3rem",
      cardTitle: "1.35rem",
      body: "1rem",
      small: "0.875rem",
      chatbot: "1rem"
    },
    colors: {
      background: "#050505",
      backgroundSoft: "#0B0B0D",
      card: "#111114",
      cardSoft: "#1A1A1F",
      text: "#F5F5F5",
      textMuted: "#B8B8B8",
      red: "#C90F13",
      redHover: "#E12621",
      redDark: "#7A090B",
      border: "rgba(255,255,255,0.10)"
    },
    layout: {
      maxWidth: "1180px",
      sectionPaddingDesktop: "64px",
      sectionPaddingMobile: "46px",
      cardRadius: "20px",
      buttonRadius: "999px",
      heroGap: "24px",
      gridGap: "16px"
    },
    logo: {
      headerSize: "54px",
      heroCardSize: "190px"
    },
    effects: {
      cardShadow: "0 22px 70px rgba(0,0,0,0.38)",
      borderOpacity: "0.10",
      backgroundGlow: "0.28"
    },
    chatbot: {
      buttonLabel: "CHAT BOT",
      title: "CHAT BOT Mix Martial Academy",
      welcome: "Bonjour 👋 Comment puis-je vous aider ?",
      fallback: "Je n'ai pas encore cette information. Pour une réponse précise, contactez le club par WhatsApp ou par email.",
      quickActions: {
        hours: "Horaires",
        prices: "Tarifs",
        signup: "Inscription",
        equipment: "Matériel",
        trial: "Cours d'essai",
        contact: "Contact"
      }
    }
  };

  function mergeTheme(base, custom) {
    var output = JSON.parse(JSON.stringify(base));
    Object.keys(custom || {}).forEach(function (section) {
      if (custom[section] && typeof custom[section] === "object" && !Array.isArray(custom[section])) {
        output[section] = output[section] || {};
        Object.keys(custom[section]).forEach(function (key) {
          output[section][key] = custom[section][key];
        });
      } else {
        output[section] = custom[section];
      }
    });
    return output;
  }

  function setVar(root, name, value) {
    if (value !== undefined && value !== null && value !== "") {
      root.style.setProperty(name, value);
    }
  }

  function applySiteTheme(theme) {
    var activeTheme = mergeTheme(defaultTheme, theme || {});
    var root = document.documentElement;

    setVar(root, "--font-body", activeTheme.fonts.body);
    setVar(root, "--font-club-name", activeTheme.fonts.clubName);
    setVar(root, "--font-headings", activeTheme.fonts.headings);

    setVar(root, "--color-bg", activeTheme.colors.background);
    setVar(root, "--color-bg-soft", activeTheme.colors.backgroundSoft);
    setVar(root, "--color-card", activeTheme.colors.card);
    setVar(root, "--color-card-soft", activeTheme.colors.cardSoft);
    setVar(root, "--color-text", activeTheme.colors.text);
    setVar(root, "--color-muted", activeTheme.colors.textMuted);
    setVar(root, "--color-red", activeTheme.colors.red);
    setVar(root, "--color-red-hover", activeTheme.colors.redHover);
    setVar(root, "--color-red-dark", activeTheme.colors.redDark);
    setVar(root, "--color-border", activeTheme.colors.border);

    setVar(root, "--fs-nav", activeTheme.fontSizes.nav);
    setVar(root, "--fs-hero-title", activeTheme.fontSizes.heroTitle);
    setVar(root, "--fs-hero-subtitle", activeTheme.fontSizes.heroSubtitle);
    setVar(root, "--fs-section-title", activeTheme.fontSizes.sectionTitle);
    setVar(root, "--fs-card-title", activeTheme.fontSizes.cardTitle);
    setVar(root, "--fs-body", activeTheme.fontSizes.body);
    setVar(root, "--fs-small", activeTheme.fontSizes.small);
    setVar(root, "--fs-chatbot", activeTheme.fontSizes.chatbot);

    setVar(root, "--max-width", activeTheme.layout.maxWidth);
    setVar(root, "--section-padding-desktop", activeTheme.layout.sectionPaddingDesktop);
    setVar(root, "--section-padding-mobile", activeTheme.layout.sectionPaddingMobile);
    setVar(root, "--card-radius", activeTheme.layout.cardRadius);
    setVar(root, "--button-radius", activeTheme.layout.buttonRadius);
    setVar(root, "--hero-gap", activeTheme.layout.heroGap);
    setVar(root, "--grid-gap", activeTheme.layout.gridGap);
    setVar(root, "--logo-header-size", activeTheme.logo.headerSize);
    setVar(root, "--logo-hero-card-size", activeTheme.logo.heroCardSize);
    setVar(root, "--card-shadow", activeTheme.effects.cardShadow);
    setVar(root, "--border-opacity", activeTheme.effects.borderOpacity);
    setVar(root, "--background-glow", activeTheme.effects.backgroundGlow);

    if (window.CLUB_DATA && window.CLUB_DATA.chatbot) {
      window.CLUB_DATA.chatbot.welcome = activeTheme.chatbot.welcome;
      window.CLUB_DATA.chatbot.name = activeTheme.chatbot.title;
      window.CLUB_DATA.chatbot.fallback = activeTheme.chatbot.fallback;
    }
    document.querySelectorAll(".chatbot-toggle").forEach(function (node) {
      node.textContent = activeTheme.chatbot.buttonLabel;
    });
    document.querySelectorAll(".chatbot-head strong").forEach(function (node) {
      node.textContent = activeTheme.chatbot.title;
    });

    window.SITE_THEME = activeTheme;
    return activeTheme;
  }

  window.SITE_THEME_DEFAULTS = defaultTheme;
  window.SITE_THEME = window.SITE_THEME || defaultTheme;
  window.applySiteTheme = applySiteTheme;
  applySiteTheme(window.SITE_THEME);
})();
