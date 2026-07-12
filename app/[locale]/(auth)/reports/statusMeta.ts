/** Translation key + token classes per charge-document status. Shared by the documents tab and the document view. */
export type ChargeDocStatus = "pending" | "partial" | "paid" | "canceled";
/**
 * Display-only status: `approved` is NOT a DB status — it's the orthogonal
 * approval lock (approved_at) rendered over a still-pending document as
 * "approved — awaiting payment". partial/paid win over approval.
 */
export type ChargeDocDisplayStatus = ChargeDocStatus | "approved";

/** Resolve what badge to show for a document given its status + approval lock. */
export function displayStatus(
  status: string,
  approvedAt: string | null | undefined
): ChargeDocDisplayStatus {
  if (approvedAt && status === "pending") return "approved";
  return (status as ChargeDocStatus) in STATUS_META ? (status as ChargeDocStatus) : "pending";
}

/**
 * `labelKey` is a `Reports` namespace key resolved at the call site via
 * `useTranslations("Reports")` (this is a plain module, so it can't call hooks).
 * `badge` styles the pill; `surface` gives list rows a quiet semantic tint so
 * status remains scannable without relying on a thin directional stripe.
 */
export const STATUS_META: Record<
  ChargeDocDisplayStatus,
  { labelKey: string; badge: string; surface: string; dot: string }
> = {
  approved: {
    labelKey: "status.approved",
    badge: "bg-success/10 text-success border-success/30",
    surface: "bg-success/[0.03] hover:bg-success/[0.06]",
    dot: "bg-success",
  },
  pending: {
    labelKey: "status.pending",
    badge: "bg-primary/15 text-primary border-primary/30",
    surface: "bg-primary/[0.04] hover:bg-primary/[0.07]",
    dot: "bg-primary",
  },
  partial: {
    labelKey: "status.partial",
    badge: "bg-warning/15 text-warning border-warning/30",
    surface: "bg-warning/[0.04] hover:bg-warning/[0.07]",
    dot: "bg-warning",
  },
  paid: {
    labelKey: "status.paid",
    badge: "bg-success/15 text-success border-success/30",
    surface: "bg-success/[0.04] hover:bg-success/[0.07]",
    dot: "bg-success",
  },
  canceled: {
    labelKey: "status.canceled",
    badge: "bg-muted text-muted-foreground border-border",
    surface: "bg-muted/30 hover:bg-muted/50",
    dot: "bg-muted-foreground",
  },
};
