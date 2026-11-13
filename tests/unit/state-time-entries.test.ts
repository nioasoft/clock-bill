/**
 * SPEC (written before the fix) — time_entries: timer lifecycle + billing lifecycle.
 * Target: lib/time-entry-state.ts — the single definition of "running", "paused",
 * "billed", "editable" and elapsed time, used by routes, cron and UI.
 * See docs/implicit-state-machines.html §2–3.
 */
import { need, tryImport, src, eq, ok, run } from "./_state-harness";

interface Row {
  start_time: string | null;
  end_time: string | null;
  paused_at: string | null;
  total_paused_time: number; // ms
  is_billable: boolean;
  charge_document_id: string | null;
  written_off_at: string | null;
}
const base: Row = {
  start_time: "2026-11-11T08:00:00Z", end_time: null, paused_at: null, total_paused_time: 0,
  is_billable: true, charge_document_id: null, written_off_at: null,
};
const NOW = new Date("2026-11-11T10:00:00Z");

const bulkRoute = src("app", "api", "entries", "bulk", "route.ts");
const entryRoute = src("app", "api", "entries", "[id]", "route.ts");
const billableRoute = src("app", "api", "charge-documents", "billable", "route.ts");
const createRoute = src("app", "api", "charge-documents", "route.ts");
const stopRoute = src("app", "api", "timer", "stop", "route.ts");
const notesRoute = src("app", "api", "timer", "notes", "route.ts");
const cronRoute = src("app", "api", "cron", "notifications", "route.ts");

(async () => {
  const m = await tryImport("../../lib/time-entry-state");
  const timerState = (r: Row) => need<(r: Row) => string>(m, "timerState")(r);
  const billingState = (r: Row) => need<(r: Row) => string>(m, "billingState")(r);
  const canEdit = (r: Row) => need<(r: Row) => boolean>(m, "canEditEntry")(r);
  const canBill = (r: Row) => need<(r: Row) => boolean>(m, "canBillEntry")(r);
  const elapsed = (r: Row) => need<(r: Row, now: Date) => number>(m, "timerElapsedMs")(r, NOW);

  await run("time-entry state machines (spec)", [
    // ── timer ──
    ["running / paused / stopped derived in one place", () => {
      eq(timerState(base), "running", "running");
      eq(timerState({ ...base, paused_at: "2026-11-11T09:00:00Z" }), "paused", "paused");
      eq(timerState({ ...base, end_time: "2026-11-11T09:00:00Z" }), "stopped", "stopped");
    }],
    ["elapsed folds both closed pauses AND the open pause", () => {
      // 2h wall, 10min closed pause, paused for the last 30min → 80min
      const r = { ...base, total_paused_time: 10 * 60_000, paused_at: "2026-11-11T09:30:00Z" };
      eq(elapsed(r), 80 * 60_000, "elapsed ms");
    }],
    ["timer/notes uses the same running predicate (start_time IS NOT NULL)", () => {
      ok(notesRoute.includes("start_time IS NOT NULL"), "notes route matches end_time IS NULL only");
    }],
    ["stop accepts a timer that ran > 24h (no 1440-minute cap on the stop path)", () => {
      ok(!stopRoute.includes("max(MAX_ENTRY_MINUTES)"), "stop schema rejects duration > 1440 → timer unstoppable");
    }],
    ["long-timer cron marks with a conditional UPDATE (no double push)", () => {
      ok(/long_timer_notified_at IS NULL/.test(cronRoute.slice(cronRoute.indexOf("SET long_timer_notified_at"))),
        "mark UPDATE lacks AND long_timer_notified_at IS NULL");
    }],

    // ── billing ──
    ["billing state: unbilled / billed / written_off / non_billable", () => {
      eq(billingState(base), "unbilled", "unbilled");
      eq(billingState({ ...base, charge_document_id: "d1" }), "billed", "billed");
      eq(billingState({ ...base, written_off_at: "2026-11-01T00:00:00Z" }), "written_off", "written_off");
      eq(billingState({ ...base, is_billable: false }), "non_billable", "non_billable");
    }],
    ["a running timer is NOT billable yet; a stopped unbilled one is", () => {
      eq(canBill(base), false, "running timer billable");
      eq(canBill({ ...base, end_time: "2026-11-11T09:00:00Z" }), true, "stopped entry");
    }],
    ["billed entry is not editable", () => {
      eq(canEdit({ ...base, end_time: "x", charge_document_id: "d1" }), false, "billed editable");
      eq(canEdit({ ...base, end_time: "x" }), true, "unbilled editable");
    }],
    ["billable list + create exclude running timers (end_time IS NOT NULL)", () => {
      ok(billableRoute.includes("end_time IS NOT NULL"), "billable route lists running timers");
      ok(createRoute.includes("end_time IS NOT NULL"), "create can bill a running timer");
    }],
    ["entry PUT UPDATE is conditional on charge_document_id IS NULL (race)", () => {
      const upd = entryRoute.slice(entryRoute.indexOf("UPDATE time_entries\n           SET project_id"));
      ok(upd.slice(0, 600).includes("charge_document_id IS NULL"), "PUT UPDATE has no billed predicate");
    }],
    ["bulk PATCH and DELETE skip billed entries", () => {
      const n = bulkRoute.split("charge_document_id IS NULL").length - 1;
      ok(n >= 2, `bulk route has ${n}/2 billed guards`);
    }],
  ]);
})();
