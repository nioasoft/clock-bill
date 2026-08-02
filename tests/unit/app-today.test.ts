/**
 * Guards the day boundary used by every WRITE path (timer start, task→in_progress,
 * new-entry form default).
 *
 * The bug this locks down: those paths used `new Date().toISOString().split("T")[0]`
 * — the UTC calendar day — while the dashboard computes today/week/month in
 * Asia/Jerusalem. That left a nightly 2-3h window (00:00-03:00 local, DST-dependent)
 * where a fresh entry landed on YESTERDAY. `timer/stop` never rewrites `date`, so it
 * stayed wrong forever and "שעות היום" read 0:00 while the work sat on the day before.
 */

import { appToday, appDateBoundaries, addDays } from "../../lib/dates";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function eq(actual: string, expected: string, message: string): void {
  assert(actual === expected, `${message}\n  expected: ${expected}\n  actual:   ${actual}`);
}

let passed = 0;
function check(fn: () => void): void {
  fn();
  passed++;
}

function run(): void {
  // --- The window that used to break -----------------------------------------
  // 22:30 UTC on Jul 30 is 01:30 on Jul 31 in Israel (IDT, UTC+3).
  // toISOString() would say "2026-07-30". The user's calendar says the 31st.
  check(() => eq(appToday(new Date("2026-07-30T22:30:00Z")), "2026-07-31", "IDT: 01:30 local must be the NEXT day"));

  // Winter (IST, UTC+2) — the window narrows to 2h but does not disappear.
  check(() => eq(appToday(new Date("2026-01-15T22:30:00Z")), "2026-01-16", "IST: 00:30 local must be the NEXT day"));

  // One minute before the local rollover the day must NOT advance yet.
  check(() => eq(appToday(new Date("2026-07-30T20:59:00Z")), "2026-07-30", "23:59 local is still the same day"));

  // Exactly local midnight.
  check(() => eq(appToday(new Date("2026-07-30T21:00:00Z")), "2026-07-31", "local midnight rolls the day over"));

  // --- Regression: the ordinary daytime case must be untouched ---------------
  // A real prod row: created 2026-08-02 07:04:48Z = 10:04 in Israel.
  check(() => eq(appToday(new Date("2026-08-02T07:04:48Z")), "2026-08-02", "daytime must be unchanged"));

  // --- Month boundary, the case that decides which month revenue lands in ----
  // 21:30 UTC on Jul 31 is 00:30 on Aug 1 local → a NEW month, not the old one.
  const b = appDateBoundaries(new Date("2026-07-31T21:30:00Z"));
  check(() => eq(b.today, "2026-08-01", "crossing midnight into the 1st must land in the new month"));
  check(() => eq(b.startOfMonth, "2026-08-01", "startOfMonth must follow the local day, not UTC"));
  check(() => eq(b.endOfMonth, "2026-08-31", "endOfMonth must be the last day of the LOCAL month"));

  // February in a non-leap year — the classic off-by-one in hand-rolled month math.
  check(() =>
    eq(appDateBoundaries(new Date("2026-02-10T12:00:00Z")).endOfMonth, "2026-02-28", "Feb 2026 ends on the 28th")
  );

  // Week starts Sunday (Israeli convention). 2026-08-02 is a Sunday → it IS the start.
  check(() =>
    eq(appDateBoundaries(new Date("2026-08-02T07:00:00Z")).startOfWeek, "2026-08-02", "Sunday is its own week start")
  );

  // addDays must not drift across a DST change (Israel ends DST 2026-10-25).
  check(() => eq(addDays("2026-10-24", 3), "2026-10-27", "addDays must survive the DST transition"));

  // --- The report-preset bug: startOfMonth must ALWAYS be the 1st ------------
  // The ad-hoc report built it as `new Date(y, m, 1).toISOString().split("T")[0]`
  // — local midnight of the 1st, serialized as UTC. East of Greenwich that is the
  // PREVIOUS month's last day, every single time, which silently pulled an extra
  // day of the previous month into every "this month" report.
  for (const iso of ["2026-08-02T07:00:00Z", "2026-01-01T00:30:00Z", "2026-03-15T23:00:00Z"]) {
    const start = appDateBoundaries(new Date(iso)).startOfMonth;
    check(() => assert(start.endsWith("-01"), `startOfMonth must be the 1st, got ${start} for ${iso}`));
    check(() => eq(start.slice(0, 7), appToday(new Date(iso)).slice(0, 7), `startOfMonth must be in TODAY's month (${iso})`));
  }

  console.log(`app-today: ${passed} passed, 0 failed`);
}

run();
