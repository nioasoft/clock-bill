/** Hebrew label + token classes per charge-document status. Shared by the documents tab and the document view. */
export type ChargeDocStatus = "pending" | "paid" | "canceled";
/**
 * `badge` styles the pill; `accent` is an inline-start border color used in the
 * documents list so paid vs. not-paid is obvious at a glance.
 */
export const STATUS_META: Record<
  ChargeDocStatus,
  { label: string; badge: string; accent: string }
> = {
  pending: {
    label: "ממתין",
    badge: "bg-primary/15 text-primary border-primary/30",
    accent: "border-s-primary",
  },
  paid: {
    label: "שולם",
    badge: "bg-success/15 text-success border-success/30",
    accent: "border-s-success",
  },
  canceled: {
    label: "בוטל",
    badge: "bg-muted text-muted-foreground border-border",
    accent: "border-s-border-strong",
  },
};
