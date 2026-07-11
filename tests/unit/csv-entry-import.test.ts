import assert from "node:assert/strict";
import { parseEntryCsv } from "../../lib/csv-entry-import";

const projects = [
  { id: "p1", name: "Website", clientName: "Acme" },
  { id: "p2", name: "Website", clientName: "Beta" },
  { id: "p3", name: "ייעוץ", clientName: "חברה" },
];

const valid = parseEntryCsv(
  "date,client,project,description,duration_minutes,notes,billable,rate\n10/07/2026,Acme,Website,Planning,90,Call notes,yes,250",
  projects
);
assert.equal(valid.ok, true);
if (valid.ok) {
  assert.equal(valid.rows.length, 1);
  assert.deepEqual(valid.rows[0].errors, []);
  assert.deepEqual(valid.rows[0].normalized, {
    projectId: "p1",
    date: "2026-07-10",
    duration: 90,
    description: "Planning",
    notes: "Call notes",
    isBillable: true,
    rate: 250,
  });
}

const quoted = parseEntryCsv(
  'תאריך,לקוח,פרויקט,תיאור,משך_בדקות,הערות,לחיוב\n2026-07-10,חברה,ייעוץ,"פגישה, שבועית","60","שורה 1\nשורה 2",לא',
  projects
);
assert.equal(quoted.ok, true);
if (quoted.ok) {
  assert.equal(quoted.rows[0].normalized?.description, "פגישה, שבועית");
  assert.equal(quoted.rows[0].normalized?.notes, "שורה 1\nשורה 2");
  assert.equal(quoted.rows[0].normalized?.isBillable, false);
}

const ambiguous = parseEntryCsv(
  "date,project,description,duration\n2026-07-10,Website,Work,60",
  projects
);
assert.equal(ambiguous.ok, true);
if (ambiguous.ok) assert.deepEqual(ambiguous.rows[0].errors, ["projectAmbiguous"]);

const duplicate = parseEntryCsv(
  "date,client,project,description,duration\n2026-07-10,Acme,Website,Work,60\n2026-07-10,Acme,Website,Work,60",
  projects
);
assert.equal(duplicate.ok, true);
if (duplicate.ok) assert.deepEqual(duplicate.rows[1].errors, ["duplicateRow"]);

const invalid = parseEntryCsv(
  "date,client,project,description,duration,billable\n2026-02-30,Missing,Unknown,,0,perhaps",
  projects
);
assert.equal(invalid.ok, true);
if (invalid.ok) {
  assert.deepEqual(invalid.rows[0].errors, [
    "invalidDate",
    "projectNotFound",
    "missingDescription",
    "invalidDuration",
    "invalidBillable",
  ]);
}

const malformed = parseEntryCsv('date,project,description,duration\n2026-07-10,Website,"unfinished,60', projects);
assert.deepEqual(malformed, { ok: false, error: "malformedCsv" });

const missingHeaders = parseEntryCsv("date,description\n2026-07-10,Work", projects);
assert.equal(missingHeaders.ok, false);
if (!missingHeaders.ok) {
  assert.equal(missingHeaders.error, "missingHeaders");
  assert.deepEqual(missingHeaders.missingHeaders, ["project", "duration"]);
}

console.log("CSV entry import tests passed");
