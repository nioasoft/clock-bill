import { displayStatus, matchesFilter, type ChargeDocFilter } from "../../app/[locale]/(auth)/reports/statusMeta";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

/** A document as the documents list sees it: DB status + the orthogonal approval lock. */
const DOCS: { label: string; status: string; approvedAt: string | null }[] = [
  { label: "pending", status: "pending", approvedAt: null },
  { label: "approved", status: "pending", approvedAt: "2026-07-15T10:00:00Z" },
  { label: "partial", status: "partial", approvedAt: null },
  { label: "paid", status: "paid", approvedAt: null },
  { label: "canceled", status: "canceled", approvedAt: null },
];

/** Labels surviving a filter, in list order. */
function visible(filter: ChargeDocFilter): string[] {
  return DOCS.filter((d) => matchesFilter(displayStatus(d.status, d.approvedAt), filter)).map((d) => d.label);
}

function eq(actual: string[], expected: string[], message: string): void {
  assert(
    actual.length === expected.length && actual.every((v, i) => v === expected[i]),
    `${message}\n  expected: [${expected}]\n  actual:   [${actual}]`
  );
}

function run(): void {
  // The default filter — the whole point of the feature: hide what needs no action.
  eq(visible("active"), ["pending", "approved", "partial"], "active must show pending, approved and partial");
  assert(!visible("active").includes("paid"), "active must hide paid documents");
  assert(!visible("active").includes("canceled"), "active must hide canceled documents");

  eq(visible("all"), ["pending", "approved", "partial", "paid", "canceled"], "all must hide nothing");

  // Each explicit status selects exactly its own document.
  for (const label of ["pending", "partial", "paid", "canceled"]) {
    eq(visible(label as ChargeDocFilter), [label], `filter "${label}" must show only that status`);
  }

  // The trap: `approved` is NOT a DB status — it's approved_at over a pending doc.
  // Filtering the raw column would file it under "pending" and contradict its badge.
  eq(visible("approved"), ["approved"], "approved filter must select the approved-but-unpaid document");
  assert(
    !visible("pending").includes("approved"),
    "an approved document must NOT appear under the pending filter — badge and filter would disagree"
  );

  // Approval is orthogonal: payment state wins over the lock.
  assert(
    displayStatus("partial", "2026-07-15T10:00:00Z") === "partial",
    "partial must win over the approval lock"
  );
  assert(displayStatus("paid", "2026-07-15T10:00:00Z") === "paid", "paid must win over the approval lock");

  console.log(`charge-documents-filter: ${11} passed, 0 failed`);
}

run();
