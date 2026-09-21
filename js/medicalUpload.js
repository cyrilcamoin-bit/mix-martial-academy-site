(function () {
  "use strict";

  var API_BASE = "https://mma-lerove-api.cyril-camoin.workers.dev";
  var form = document.getElementById("medical-upload-form");
  if (!form) return;

  var firstNameInput = document.getElementById("medical-first-name");
  var lastNameInput = document.getElementById("medical-last-name");
  var birthDateInput = document.getElementById("medical-birth-date");
  var verifyButton = document.getElementById("medical-verify-button");
  var uploadStep = document.getElementById("medical-upload-step");
  var fileInput = document.getElementById("medical-file");
  var uploadButton = document.getElementById("medical-upload-button");
  var resetButton = document.getElementById("medical-reset-button");
  var statusBox = document.getElementById("medical-upload-status");
  var verified = null;

  function setStatus(message, kind) {
    statusBox.hidden = !message;
    statusBox.textContent = message || "";
    statusBox.className = "medical-upload-status" + (kind ? " is-" + kind : "");
  }

  function setVerifyBusy(busy) {
    verifyButton.disabled = busy;
    verifyButton.textContent = busy ? "Vérification..." : "Vérifier mon inscription";
  }

  function setUploadBusy(busy, label) {
    uploadButton.disabled = busy;
    uploadButton.textContent = busy ? (label || "Envoi...") : "Envoyer mon certificat";
  }

  function identityPayload() {
    return {
      firstName: firstNameInput.value.trim(),
      lastName: lastNameInput.value.trim(),
      birthDate: birthDateInput.value
    };
  }

  function resetVerification() {
    verified = null;
    uploadStep.hidden = true;
    fileInput.value = "";
    setStatus("", "");
  }

  [firstNameInput, lastNameInput, birthDateInput].forEach(function (input) {
    input.addEventListener("input", function () {
      if (verified) resetVerification();
    });
  });

  verifyButton.addEventListener("click", async function () {
    var payload = identityPayload();
    if (!payload.firstName || !payload.lastName || !payload.birthDate) {
      setStatus("Renseignez le nom, le prénom et la date de naissance de l’adhérent.", "error");
      return;
    }

    setVerifyBusy(true);
    setStatus("", "");

    try {
      var response = await fetch(API_BASE + "/members/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      var data = await response.json().catch(function () { return {}; });

      if (!response.ok || !data.ok) {
        resetVerification();
        setStatus("Les informations saisies ne correspondent à aucune inscription. Vérifiez les informations de l’adhérent.", "error");
        return;
      }

      verified = {
        memberId: data.memberId,
        firstName: payload.firstName,
        lastName: payload.lastName,
        birthDate: payload.birthDate
      };
      uploadStep.hidden = false;
      setStatus("Adhérent reconnu. Vous pouvez maintenant ajouter le certificat médical.", "success");
      fileInput.focus();
    } catch (error) {
      setStatus("La vérification est momentanément indisponible. Réessayez dans quelques instants.", "error");
    } finally {
      setVerifyBusy(false);
    }
  });

  resetButton.addEventListener("click", function () {
    form.reset();
    resetVerification();
    firstNameInput.focus();
  });

  function loadImage(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error("image_decode_failed"));
      };
      img.src = url;
    });
  }

  function concatBytes(parts) {
    var total = parts.reduce(function (sum, part) { return sum + part.length; }, 0);
    var out = new Uint8Array(total);
    var offset = 0;
    parts.forEach(function (part) {
      out.set(part, offset);
      offset += part.length;
    });
    return out;
  }

  function textBytes(text) {
    return new TextEncoder().encode(text);
  }

  function jpegToPdf(jpegBytes, width, height) {
    var parts = [];
    var offsets = [0];

    function pushText(text) {
      var bytes = textBytes(text);
      parts.push(bytes);
      return bytes.length;
    }

    var offset = 0;
    var header = concatBytes([
      textBytes("%PDF-1.4\n%"),
      new Uint8Array([0xe2, 0xe3, 0xcf, 0xd3]),
      textBytes("\n")
    ]);
    parts.push(header);
    offset += header.length;

    function addObject(number, chunks) {
      offsets[number] = offset;
      var start = textBytes(number + " 0 obj\n");
      parts.push(start);
      offset += start.length;
      chunks.forEach(function (chunk) {
        parts.push(chunk);
        offset += chunk.length;
      });
      var end = textBytes("\nendobj\n");
      parts.push(end);
      offset += end.length;
    }

    addObject(1, [textBytes("<< /Type /Catalog /Pages 2 0 R >>")]);
    addObject(2, [textBytes("<< /Type /Pages /Kids [3 0 R] /Count 1 >>")]);
    addObject(3, [textBytes(
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " + width + " " + height + "] " +
      "/Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>"
    )]);

    offsets[4] = offset;
    var imageStart = textBytes(
      "4 0 obj\n<< /Type /XObject /Subtype /Image /Width " + width +
      " /Height " + height +
      " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length " +
      jpegBytes.length + " >>\nstream\n"
    );
    parts.push(imageStart);
    offset += imageStart.length;
    parts.push(jpegBytes);
    offset += jpegBytes.length;
    var imageEnd = textBytes("\nendstream\nendobj\n");
    parts.push(imageEnd);
    offset += imageEnd.length;

    var content = "q\n" + width + " 0 0 " + height + " 0 0 cm\n/Im0 Do\nQ\n";
    var contentBytes = textBytes(content);
    addObject(5, [
      textBytes("<< /Length " + contentBytes.length + " >>\nstream\n"),
      contentBytes,
      textBytes("endstream")
    ]);

    var xrefOffset = offset;
    pushText("xref\n0 6\n");
    pushText("0000000000 65535 f \n");
    for (var i = 1; i <= 5; i += 1) {
      pushText(String(offsets[i]).padStart(10, "0") + " 00000 n \n");
    }
    pushText("trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n" + xrefOffset + "\n%%EOF");

    return new Blob(parts, { type: "application/pdf" });
  }

  async function imageToPdf(file) {
    var img = await loadImage(file);
    var maxDimension = 2000;
    var scale = Math.min(1, maxDimension / Math.max(img.naturalWidth, img.naturalHeight));
    var width = Math.max(1, Math.round(img.naturalWidth * scale));
    var height = Math.max(1, Math.round(img.naturalHeight * scale));

    var canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    var ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    var jpegBlob = await new Promise(function (resolve, reject) {
      canvas.toBlob(function (blob) {
        if (blob) resolve(blob);
        else reject(new Error("image_conversion_failed"));
      }, "image/jpeg", 0.92);
    });

    return jpegToPdf(new Uint8Array(await jpegBlob.arrayBuffer()), width, height);
  }

  async function toPdf(file) {
    if (!file) throw new Error("missing_file");
    if (file.size > 15 * 1024 * 1024) throw new Error("file_too_large");

    var type = String(file.type || "").toLowerCase();
    var name = String(file.name || "").toLowerCase();

    if (type === "application/pdf" || name.endsWith(".pdf")) {
      return new Blob([await file.arrayBuffer()], { type: "application/pdf" });
    }

    if (type.startsWith("image/")) {
      return imageToPdf(file);
    }

    throw new Error("unsupported_file");
  }

  uploadButton.addEventListener("click", async function () {
    if (!verified) {
      setStatus("Vérifiez d’abord l’inscription de l’adhérent.", "error");
      return;
    }

    var sourceFile = fileInput.files && fileInput.files[0];
    if (!sourceFile) {
      setStatus("Choisissez le certificat médical à envoyer.", "error");
      return;
    }

    setUploadBusy(true, "Conversion en PDF...");
    setStatus("", "");

    try {
      var pdfBlob = await toPdf(sourceFile);
      setUploadBusy(true, "Envoi du certificat...");

      var body = new FormData();
      body.append("firstName", verified.firstName);
      body.append("lastName", verified.lastName);
      body.append("birthDate", verified.birthDate);
      body.append("file", pdfBlob, "certificat.pdf");

      var response = await fetch(API_BASE + "/certificates/upload", {
        method: "POST",
        body: body
      });
      var data = await response.json().catch(function () { return {}; });

      if (!response.ok || !data.ok) {
        if (data.error === "storage_not_configured") {
          throw new Error("storage_not_configured");
        }
        throw new Error(data.error || "upload_failed");
      }

      fileInput.value = "";
      setStatus("Certificat reçu. Le fichier a été converti en PDF et enregistré sous le nom " + data.fileName + ".", "success");
      uploadButton.disabled = true;
      uploadButton.textContent = "Certificat envoyé";
    } catch (error) {
      var message = "Impossible d’envoyer ce fichier. Réessayez avec un PDF, JPG ou PNG lisible.";
      if (error.message === "file_too_large") message = "Le fichier est trop volumineux. Taille maximale : 15 Mo.";
      if (error.message === "storage_not_configured") message = "Le dépôt est en cours d’activation. Réessayez un peu plus tard.";
      setStatus(message, "error");
      setUploadBusy(false);
    }
  });
})();
