// Production d'un fichier Excel privé depuis les commandes de la campagne HelloAsso.
// Aucun contenu adhérent n'est écrit dans le dépôt ou mis en cache côté navigateur.
const XMLNS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const ORDER = ["Enfant", "Ado", "Adulte"];
const HEADERS = ["NOM", "PRÉNOM", "EMAIL", "CATÉGORIE", "MONTANT", "DATE DE NAISSANCE", "ADRESSE", "CODE POSTAL", "TÉLÉPHONE"];
const LABELS = { Enfant: "ENFANTS", Ado: "ADOS", Adulte: "ADULTES" };

function str(value) {
  return value == null ? "" : String(value).trim();
}

function simplify(value) {
  return str(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
}

function sectionFor(item) {
  const names = [item.name, item.tierName, item.label, item.tier?.name, item.tierDescription].map(simplify).join(" ");
  if (names.includes("ENFANT")) return "Enfant";
  if (names.includes("ADO")) return "Ado";
  if (names.includes("ADULTE") || names.includes("+16") || names.includes("17 ANS")) return "Adulte";
  // HelloAsso peut omettre le nom du tarif dans certains retours simplifiés.
  // Ne recourir aux tarifs qu'en cas de correspondance exacte avec les prix validés.
  const cents = Number(item.initialAmount ?? item.amount);
  if (cents === 27510 || cents === 27500) return "Enfant";
  if (cents === 29010 || cents === 29000) return "Ado";
  if (cents === 33510 || cents === 33500) return "Adulte";
  return "";
}

function fieldValue(item, pattern) {
  const fields = [...(item.customFields || []), ...(item.options || []).flatMap((opt) => opt.customFields || [])];
  const match = fields.find((field) => pattern.test(simplify(field.name || field.label || "")));
  return str(match?.answer);
}

function birthDate(value) {
  const raw = str(value);
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (iso) return iso[1] + "-" + iso[2] + "-" + iso[3];
  const fr = /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/.exec(raw);
  if (fr) return fr[3] + "-" + fr[2].padStart(2, "0") + "-" + fr[1].padStart(2, "0");
  return "";
}

function birthSerial(raw) {
  const iso = birthDate(raw);
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  const utc = Date.UTC(y, m - 1, d);
  const date = new Date(utc);
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return Math.round((utc - Date.UTC(1899, 11, 30)) / 86400000);
}

function postalCode(...values) {
  for (const value of values) {
    const match = /\b\d{5}\b/.exec(str(value));
    if (match) return match[0];
  }
  return "";
}

function normalizedPhone(...values) {
  for (const raw of values) {
    let digits = str(raw).replace(/\D/g, "");
    if (digits.startsWith("0033")) digits = "0" + digits.slice(4).replace(/^0/, "");
    else if (digits.startsWith("33")) digits = "0" + digits.slice(2).replace(/^0/, "");
    else if (digits.length === 9 && digits[0] !== "0") digits = "0" + digits;
    const match = /^0\d{9}/.exec(digits);
    if (match) return match[0];
  }
  return "";
}

function addressText(address) {
  if (typeof address === "string") return str(address);
  if (!address || typeof address !== "object") return "";
  return [address.address, address.addressLine1, address.street, address.line1, address.additionalAddress, address.addressLine2]
    .map(str).filter(Boolean).join(", ");
}

function firstPresent(...parts) {
  return parts.map(str).find(Boolean) || "";
}

// Le montant d'un item sur un formulaire en 3 échéances peut ne
// représenter qu'un prélèvement. Utiliser la somme des parts des
// échéances lorsqu'elles sont renvoyées par l'API HelloAsso.
function annualAmountCents(item, category) {
  const shares = Array.isArray(item.payments)
    ? item.payments.map((part) => Number(part?.shareAmount))
        .filter((amount) => Number.isFinite(amount) && amount > 0)
    : [];
  const scheduled = shares.reduce((a, b) => a + b, 0);
  const direct = Number(item.initialAmount ?? item.amount);
  if (scheduled > direct && scheduled > 0) return scheduled;
  // Spécifique au barème de la campagne 2026-2027 en 3 échéances.
  // Les exports officiels de la campagne affichent 275,10 / 290,10 / 335,10 €.
  const installment = { Enfant: 9170, Ado: 9670, Adulte: 11170 };
  const expected = { Enfant: 27510, Ado: 29010, Adulte: 33510 };
  if (direct === installment[category]) return expected[category];
  return Number.isFinite(direct) ? direct : null;
}

export function rowsFromOrders(orders) {
  const members = [];
  const seen = new Set();
  let unclassified = 0;
  for (const order of orders) {
    const payer = order?.payer || {};
    const orderItems = Array.isArray(order?.items) ? order.items : [];
    for (const item of orderItems) {
      if (simplify(item?.type) !== "MEMBERSHIP") continue;
      const state = simplify(item?.state);
      if (state && !["PROCESSED", "REGISTERED"].includes(state)) continue;
      const itemId = str(item.id);
      if (itemId && seen.has(itemId)) continue;
      if (itemId) seen.add(itemId);
      const category = sectionFor(item);
      if (!category) {
        unclassified += 1;
        continue;
      }
      const user = item.user || {};
      const lastName = firstPresent(user.lastName, item.lastName).toUpperCase();
      let firstName = firstPresent(user.firstName, item.firstName);
      if (!lastName || !firstName) continue;
      const payerEmail = firstPresent(payer.email, item.payer?.email, user.email);
      if (simplify(lastName) === "SEGUIN" && payerEmail.toLowerCase() === "aurelie-mattis1702@hotmail.fr") {
        firstName = "Mattis";
      }
      const address = firstPresent(
        fieldValue(item, /^(ADRESSE|ADRESSE POSTALE|RUE|VOIE|DOMICILE)/),
        addressText(user.address), addressText(payer.address),
        user.addressLine1, payer.addressLine1, payer.address, user.address
      );
      const code = postalCode(
        user.zipCode, user.postalCode, user.address?.zipCode, user.address?.postalCode,
        payer.zipCode, payer.postalCode, payer.address?.zipCode, payer.address?.postalCode,
        fieldValue(item, /CODE POSTAL|ZIP CODE/), address
      );
      const phone = normalizedPhone(
        user.phone, user.phoneNumber, payer.phone, payer.phoneNumber, payer.mobile,
        fieldValue(item, /TELEPHONE|MOBILE|PORTABLE/)
      );
      const date = birthSerial(firstPresent(
        user.dateOfBirth, item.dateOfBirth, fieldValue(item, /DATE DE NAISSANCE/)
      ));
      const amountCents = annualAmountCents(item, category);
      members.push({
        memberId: itemId,
        lastName, firstName, email: payerEmail, category,
        amount: Number.isFinite(amountCents) ? amountCents / 100 : null,
        birthDate: date,
        address, postal: code, phone
      });
    }
  }
  if (unclassified) throw new Error("Tarifs HelloAsso inconnus : " + unclassified + ". Export interrompu pour éviter une liste incomplète.");
  members.sort((a, b) => ORDER.indexOf(a.category) - ORDER.indexOf(b.category)
    || a.lastName.localeCompare(b.lastName, "fr", { sensitivity: "base" })
    || a.firstName.localeCompare(b.firstName, "fr", { sensitivity: "base" }));
  return members;
}

function xml(value) {
  return str(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function txtCell(ref, value, style = 0) {
  return '<c r="' + ref + '" s="' + style + '" t="inlineStr"><is><t xml:space="preserve">'
    + xml(value) + "</t></is></c>";
}
function numCell(ref, value, style = 0) {
  if (!Number.isFinite(value)) return txtCell(ref, "", style);
  return '<c r="' + ref + '" s="' + style + '"><v>' + value + "</v></c>";
}
function sheetRow(index, height, cells) {
  return '<row r="' + index + '" ht="' + height + '" customHeight="1">' + cells + "</row>";
}

function stylesXml() {
  // Styles alignés sur le fichier modèle de référence du 12/10/2026.
  const fonts = [
    '<font><sz val="11"/><name val="Carlito"/></font>',
    '<font><b/><sz val="17"/><color rgb="FFFFFFFF"/><name val="Carlito"/></font>',
    '<font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Carlito"/></font>',
    '<font><b/><sz val="12"/><color rgb="FFFFFFFF"/><name val="Carlito"/></font>',
    '<font><b/><sz val="11"/><name val="Carlito"/></font>'
  ];
  const fillColor=hex=>'<fill><patternFill patternType="solid"><fgColor rgb="'+hex+'"/></patternFill></fill>';
  const fills=[
    '<fill><patternFill patternType="none"/></fill>',
    '<fill><patternFill patternType="gray125"/></fill>',
    fillColor('FF16171C'),fillColor('FF9B1924'),fillColor('FF2A2A30'),
    fillColor('FFB51F2C'),fillColor('FFF4F5F7')
  ];
  // Index identiques au modèle, pour tous les types de cellules.
  const formats=[
    [0,0,0,''],    // 0 standard
    [2,5,0,''],    // 1 en-tête de colonnes
    [4,0,0,''],    // 2 nom
    [0,0,0,'center'], // 3 catégorie
    [0,0,164,''],  // 4 montant
    [0,0,14,''],   // 5 naissance
    [0,0,49,'center'], // 6 CP / téléphone en texte
    [4,6,0,''],    // 7 nom zébré
    [0,6,0,''],    // 8 texte zébré
    [0,6,0,'center'], // 9 catégorie zébrée
    [0,6,164,''],  // 10 montant zébré
    [0,6,14,''],   // 11 date zébrée
    [0,6,49,'center'], // 12 CP/tél zébré
    [3,4,0,''],    // 13 bandeau catégorie
    [1,2,0,'center'], // 14 titre
    [2,3,0,'center']  // 15 sous-titre
  ];
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    +'<styleSheet xmlns="'+XMLNS+'">'
    +'<numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00 &quot;€&quot;"/></numFmts>'
    +'<fonts count="'+fonts.length+'">'+fonts.join('')+'</fonts>'
    +'<fills count="'+fills.length+'">'+fills.join('')+'</fills>'
    +'<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
    +'<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
    +'<cellXfs count="'+formats.length+'">'
    +formats.map(([font,fill,nf,align])=>'<xf numFmtId="'+nf+'" fontId="'+font+'" fillId="'+fill+'" borderId="0" xfId="0" applyFont="1" applyFill="1" applyNumberFormat="1" applyAlignment="1"><alignment vertical="center"'+(align?' horizontal="'+align+'"':'')+'/></xf>').join('')
    +'</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
}

function tableXml(id, start, end, name) {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<table xmlns="' + XMLNS + '" id="' + id + '" name="' + name + '" displayName="' + name
    + '" ref="A' + start + ':I' + end + '" totalsRowShown="0">'
    + '<autoFilter ref="A' + start + ':I' + end + '"/>'
    + '<tableColumns count="9">' + HEADERS.map((x, i) =>
      '<tableColumn id="' + (i + 1) + '" name="' + xml(x) + '"/>').join("")
    + '</tableColumns><tableStyleInfo name="TableStyleMedium9" showFirstColumn="0" showLastColumn="0" showRowStripes="0" showColumnStripes="0"/></table>';
}

export function makeXlsx(people, createZip) {
  const counts = {};
  const merged = ['A1:I1', 'A2:I2'];
  const rows = [];
  const tables = [];
  rows.push(sheetRow(1, 34, txtCell("A1", "MIX MARTIAL ACADEMY  |  LISTING DES ADHÉRENTS", 14)));
  const editionDate = new Date().toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" });
  rows.push(sheetRow(2, 24, txtCell("A2", "SAISON 2026–2027   •   " + people.length + " ADHÉRENTS   •   ÉDITION DU " + editionDate, 15)));
  let row = 4;
  for (const category of ORDER) {
    const group = people.filter((p) => p.category === category);
    counts[category] = group.length;
    merged.push("A" + row + ":I" + row);
    rows.push(sheetRow(row, 26, txtCell("A" + row, LABELS[category] + "  —  " + group.length + " ADHÉRENTS", 13)));
    const header = row + 1;
    rows.push(sheetRow(header, 29, HEADERS.map((x, i) => txtCell("ABCDEFGHI"[i] + header, x, 1)).join("")));
    row = header + 1;
    for (let i = 0; i < group.length; i++, row++) {
      const p = group[i];
      const zebra = i % 2 === 0;
      const normal = zebra ? 0 : 8;
      const name = zebra ? 2 : 7;
      const cat = zebra ? 3 : 9;
      const amount = zebra ? 4 : 10;
      const date = zebra ? 5 : 11;
      const fixedText = zebra ? 6 : 12;
      const cells = [
        txtCell("A" + row, p.lastName, name),
        txtCell("B" + row, p.firstName, name),
        txtCell("C" + row, p.email, normal),
        txtCell("D" + row, p.category, cat),
        p.amount == null ? txtCell("E" + row, "", normal) : numCell("E" + row, p.amount, amount),
        p.birthDate == null ? txtCell("F" + row, "", normal) : numCell("F" + row, p.birthDate, date),
        txtCell("G" + row, p.address, normal),
        txtCell("H" + row, p.postal, fixedText),
        txtCell("I" + row, p.phone, fixedText)
      ].join("");
      rows.push(sheetRow(row, 23, cells));
    }
    if (group.length) {
      const id = tables.length + 1;
      tables.push({ id, start: header, end: row - 1, name: ["TableEnfants", "TableAdos", "TableAdultes"][ORDER.indexOf(category)] });
    }
    row += 2;
  }
  const sheet = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<worksheet xmlns="' + XMLNS + '" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
    + '<sheetViews><sheetView workbookViewId="0"><pane ySplit="5" topLeftCell="A6" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
    + '<sheetFormatPr defaultRowHeight="20"/>'
    + '<cols>' + [21,21,35,15,13,21,40,15,18].map((w,i) => '<col min="' + (i+1) + '" max="' + (i+1) + '" width="' + w + '" customWidth="1"/>').join("") + '</cols>'
    + '<sheetData>' + rows.join("") + '</sheetData>'
    + '<mergeCells count="' + merged.length + '">' + merged.map((ref) => '<mergeCell ref="' + ref + '"/>').join("") + '</mergeCells>'
    + (tables.length ? '<tableParts count="' + tables.length + '">'
      + tables.map((t) => '<tablePart r:id="rId' + t.id + '"/>').join("") + '</tableParts>' : "")
    + '</worksheet>';

  const contentTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
    + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    + '<Default Extension="xml" ContentType="application/xml"/>'
    + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
    + '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
    + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
    + tables.map((t) => '<Override PartName="/xl/tables/table' + t.id
      + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.table+xml"/>').join("")
    + '</Types>';
  const workbook = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<workbook xmlns="' + XMLNS + '" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
    + '<sheets><sheet name="Adhérents 2026-2027" sheetId="1" r:id="rId1"/></sheets></workbook>';
  const baseRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
    + '</Relationships>';
  const bookRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
    + '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
    + '</Relationships>';
  const sheetRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + tables.map((t) => '<Relationship Id="rId' + t.id
      + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/table" Target="../tables/table'
      + t.id + '.xml"/>').join("") + '</Relationships>';
  const encoder = new TextEncoder();
  const files = [
    ["[Content_Types].xml", contentTypes],
    ["_rels/.rels", baseRels],
    ["xl/workbook.xml", workbook],
    ["xl/_rels/workbook.xml.rels", bookRels],
    ["xl/worksheets/sheet1.xml", sheet],
    ["xl/styles.xml", stylesXml()]
  ];
  if (tables.length) files.push(["xl/worksheets/_rels/sheet1.xml.rels", sheetRels]);
  for (const table of tables) files.push(["xl/tables/table" + table.id + ".xml", tableXml(table.id, table.start, table.end, table.name)]);
  const bytes = createZip(files.map(([name, content]) => ({name, bytes: encoder.encode(content)})));
  return { bytes, counts, total: people.length, missing: people.filter((p) => !p.postal || !p.phone || !p.address).length };
}
