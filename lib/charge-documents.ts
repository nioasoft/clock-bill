/**
 * Pure logic for internal settlement / charge documents. No DB or IO here so
 * it stays unit-testable. API routes call these to build line snapshots,
 * compute totals, and gate status transitions.
 */
import { calcHourlyAmount, calcItemAmount, sumMoney } from "./money";

export type ChargeStatus = "pending" | "paid" | "canceled";
export type SourceType = "time_entry" | "fixed_monthly" | "retainer";
export type BillingKind = "hourly" | "item" | "fixed";

/** A client's unbilled entry as returned by the billable query. */
export interface BillableEntry {
  id: string;
  description: string;
  notes: string | null;
  billingKind: "hourly" | "item" | null; // null => legacy hourly
  duration: number; // minutes (hourly)
  quantity: number | null; // units (item)
  rate: number | null;
  rateLabel: string | null;
  itemRef: number | null;
}

/** A snapshot line ready to INSERT into charge_document_lines (sans id/document_id). */
export interface ChargeLineDraft {
  sourceType: SourceType;
  timeEntryId: string | null;
  periodMonth: string | null;
  label: string;
  description: string | null;
  notes: string | null;
  itemRef: number | null;
  billingKind: BillingKind;
  quantity: number | null;
  rate: number | null;
  amount: number;
}

/**
 * Allowed status transitions. A paid document must be reopened (unpay) before
 * it can be canceled; a canceled document is terminal.
 */
const TRANSITIONS: Record<ChargeStatus, ChargeStatus[]> = {
  pending: ["paid", "canceled"],
  paid: ["pending"],
  canceled: [],
};

export function canTransition(from: ChargeStatus, to: ChargeStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

/** Sum of line amounts, money-safe (null amounts count as 0). */
export function computeDocumentTotal(lines: Array<{ amount: number | null }>): number {
  return sumMoney(lines.map((l) => l.amount ?? 0));
}

/** Build a snapshot line from an unbilled time entry. */
export function buildLineFromEntry(entry: BillableEntry): ChargeLineDraft {
  const isItem = entry.billingKind === "item";
  const amount = isItem
    ? calcItemAmount(entry.quantity, entry.rate)
    : calcHourlyAmount(entry.duration, entry.rate);
  return {
    sourceType: "time_entry",
    timeEntryId: entry.id,
    periodMonth: null,
    label: entry.rateLabel ?? entry.description,
    description: entry.description,
    notes: entry.notes,
    itemRef: isItem ? entry.itemRef : null,
    billingKind: isItem ? "item" : "hourly",
    quantity: isItem ? entry.quantity : null,
    rate: entry.rate,
    amount,
  };
}
