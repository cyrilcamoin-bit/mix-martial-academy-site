(function () {
  var awaitingMaterialSection = false;

  function normalize(text) {
    return text.toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w\s+-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function extractAge(question) {
    var match = question.match(/\b(\d{1,2})\s*(?:ans?|an)?\b/);
    if (!match) return null;
    return Number(match[1]);
  }

  function getSectionByAge(data, age) {
    if (age < 6) return { tooYoung: true };
    var sectionKey = age <= 11 ? "enfant" : age <= 16 ? "ado" : "adulte";
    return {
      tooYoung: false,
      key: sectionKey,
      slot: slotBySection(data, sectionKey),
      price: priceBySection(data, sectionKey),
      equipment: equipmentBySection(data, sectionKey)
    };
  }

  function sectionFromText(q) {
    var age = extractAge(q);
    if (age !== null) return null;

    if (q.includes("enfant") || q.includes("enfants") || q.includes("petit") || q.includes("6-11") || q.includes("6 11")) return "enfant";
    if (q.includes("ado") || q.includes("ados") || q.includes("12-16") || q.includes("12 16")) return "ado";
    if (q.includes("adulte") || q.includes("adultes") || q.includes("majeur") || q.includes("17+") || q.includes("17 +")) return "adulte";
    return null;
  }

  function slotBySection(data, sectionKey) {
    return data.schedule[0].slots.find(function (slot) {
      return normalize(slot.section).startsWith(sectionKey === "ado" ? "ado" : sectionKey);
    });
  }

  function equipmentBySection(data, sectionKey) {
    return data.equipment.sections.find(function (item) {
      return item.key === sectionKey;
    });
  }

  function priceBySection(data, sectionKey) {
    var slot = slotBySection(data, sectionKey);
    if (!slot) return null;
    return data.prices.sections.find(function (price) {
      return price.section === slot.section;
    });
  }

  function dayText(data) {
    var days = data.schedule.map(function (day) {
      return day.day.toLowerCase();
    });
    return days.map(function (day, index) {
      return index === 0 ? day : "le " + day;
    }).join(" et ");
  }

  function contextText(q, age, sectionKey) {
    if (age !== null) {
      if (sectionKey === "enfant" && (q.includes("fils") || q.includes("fil") || q.includes("garcon"))) return "un enfant de " + age + " ans";
      if (sectionKey === "enfant" && q.includes("fille")) return "un enfant de " + age + " ans";
      if (sectionKey === "ado" && q.includes("ado")) return "un ado de " + age + " ans";
      if (sectionKey === "adulte") return age + " ans";
      return age + " ans";
    }
    if (sectionKey === "enfant") return "les enfants 6 \u00e0 11 ans";
    if (sectionKey === "ado") return "les ados 12 \u00e0 16 ans";
    return "les adultes 17 ans et +";
  }

  function scheduleAnswer(data, q, sectionKey) {
    var age = extractAge(q);
    var slot = slotBySection(data, sectionKey);
    if (!slot) return fullScheduleAnswer(data);
    if (age !== null && sectionKey === "adulte") {
      return "\u00c0 " + age + " ans, la section concern\u00e9e est " + slot.section + " " + slot.age + ". Les cours ont lieu le " + dayText(data) + " de " + slot.time + ".";
    }
    return "Pour " + contextText(q, age, sectionKey) + ", la section concern\u00e9e est " + slot.section + " " + slot.age + ". Les cours ont lieu le " + dayText(data) + " de " + slot.time + ".";
  }

  function tooYoungAnswer(data, age) {
    return "Les cours commencent \u00e0 partir de 6 ans. Pour un enfant de " + age + " ans, il n'y a pas de section pr\u00e9vue actuellement. Vous pouvez contacter le club par WhatsApp pour confirmer.";
  }

  function mixedTextForSection(sectionKey) {
    return sectionKey === "adulte" ? "Les cours sont mixtes." : "Les cours sont mixtes, filles et gar\u00e7ons ensemble.";
  }

  function ageScheduleAnswer(data, age, info) {
    return "\u00c0 " + age + " ans, la section concern\u00e9e est " + info.slot.section + " " + info.slot.age + ". Les entra\u00eenements ont lieu le " + dayText(data) + " de " + info.slot.time + ".";
  }

  function agePriceAnswer(data, age, info) {
    return "\u00c0 " + age + " ans, la section concern\u00e9e est " + info.slot.section + " " + info.slot.age + ". Tarif : " + info.price.price + " + licence " + data.prices.license.replace(" hors adh\u00e9sion", "") + ". " + data.prices.paymentRule;
  }

  function ageSummaryAnswer(data, age, info) {
    return "\u00c0 " + age + " ans, la section concern\u00e9e est " + info.slot.section + " " + info.slot.age + ". " + mixedTextForSection(info.key) + " Les entra\u00eenements ont lieu le " + dayText(data) + " de " + info.slot.time + ". Tarif : " + info.price.price + " + licence " + data.prices.license.replace(" hors adh\u00e9sion", "") + ".";
  }

  function priceAnswer(data, q, sectionKey) {
    var age = extractAge(q);
    var price = priceBySection(data, sectionKey);
    if (!price) return fullPriceAnswer(data);
    var label = age === null ? contextText(q, age, sectionKey) : contextText(q, age, sectionKey);
    return "Pour " + label + ", le tarif est de " + price.price + ". La licence f\u00e9d\u00e9rale de " + data.prices.license.replace(" hors adh\u00e9sion", "") + " est \u00e0 ajouter. " + data.prices.paymentRule;
  }

  function lowerFirst(text) {
    return text.charAt(0).toLowerCase() + text.slice(1);
  }

  function materialAnswer(sectionKey, q) {
    var data = window.CLUB_DATA;
    var age = extractAge(q || "");
    var match = equipmentBySection(data, sectionKey);
    if (!match) return data.chatbot.materialQuestion;
    awaitingMaterialSection = false;
    var intro = age === null ? "Pour " + contextText(q || "", age, sectionKey) : "Pour " + contextText(q || "", age, sectionKey);
    var required = match.required.map(lowerFirst).join(", ");
    return intro + ", le mat\u00e9riel obligatoire est : " + required + "." + (match.note ? " " + match.note : "");
  }

  function ageMaterialAnswer(data, age, info) {
    var required = info.equipment.required.map(lowerFirst).join(", ");
    return "\u00c0 " + age + " ans, la section concern\u00e9e est " + info.slot.section + " " + info.slot.age + ". Le mat\u00e9riel obligatoire est : " + required + "." + (info.equipment.note ? " " + info.equipment.note : "");
  }

  function fullScheduleAnswer(data) {
    return data.schedule.map(function (day) {
      return day.day + " : " + day.slots.map(function (slot) {
        return slot.section + " " + slot.age + " " + slot.time;
      }).join(" ; ");
    }).join(". ");
  }

  function fullPriceAnswer(data) {
    return data.prices.sections.map(function (price) {
      return price.section + " " + price.age + " : " + price.price;
    }).join(". ") + ". Licence : " + data.prices.license + ". " + data.prices.paymentRule;
  }

  function isMaterialQuestion(q) {
    return q.includes("materiel") || q.includes("equipement") || q.includes("protection") || q.includes("gant");
  }

  function isPriceQuestion(q) {
    return q.includes("tarif") || q.includes("prix") || q.includes("cout") || q.includes("combien");
  }

  function isScheduleQuestion(q) {
    return q.includes("horaire") || q.includes("horraire") || q.includes("heure") || q.includes("planning") ||
      q.includes("cours") || q.includes("cour") || q.includes("venir") || q.includes("vient") ||
      q.includes("seance") || q.includes("entrainement") || q.includes("lundi") || q.includes("mercredi") ||
      q.includes("quand");
  }

  function asksFullSchedule(q) {
    return q.includes("tous les horaires") || q.includes("planning complet") ||
      q.includes("horaires de tout le monde") || q.includes("horaires enfants ados adultes");
  }

  function isMixedCourseQuestion(q) {
    return q.includes("mixte") || q.includes("fille") || q.includes("filles") ||
      q.includes("garcon") || q.includes("garcons");
  }

  function mixedCourseAnswer() {
    return window.CLUB_DATA.chatbot.mixedCourses;
  }

  function getAnswer(raw) {
    var data = window.CLUB_DATA;
    var q = normalize(raw);
    var age = extractAge(q);
    var ageInfo = age === null ? null : getSectionByAge(data, age);
    var sectionKey = sectionFromText(q);

    if (ageInfo) {
      awaitingMaterialSection = false;
      if (ageInfo.tooYoung) return tooYoungAnswer(data, age);
      if (isMaterialQuestion(q)) return ageMaterialAnswer(data, age, ageInfo);
      if (isPriceQuestion(q)) return agePriceAnswer(data, age, ageInfo);
      if (isScheduleQuestion(q)) return ageScheduleAnswer(data, age, ageInfo);
      return ageSummaryAnswer(data, age, ageInfo);
    }

    if (awaitingMaterialSection) {
      if (sectionKey) return materialAnswer(sectionKey, q);
      if (isMaterialQuestion(q)) return data.chatbot.materialQuestion;
      awaitingMaterialSection = false;
    }

    if (asksFullSchedule(q)) return fullScheduleAnswer(data);
    if (isMaterialQuestion(q) && sectionKey) return materialAnswer(sectionKey, q);
    if (isMaterialQuestion(q)) {
      awaitingMaterialSection = true;
      return data.chatbot.materialQuestion;
    }
    if (isPriceQuestion(q) && sectionKey) return priceAnswer(data, q, sectionKey);
    if (isScheduleQuestion(q) && sectionKey) return scheduleAnswer(data, q, sectionKey);
    if (isMixedCourseQuestion(q)) return mixedCourseAnswer();
    if (isPriceQuestion(q)) return fullPriceAnswer(data);
    if (isScheduleQuestion(q)) return "Pour vous donner le bon horaire, pouvez-vous pr\u00e9ciser la section : enfant 6 \u00e0 11 ans, ado 12 \u00e0 16 ans ou adulte 17 ans et + ?";
    if (q.includes("licence")) return "La licence est de " + data.prices.license + ".";
    if (q.includes("age") || q.includes("section")) return "Sections : enfants 6 \u00e0 11 ans, ados 12 \u00e0 16 ans, adultes 17 ans et +.";
    if (q.includes("essai") || q.includes("tester") || q.includes("decouvrir")) return data.trial.text;
    if (q.includes("inscription") || q.includes("helloasso") || q.includes("paiement")) return data.signup.intro + " " + data.prices.paymentRule;
    if (q.includes("rembours")) return data.signup.nonRefundable;
    if (q.includes("impaye") || q.includes("echeance") || q.includes("refuse")) return data.signup.unpaidRule;
    if (q.includes("discord")) return data.discord.text + " " + data.discord.role + " Lien : " + data.contacts.discord;
    if (q.includes("adresse") || q.includes("lieu") || q.includes("salle")) return "Lieu des cours : " + data.addresses.trainingPlace + ", " + data.addresses.trainingAddress + ".";
    if (q.includes("whatsapp") || q.includes("telephone") || q.includes("tel")) return "WhatsApp : " + data.contacts.whatsappDisplay + " - " + data.contacts.whatsappUrl;
    if (q.includes("email") || q.includes("mail")) return "Email : " + data.contacts.email;
    if (q.includes("instagram")) return "Instagram : " + data.contacts.instagram;
    if (q.includes("facebook")) return "Facebook : " + data.contacts.facebook;
    if (q.includes("tiktok")) return "TikTok : " + data.contacts.tiktokUrl;
    if (q.includes("saison") || q.includes("fin")) return data.season.closingEvent;
    return data.chatbot.fallback + " WhatsApp : " + data.contacts.whatsappDisplay + " / Email : " + data.contacts.email;
  }

  function addMessage(container, text, fromUser) {
    var message = document.createElement("div");
    message.className = "message" + (fromUser ? " user" : "");
    message.textContent = text;
    container.appendChild(message);
    container.scrollTop = container.scrollHeight;
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
      addMessage(messages, question, true);
      input.value = "";
      addMessage(messages, getAnswer(question), false);
    });
  });
})();
