/** Translation key + token classes per charge-document status. Shared by the documents tab and the document view. */
export type ChargeDocStatus = "pending" | "paid" | "canceled";
/**
 * `labelKey` is a `Reports` namespace key resolved at the call site via
 * `useTranslations("Reports")` (this is a plain module, so it can't call hooks).
 * `badge` styles the pill; `accent` is an inline-start border color used in the
 * documents list so paid vs. not-paid is obvious at a glance.
 */
export const STATUS_META: Record<
  ChargeDocStatus,
  { labelKey: string; badge: string; accent: string }
> = {
  pending: {
    labelKey: "status.pending",
    badge: "bg-primary/15 text-primary border-primary/30",
    accent: "border-s-primary",
  },
  paid: {
    labelKey: "status.paid",
    badge: "bg-success/15 text-success border-success/30",
    accent: "border-s-success",
  },
  canceled: {
    labelKey: "status.canceled",
    badge: "bg-muted text-muted-foreground border-border",
    accent: "border-s-border-strong",
  },
};
