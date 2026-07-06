(function () {
  var awaitingMaterialSection = false;

  function normalize(text) {
    return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  function materialAnswer(section) {
    var data = window.CLUB_DATA;
    var match = data.equipment.sections.find(function (item) {
      return item.key === section;
    });
    if (!match) return data.chatbot.materialQuestion;
    awaitingMaterialSection = false;
    return "Mat\u00e9riel " + match.section + " (" + match.age + ") : obligatoire : " + match.required.join(", ") + ". Optionnel : " + match.optional.join(", ") + "." + (match.note ? " " + match.note : "");
  }

  function getAnswer(raw) {
    var data = window.CLUB_DATA;
    var q = normalize(raw);

    if (awaitingMaterialSection) {
      if (q.includes("enfant") || q.includes("6") || q.includes("11")) return materialAnswer("enfant");
      if (q.includes("ado") || q.includes("12") || q.includes("16")) return materialAnswer("ado");
      if (q.includes("adulte") || q.includes("17")) return materialAnswer("adulte");
      return data.chatbot.materialQuestion;
    }

    if (q.includes("materiel") || q.includes("equipement") || q.includes("protection") || q.includes("gant")) {
      awaitingMaterialSection = true;
      return data.chatbot.materialQuestion;
    }
    if (q.includes("horaire") || q.includes("heure") || q.includes("jour") || q.includes("lundi") || q.includes("mercredi")) {
      return data.schedule.map(function (day) {
        return day.day + " : " + day.slots.map(function (slot) {
          return slot.section + " " + slot.age + " " + slot.time;
        }).join(" ; ");
      }).join(". ");
    }
    if (q.includes("tarif") || q.includes("prix") || q.includes("cout") || q.includes("combien")) {
      return data.prices.sections.map(function (price) {
        return price.section + " " + price.age + " : " + price.price;
      }).join(". ") + ". Licence : " + data.prices.license + ". " + data.prices.paymentRule;
    }
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
