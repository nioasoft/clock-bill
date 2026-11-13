/**
 * SPEC (written before the fix) — the three smaller implicit machines:
 *  - task status ⇔ running timer invariant (server-side),
 *  - settlement reminder "once per cycle" with catch-up,
 *  - client active/locked (make-active on an archived client).
 * See docs/implicit-state-machines.html §5–7.
 */
import * as settlements from "../../lib/settlements";
import { need, src, eq, ok, run } from "./_state-harness";

type Due = (i: { billingDay: number; remindedAt: string | null; today: string }) => boolean;
const due = (billingDay: number, remindedAt: string | null, today: string) =>
  need<Due>(settlements, "isSettlementReminderDue")({ billingDay, remindedAt, today });

const moveRoute = src("app", "api", "tasks", "[id]", "move", "route.ts");
const makeActive = src("app", "api", "clients", "[id]", "make-active", "route.ts");
const cron = src("app", "api", "cron", "notifications", "route.ts");

run("tasks / settlement / clients state machines (spec)", [
  // ── tasks ⇔ timer ──
  ["moving a task out of in_progress with a running timer is refused server-side", () => {
    ok(moveRoute.includes("TIMER_RUNNING"), "move route lets a task leave in_progress with its timer still running");
  }],

  // ── settlement reminder ──
  ["due on the billing day when not yet reminded this cycle", () => eq(due(10, "2026-10-10", "2026-11-10"), true, "on day")],
  ["not due twice in the same cycle", () => eq(due(10, "2026-11-10", "2026-11-10"), false, "same day")],
  ["catch-up: cron missed the 10th → still due on the 12th", () => eq(due(10, "2026-10-10", "2026-11-12"), true, "catch-up")],
  ["not due before this month's billing day", () => eq(due(10, "2026-10-10", "2026-11-05"), false, "early")],
  ["end-of-month (31) clamps: due on Feb 28", () => eq(due(31, "2026-01-31", "2026-02-28"), true, "clamp")],
  ["never reminded + day reached → due", () => eq(due(1, null, "2026-11-03"), true, "first")],
  ["cron uses the catch-up rule, not isBillingDayToday", () => {
    ok(cron.includes("isSettlementReminderDue"), "cron still fires only on the exact day");
  }],

  // ── clients ──
  ["make-active only touches active clients", () => {
    ok(/plan_priority_at = NOW\(\)[\s\S]{0,120}is_active/.test(makeActive), "make-active bumps archived clients");
  }],
]);
