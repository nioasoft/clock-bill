/** Translation key + token classes per charge-document status. Shared by the documents tab and the document view. */
export type ChargeDocStatus = "pending" | "partial" | "paid" | "canceled";
/**
 * `labelKey` is a `Reports` namespace key resolved at the call site via
 * `useTranslations("Reports")` (this is a plain module, so it can't call hooks).
 * `badge` styles the pill; `surface` gives list rows a quiet semantic tint so
 * status remains scannable without relying on a thin directional stripe.
 */
export const STATUS_META: Record<
  ChargeDocStatus,
  { labelKey: string; badge: string; surface: string; dot: string }
> = {
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
