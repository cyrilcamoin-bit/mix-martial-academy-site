(function () {
  var lastIntent = null;
  var quickActions = [
    ["Horaires", "Quels sont les horaires ?"],
    ["Tarifs", "Quels sont les tarifs ?"],
    ["Inscription", "Comment s'inscrire ?"],
    ["Mat\u00e9riel", "Quel mat\u00e9riel faut-il ?"],
    ["Cours d'essai", "Comment faire un cours d'essai ?"],
    ["Contact", "Comment contacter le club ?"]
  ];

  function normalizeText(text) {
    return text.toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w\s+-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function hasAny(text, words) {
    return words.some(function (word) {
      return text.includes(word);
    });
  }

  function isAddressQuestion(text) {
    return hasAny(text, [
      "adresse",
      "lieu",
      "salle jennifer",
      "chemin de la bergerie",
      "c est ou",
      "ou est",
      "ou sont",
      "ou se trouve",
      "ou ont lieu",
      "ou se passent",
      "ou se deroulent",
      "lieu des cours"
    ]);
  }

  function isUnpaidQuestion(text) {
    return hasAny(text, ["impaye", "echeance refusee", "carte refusee", "prelevement refuse", "si je ne paie pas", "paiement non regularise", "non regularise"]) ||
      (text.includes("paiement") && text.includes("refuse")) ||
      (text.includes("echeance") && text.includes("refuse"));
  }

  function extractAge(text) {
    var match = text.match(/\b(\d{1,2})\s*(?:ans?|an)\b/);
    if (!match) return null;
    return Number(match[1]);
  }

  function bySection(data, key) {
    var slot = data.schedule[0].slots.find(function (item) {
      var section = normalizeText(item.section);
      if (key === "children") return section.includes("enfants");
      if (key === "teens") return section.includes("ados");
      return section.includes("adultes");
    });
    var price = data.prices.sections.find(function (item) {
      return slot && item.section === slot.section;
    });
    var equipmentKey = key === "children" ? "enfant" : key === "teens" ? "ado" : "adulte";
    var equipment = data.equipment.sections.find(function (item) {
      return item.key === equipmentKey;
    });
    return { key: key, slot: slot, price: price, equipment: equipment };
  }

  function getSectionByAge(data, age) {
    if (age < 6) return { key: "tooYoung", tooYoung: true };
    if (age <= 11) return bySection(data, "children");
    if (age <= 16) return bySection(data, "teens");
    return bySection(data, "adults");
  }

  function detectSection(data, text, age) {
    if (age !== null) return getSectionByAge(data, age);
    if (hasAny(text, ["enfant", "enfants", "petit", "6-11", "6 11"])) return bySection(data, "children");
    if (hasAny(text, ["ado", "ados", "12-16", "12 16"])) return bySection(data, "teens");
    if (hasAny(text, ["adulte", "adultes", "majeur", "17+", "17 +"])) return bySection(data, "adults");
    return null;
  }

  function detectIntent(text) {
    if (hasAny(text, ["horaires", "tous les horaires", "quels sont les horaires", "planning complet", "horaires enfants ados adultes", "horaires de tout le monde"])) return "fullSchedule";
    if (hasAny(text, ["tous les tarifs", "tarifs enfants ados adultes", "prix enfants ados adultes"])) return "fullPricing";
    if (hasAny(text, ["plusieurs fois", "3 fois", "trois fois", "facilite de paiement", "paiement echelonne", "combien de fois", "reglement en plusieurs fois", "helloasso 3 fois"])) return "payment";
    if (hasAny(text, ["inscription", "inscrire", "helloasso", "lien inscription", "dossier inscription", "documents inscription"])) return "registration";
    if (hasAny(text, ["tarif", "prix", "combien", "cout", "cotisation", "adhesion"])) return "pricing";
    if (hasAny(text, ["licence", "licence federale", "prix licence", "licence comprise", "licence incluse"])) return "license";
    if (hasAny(text, ["essai", "essayer", "venir essayer", "seance d essai", "faut prevenir", "besoin de prevenir", "reserver essai"])) return "trial";
    if (hasAny(text, ["mixte", "fille", "filles", "garcon", "garcons"])) return "mixed";
    if (hasAny(text, ["rdx", "commander materiel", "commande materiel", "commande equipement", "echange materiel", "retour materiel", "remboursement materiel", "changer taille", "modifier commande"])) return "rdx";
    if (hasAny(text, ["gants 16", "16 oz", "gants de boxe", "gants plus petits", "taille gants", "mes gants"])) return "gloves";
    if (hasAny(text, ["materiel", "equipement", "protection", "protege", "coquille", "gants", "casque", "quoi acheter"])) return "equipment";
    if (hasAny(text, ["siren", "siret", "rna", "association", "mentions legales", "ape", "siege social"])) return "legal";
    if (hasAny(text, ["fin de saison", "quand finit la saison", "aperitif", "apero", "dernier cours", "saison 2026", "saison 2027"])) return "season";
    if (hasAny(text, ["remboursement", "rembourse", "rembourser", "arreter", "arret", "blessure", "absence", "demenagement", "changement de situation", "annuler inscription", "si j arrete"])) return "refund";
    if (isUnpaidQuestion(text)) return "unpaid";
    if (hasAny(text, ["horaire", "horraire", "heure", "planning", "quand", "quel jour", "cours quand", "entrainement", "lundi", "mercredi", "venir", "vient"])) return "schedule";
    if (hasAny(text, ["discord", "groupe", "communaute", "infos club", "annonces", "photos", "videos"])) return "discord";
    if (hasAny(text, ["instagram", "facebook", "tiktok", "reseaux", "reseau"])) return "social";
    if (isAddressQuestion(text)) return "address";
    if (hasAny(text, ["contact", "telephone", "whatsapp", "mail", "email", "joindre", "appeler"])) return "contact";
    return "fallback";
  }

  function days(data) {
    return data.schedule.map(function (day, index) {
      return (index === 0 ? "le " : "le ") + day.day.toLowerCase();
    }).join(" et ");
  }

  function licenseAmount(data) {
    return data.prices.license.replace(" hors adh\u00e9sion", "");
  }

  function sectionLabel(section) {
    if (section.key === "adults") return "les Adultes " + section.slot.age;
    return "la section " + section.slot.section + " " + section.slot.age;
  }

  function fullScheduleAnswer(data) {
    return data.schedule.map(function (day) {
      return day.day + " : " + day.slots.map(function (slot) {
        return slot.section + " " + slot.age + " " + slot.time;
      }).join(" ; ");
    }).join(". ");
  }

  function fullPricingAnswer(data) {
    return data.prices.sections.map(function (price) {
      return price.section + " " + price.age + " : " + price.price;
    }).join(". ") + ". Licence : " + data.prices.license + ". " + data.prices.paymentRule;
  }

  function tooYoungAnswer(age) {
    return "Les cours commencent \u00e0 partir de 6 ans. Pour un enfant de " + age + " ans, il n'y a pas de section pr\u00e9vue actuellement. Vous pouvez contacter le club via le bouton WhatsApp du site ou par email pour confirmer.";
  }

  function scheduleAnswer(data, section, age) {
    if (!section) return "Pour vous donner le bon horaire, pouvez-vous pr\u00e9ciser la section : enfant 6 \u00e0 11 ans, ado 12 \u00e0 16 ans ou adulte 17 ans et + ?";
    if (section.tooYoung) return tooYoungAnswer(age);
    var intro = age !== null ? "\u00c0 " + age + " ans, la section concern\u00e9e est " + section.slot.section + " " + section.slot.age + "." : "Pour " + sectionLabel(section) + ".";
    return intro + " Les cours ont lieu " + days(data) + " de " + section.slot.time + ".";
  }

  function pricingAnswer(data, section, age) {
    if (!section) return fullPricingAnswer(data);
    if (section.tooYoung) return tooYoungAnswer(age);
    return "Pour " + sectionLabel(section) + ", le tarif est de " + section.price.price + ". La licence f\u00e9d\u00e9rale de " + licenseAmount(data) + " est \u00e0 ajouter. " + data.prices.paymentRule;
  }

  function ageSummaryAnswer(data, section, age) {
    if (section.tooYoung) return tooYoungAnswer(age);
    var mixed = section.key === "adults" ? "Les cours sont mixtes." : "Les cours sont mixtes, filles et gar\u00e7ons ensemble.";
    return "\u00c0 " + age + " ans, la section concern\u00e9e est " + section.slot.section + " " + section.slot.age + ". " + mixed + " Les entra\u00eenements ont lieu " + days(data) + " de " + section.slot.time + ". Tarif : " + section.price.price + " + licence " + licenseAmount(data) + ".";
  }

  function mixedAnswer(data, section, age) {
    if (section && section.tooYoung) return tooYoungAnswer(age);
    if (section && age !== null) return "Oui, les cours sont mixtes. \u00c0 " + age + " ans, la section concern\u00e9e est " + section.slot.section + " " + section.slot.age + ". Les cours ont lieu " + days(data) + " de " + section.slot.time + ".";
    return data.chatbot.mixedCourses;
  }

  function equipmentAnswer(data, section, age) {
    if (!section) return data.chatbot.materialQuestion;
    if (section.tooYoung) return tooYoungAnswer(age);
    var required = section.equipment.required.map(function (item) {
      return item.charAt(0).toLowerCase() + item.slice(1);
    }).join(", ");
    return "Pour " + sectionLabel(section) + ", le mat\u00e9riel obligatoire est : " + required + "." + (section.equipment.note ? " " + section.equipment.note : "");
  }

  function helloAssoAnswer(data) {
    if (data.signup.helloAssoUrl.indexOf("A_COMPLETER") >= 0) {
      return "Le lien HelloAsso officiel doit encore \u00eatre ajout\u00e9 sur le site. En attendant, vous pouvez contacter le club via le bouton WhatsApp du site ou par email.";
    }
    return "L'inscription d\u00e9finitive se fait via HelloAsso. Le r\u00e8glement est automatiquement r\u00e9parti en 3 paiements sans frais. Le lien officiel HelloAsso est accessible depuis le bouton d'inscription du site.";
  }

  function socialAnswer(data, text) {
    if (text.includes("instagram")) return "Instagram : " + data.contacts.instagram;
    if (text.includes("facebook")) return "Facebook : " + data.contacts.facebook;
    if (text.includes("tiktok")) return "TikTok : " + data.contacts.tiktokUrl;
    if (text.includes("discord")) return discordAnswer(data);
    return "R\u00e9seaux du club : Instagram " + data.contacts.instagram + " ; Facebook " + data.contacts.facebook + " ; TikTok " + data.contacts.tiktokUrl + " ; Discord " + data.contacts.discord + ".";
  }

  function discordAnswer(data) {
    return "Le club dispose d'un Discord officiel pour les adh\u00e9rents. Il sert \u00e0 suivre les annonces, les infos de derni\u00e8re minute, le chat adh\u00e9rents, les photos/vid\u00e9os, les contenus li\u00e9s aux entra\u00eenements et comp\u00e9titions, ainsi que les documents utiles. Lien : " + data.contacts.discord;
  }

  function legalAnswer(data) {
    return data.legal.associationName + " est une association d\u00e9clar\u00e9e. SIREN : " + data.legal.siren + ". SIRET : " + data.legal.siret + ". RNA : " + data.legal.rna + ". APE : " + data.legal.ape + ". Si\u00e8ge social : " + data.legal.legalAddress + ".";
  }

  function generateAnswer(data, intent, section, age, text) {
    if (section && age !== null && !["pricing", "schedule", "equipment", "mixed"].includes(intent)) {
      if (intent === "fallback") return ageSummaryAnswer(data, section, age);
    }

    switch (intent) {
      case "payment":
        return "Oui. " + data.prices.paymentRule;
      case "registration":
        return helloAssoAnswer(data);
      case "pricing":
      case "fullPricing":
        return pricingAnswer(data, section, age);
      case "license":
        return "La licence f\u00e9d\u00e9rale est de " + licenseAmount(data) + " et elle est hors adh\u00e9sion. Elle est donc \u00e0 ajouter au tarif annuel.";
      case "schedule":
        return scheduleAnswer(data, section, age);
      case "fullSchedule":
        return fullScheduleAnswer(data);
      case "mixed":
        return mixedAnswer(data, section, age);
      case "trial":
        return data.trial.text;
      case "equipment":
        return equipmentAnswer(data, section, age);
      case "gloves":
        return "Pour les gants de boxe, seuls les gants 16 oz sont autoris\u00e9s pendant les entra\u00eenements. Les gants plus petits ne sont pas autoris\u00e9s pour des raisons de s\u00e9curit\u00e9.";
      case "rdx":
        return data.equipment.rdx + " Attention : une fois la commande valid\u00e9e, il n'est plus possible de modifier, \u00e9changer ou retourner un article.";
      case "refund":
        return data.signup.nonRefundable;
      case "unpaid":
        return data.signup.unpaidRule;
      case "address":
        return "Les cours ont lieu \u00e0 la " + data.addresses.trainingPlace + ", " + data.addresses.trainingAddress + ".";
      case "contact":
        return "Vous pouvez contacter le club via le bouton WhatsApp du site ou par email \u00e0 " + data.contacts.email + ".";
      case "social":
        return socialAnswer(data, text);
      case "discord":
        return discordAnswer(data);
      case "season":
        return data.season.closingEvent;
      case "legal":
        return legalAnswer(data);
      default:
        return data.chatbot.fallback + " Email : " + data.contacts.email + ".";
    }
  }

  function answerQuestion(raw) {
    var data = window.CLUB_DATA;
    var text = normalizeText(raw);
    var age = extractAge(text);
    var section = detectSection(data, text, age);
    var intent = detectIntent(text);

    if (intent === "fallback" && section && lastIntent && ["schedule", "pricing", "equipment", "mixed"].includes(lastIntent)) {
      intent = lastIntent;
    }

    var answer = generateAnswer(data, intent, section, age, text);
    if (intent !== "fallback") lastIntent = intent;
    return answer;
  }

  function addMessage(container, text, fromUser) {
    var message = document.createElement("div");
    message.className = "message" + (fromUser ? " user" : "");
    message.textContent = text;
    container.appendChild(message);
    container.scrollTop = container.scrollHeight;
  }

  function askQuestion(container, question) {
    addMessage(container, question, true);
    addMessage(container, answerQuestion(question), false);
  }

  function addQuickActions(container) {
    var actions = document.createElement("div");
    actions.className = "quick-actions";
    actions.setAttribute("aria-label", "Questions rapides");
    quickActions.forEach(function (item) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "quick-action";
      button.setAttribute("data-quick-label", item[0]);
      button.textContent = item[0];
      button.addEventListener("click", function () {
        askQuestion(container, item[1]);
      });
      actions.appendChild(button);
    });
    container.appendChild(actions);
  }

  document.addEventListener("DOMContentLoaded", function () {
    var data = window.CLUB_DATA;
    var toggle = document.querySelector(".chatbot-toggle");
    var panel = document.getElementById("chatbot-panel");
    var close = document.querySelector(".chatbot-close");
    var form = document.getElementById("chatbot-form");
    var input = document.getElementById("chatbot-input");
    var messages = document.getElementById("chatbot-messages");
    if (!toggle || !panel || !form || !input || !messages) return;

    function openPanel() {
      panel.hidden = false;
      toggle.setAttribute("aria-expanded", "true");
      if (!messages.dataset.started) {
        addMessage(messages, data.chatbot.welcome, false);
        addQuickActions(messages);
        messages.dataset.started = "true";
      }
      input.focus();
    }

    function closePanel() {
      panel.hidden = true;
      toggle.setAttribute("aria-expanded", "false");
    }

    toggle.addEventListener("click", function () {
      if (panel.hidden) openPanel();
      else closePanel();
    });
    if (close) close.addEventListener("click", closePanel);
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var question = input.value.trim();
      if (!question) return;
      input.value = "";
      askQuestion(messages, question);
    });
  });
})();
