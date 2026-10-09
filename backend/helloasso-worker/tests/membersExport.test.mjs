import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { rowsFromOrders, makeXlsx } from "../src/membersExport.js";

const item = (id, name, firstName, lastName, amount, extra = {}) => ({
  id, name, type: "Membership", state: "Processed", amount,
  user: { firstName, lastName, dateOfBirth: "2013-09-23" }, ...extra
});
const orders = [{
  id: 2, payer: { email: "parent@example.test", address: { address: "4 rue du Test", zipCode: "13180", city: "Gignac-la-Nerthe" }, phone: "+33 6 12 34 56 78" },
  items: [
    item(3, "ADO MMA 12 - 16 ans", "Clara", "Zola", 29010),
    item(2, "ENFANT MMA 6 - 11 ans", "Zoé", "Alfa", 27510),
    item(1, "(+16 ANS) ADULTE MMA", "Paul", "Bernard", 33510)
  ]
}, {
  id: 3, payer: {email: "aurelie-mattis1702@hotmail.fr"},
  items: [item(4, "ADO MMA 12 - 16 ans", "Aurélie", "Seguin", 29010, {
    customFields: [{name: "Code postal", answer:"13740 Le Rove"}, {name:"Téléphone",answer:"0628427242"}]
  })]
}];

test("sorts three groups, normalizes zip, dates, phone and Mattis", () => {
  const list = rowsFromOrders(orders);
  assert.equal(list.length, 4);
  assert.deepEqual(list.map((r) => r.category), ["Enfant", "Ado", "Ado", "Adulte"]);
  assert.equal(list[0].lastName, "ALFA");
  assert.equal(list[1].firstName, "Mattis");
  assert.equal(list[1].postal, "13740");
  assert.equal(list[2].phone, "0612345678");
  assert.equal(list[2].amount, 290.1);
  assert.ok(list[2].birthDate > 40000);
});

test("rejects incomplete category mapping instead of silently missing members", () => {
  assert.throws(() => rowsFromOrders([{ payer: {}, items: [item(900, "TARIF INCONNU", "A", "B", 10000)] }]), /inconnus/);
});

test("deduplicates membership items and excludes cancelled items", () => {
  const list = rowsFromOrders([orders[0], orders[0], {items: [item(8, "ENFANT MMA", "X", "Y", 27510, {state:"Canceled"})]}]);
  assert.equal(list.length, 3);
});

test("creates a formatted XLSX with distinct filterable tables", () => {
  const list = rowsFromOrders(orders);
  let files;
  const book = makeXlsx(list, (entries) => {
    files = entries;
    return new Uint8Array([80, 75, 3, 4]);
  });
  assert.equal(book.total, 4);
  assert.deepEqual(book.counts, {Enfant:1,Ado:2,Adulte:1});
  const asText = (name) => new TextDecoder().decode(files.find((f) => f.name === name).bytes);
  const sheet = asText("xl/worksheets/sheet1.xml");
  assert.ok(sheet.includes("ENFANTS"));
  assert.ok(sheet.includes("ADOS"));
  assert.ok(sheet.includes("ADULTES"));
  assert.ok(sheet.includes("SEGUIN"));
  assert.ok(sheet.includes("Mattis"));
  assert.ok(sheet.includes('r="H'));
  assert.ok(sheet.includes("13180"));
  assert.ok(!sheet.includes("TARIF INCONNU"));
  const tableFiles = files.filter((f) => f.name.startsWith("xl/tables/table"));
  assert.equal(tableFiles.length, 3);
  assert.ok(asText("xl/tables/table1.xml").includes('displayName="TableEnfants"'));
  assert.ok(asText("xl/tables/table2.xml").includes('displayName="TableAdos"'));
  assert.ok(asText("xl/tables/table3.xml").includes('displayName="TableAdultes"'));
  assert.ok(asText("[Content_Types].xml").includes("spreadsheetml"));
  assert.ok(asText("xl/styles.xml").includes("dd/mm/yyyy"));
});

test("does not expose the export outside existing admin auth middleware", () => {
  const worker = readFileSync(new URL("../src/worker.js", import.meta.url), "utf8");
  assert.ok(worker.indexOf('if (url.pathname.startsWith("/admin/"))') > 0);
  assert.ok(worker.indexOf('if (url.pathname.startsWith("/admin/"))') < worker.indexOf('url.pathname === "/admin/members/export.xlsx"'));
  assert.ok(worker.includes("return json(request, { ok: false, error: \"unauthorized\" }, 401)"));
});
