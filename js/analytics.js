(function () {
  var knownSections = ["accueil", "cours", "tarifs", "materiel", "contact"];
  var recentEvents = Object.create(null);

  function canTrack() {
    return typeof window.gtag === "function";
  }

  function normalizeSection(value) {
    if (!value) return "";
    var section = String(value).replace(/^#/, "").trim();
    return knownSections.indexOf(section) !== -1 ? section : "";
  }

  function currentSection() {
    var hashSection = normalizeSection(window.location.hash);
    if (hashSection) return hashSection;
    var active = document.querySelector(".view-panel.is-active");
    return normalizeSection(active && active.id) || "accueil";
  }

  function elementSection(element) {
    var panel = element && element.closest && element.closest(".view-panel[id]");
    return normalizeSection(panel && panel.id) || currentSection();
  }

  function cleanText(text) {
    return (text || "").replace(/\s+/g, " ").trim().slice(0, 120);
  }

  function eventNameForUrl(url) {
    if (!url) return "";
    var normalized = url.toLowerCase();
    if (normalized.indexOf("tel:") === 0) return "click_phone";
    if (normalized.indexOf("mailto:") === 0) return "click_email";
    if (normalized.indexOf("wa.me") !== -1 || normalized.indexOf("whatsapp.com") !== -1 || normalized.indexOf("api.whatsapp.com") !== -1) return "click_whatsapp";
    if (normalized.indexOf("helloasso.com") !== -1) return "click_helloasso";
    if (normalized.indexOf("instagram.com") !== -1) return "click_instagram";
    if (normalized.indexOf("facebook.com") !== -1) return "click_facebook";
    if (normalized.indexOf("tiktok.com") !== -1) return "click_tiktok";
    if (normalized.indexOf("discord.gg") !== -1 || normalized.indexOf("discord.com") !== -1) return "click_discord";
    return "";
  }

  function sendEvent(eventName, params) {
    if (!eventName || !canTrack()) return;

    var payload = {
      link_url: params.link_url || "",
      link_text: params.link_text || "",
      page_location: window.location.href,
      section: params.section || currentSection()
    };
    var key = eventName + "|" + payload.link_url + "|" + payload.section;
    var now = Date.now();

    if (recentEvents[key] && now - recentEvents[key] < 800) return;
    recentEvents[key] = now;

    window.gtag("event", eventName, payload);
  }

  function trackClick(target) {
    if (!target || !target.closest) return;

    var link = target.closest("a[href]");
    if (link) {
      var linkUrl = link.href || link.getAttribute("href") || "";
      var eventName = eventNameForUrl(linkUrl);
      if (!eventName) return;

      sendEvent(eventName, {
        link_url: linkUrl,
        link_text: cleanText(link.innerText || link.getAttribute("aria-label") || link.title || linkUrl),
        section: elementSection(link)
      });
      return;
    }

    var iframe = target.closest("iframe[src]");
    if (iframe) {
      var iframeUrl = iframe.src || iframe.getAttribute("src") || "";
      var iframeEventName = eventNameForUrl(iframeUrl);
      if (!iframeEventName) return;

      sendEvent(iframeEventName, {
        link_url: iframeUrl,
        link_text: cleanText(iframe.title || iframe.getAttribute("aria-label") || "iframe"),
        section: elementSection(iframe)
      });
    }
  }

  function trackNavigation() {
    var section = normalizeSection(window.location.hash);
    if (!section) return;

    sendEvent("navigation_view", {
      link_url: window.location.href,
      link_text: section,
      section: section
    });
  }

  document.addEventListener("click", function (event) {
    trackClick(event.target);
  }, true);

  document.addEventListener("pointerdown", function (event) {
    if (event.target && event.target.closest && event.target.closest("iframe[src]")) {
      trackClick(event.target);
    }
  }, true);

  window.addEventListener("hashchange", trackNavigation);
})();
