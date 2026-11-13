/**
 * SPEC (written before the fix) — account plan / Polar subscription machine.
 * Targets in lib/entitlements.ts:
 *  - resolvePlan() honors subscription_status (today it only reads the tier),
 *  - subscriptionEventDecision() — pure "apply or ignore" for webhook events so
 *    out-of-order / foreign-subscription events can't re-grant or revoke wrongly.
 * See docs/implicit-state-machines.html §4.
 */
import * as ent from "../../lib/entitlements";
import { resolvePlan } from "../../lib/entitlements";
import { need, src, eq, run } from "./_state-harness";

const NOW = new Date("2026-11-11T10:00:00Z");
const FUTURE = "2026-12-01T00:00:00Z";
const PAST = "2026-11-01T00:00:00Z";
const row = (tier: string, status: string | null, periodEnd: string | null = FUTURE) => ({
  subscription_tier: tier, subscription_status: status, subscription_period_end: periodEnd,
  founding: false, trial_ends_at: null,
});

type Stored = { subscriptionId: string | null; status: string | null };
type Event = { kind: "active" | "updated" | "order_paid" | "revoked"; subscriptionId: string; status: string };
const decide = (s: Stored, e: Event) =>
  need<(s: Stored, e: Event) => "apply" | "ignore">(ent, "subscriptionEventDecision")(s, e);

run("subscription state machine (spec)", [
  // ── resolvePlan ──
  ["active paid sub keeps its tier", () => eq(resolvePlan(row("starter", "active"), NOW).tier, "starter", "active")],
  ["status 'revoked' → free even if tier column says paid", () =>
    eq(resolvePlan(row("unlimited", "revoked"), NOW).tier, "free", "revoked")],
  ["status 'unpaid' / 'incomplete' → free", () => {
    eq(resolvePlan(row("starter", "unpaid"), NOW).tier, "free", "unpaid");
    eq(resolvePlan(row("starter", "incomplete"), NOW).tier, "free", "incomplete");
  }],
  ["'canceled' keeps the tier until period end, then free", () => {
    eq(resolvePlan(row("starter", "canceled", FUTURE), NOW).tier, "starter", "before end");
    eq(resolvePlan(row("starter", "canceled", PAST), NOW).tier, "free", "after end");
  }],
  ["'past_due' keeps the tier until period end (grace), then free", () => {
    eq(resolvePlan(row("starter", "past_due", FUTURE), NOW).tier, "starter", "grace");
    eq(resolvePlan(row("starter", "past_due", PAST), NOW).tier, "free", "grace over");
  }],

  // ── webhook ordering ──
  ["first event for a user applies", () =>
    eq(decide({ subscriptionId: null, status: null }, { kind: "active", subscriptionId: "s1", status: "active" }), "apply", "first")],
  ["late 'updated' for an already-revoked sub is ignored", () =>
    eq(decide({ subscriptionId: "s1", status: "revoked" }, { kind: "updated", subscriptionId: "s1", status: "active" }), "ignore", "resurrect")],
  ["revoke of an OLD sub after switching plans is ignored", () =>
    eq(decide({ subscriptionId: "s2", status: "active" }, { kind: "revoked", subscriptionId: "s1", status: "revoked" }), "ignore", "foreign revoke")],
  ["a NEW sub becoming active supersedes the stored one", () =>
    eq(decide({ subscriptionId: "s1", status: "revoked" }, { kind: "active", subscriptionId: "s2", status: "active" }), "apply", "new sub")],
  ["trial cron counts locked clients from CLIENT_LIMITS, not a hardcoded 1", () => {
    const cron = src("app", "api", "cron", "trial-lifecycle", "route.ts");
    eq(/active_client_count\s*-\s*1\b/.test(cron), false, "hardcoded free cap");
  }],
]);
