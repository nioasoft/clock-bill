/**
 * SPEC (written before the fix) — charge-document state machine.
 * Target: one pure guard `chargeDocActions()` in lib/charge-documents.ts that
 * every route consults, replacing the dead `canTransition` table.
 * See docs/implicit-state-machines.html §1.
 */
import * as cd from "../../lib/charge-documents";
import { need, src, eq, ok, run } from "./_state-harness";

type Status = "pending" | "partial" | "paid" | "canceled";
type Actions = Record<
  "edit" | "cancel" | "approve" | "unapprove" | "addPayment" | "editPayment" | "send" | "delete",
  boolean
>;
const actions = (status: Status, approved: boolean, paidSum: number): Actions =>
  need<(d: { status: Status; approved: boolean; paidSum: number }) => Actions>(cd, "chargeDocActions")({
    status, approved, paidSum,
  });

const sendRoute = src("app", "api", "charge-documents", "[id]", "send", "route.ts");
const paymentEditRoute = src("app", "api", "charge-documents", "[id]", "payments", "[paymentId]", "route.ts");
const createRoute = src("app", "api", "charge-documents", "route.ts");

run("charge-document state machine (spec)", [
  // ── guard table: mirrors what the routes enforce today ──
  ["pending, unapproved, no payments → editable + cancelable + approvable", () => {
    const a = actions("pending", false, 0);
    ok(a.edit && a.cancel && a.approve && !a.unapprove && a.send && !a.delete, JSON.stringify(a));
  }],
  ["partial → no cancel (cancel route requires pending + zero payments)", () => {
    eq(actions("partial", false, 50).cancel, false, "partial.cancel");
  }],
  ["approved → locked for edit and cancel, unapprove allowed", () => {
    const a = actions("pending", true, 0);
    ok(!a.edit && !a.cancel && !a.approve && a.unapprove, JSON.stringify(a));
  }],
  ["paid → no new payment, no approve; payment edit still allowed (to undo)", () => {
    const a = actions("paid", false, 100);
    ok(!a.addPayment && !a.approve && a.editPayment && !a.cancel, JSON.stringify(a));
  }],
  ["canceled is terminal: only delete", () => {
    const a = actions("canceled", false, 0);
    ok(a.delete && !a.edit && !a.send && !a.addPayment && !a.editPayment && !a.approve, JSON.stringify(a));
  }],
  ["dead canTransition table is removed (it allowed partial→canceled)", () => {
    ok(!("canTransition" in cd), "canTransition still exported");
  }],

  // ── bugs found in the investigation ──
  ["editing a payment re-checks over-payment like POST does", () => {
    ok(paymentEditRoute.includes("AMOUNT_EXCEEDS_OUTSTANDING"), "PATCH payment has no over-payment guard");
  }],
  ["email amount uses documentMoney (discount-aware), not net*(1+vat)", () => {
    ok(sendRoute.includes("documentMoney("), "send route hand-rolls gross and ignores the discount");
  }],
  ["send cannot write a token onto a canceled doc (conditional UPDATE)", () => {
    const tokenUpdate = sendRoute.slice(sendRoute.indexOf("SET public_token = $1"));
    ok(/status\s*<>\s*'canceled'/.test(tokenUpdate.slice(0, 300)), "token UPDATE has no status predicate");
  }],
  ["editing a partial doc can't drop gross below what's already paid", () => {
    const docRoute = src("app", "api", "charge-documents", "[id]", "route.ts");
    ok(/paidSum > bal\.gross[\s\S]{0,60}BELOW_PAID/.test(docRoute), "PATCH recomputes to 'paid' with no gross ≥ paid check");
  }],
  ["create checks the claim rowCount → 409 instead of silent/500", () => {
    // The pre-check at the SELECT already throws it; the CLAIM UPDATE must too.
    const claim = createRoute.slice(createRoute.indexOf("UPDATE time_entries SET charge_document_id = $1"));
    ok(/rowCount[\s\S]{0,200}ENTRY_STATE_CHANGED/.test(claim.slice(0, 600)), "claim UPDATE rowCount is ignored");
  }],
]);
