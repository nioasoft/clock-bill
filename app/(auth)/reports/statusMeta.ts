/** Hebrew label + token badge classes per charge-document status. Shared by the documents tab and the document view. */
export type ChargeDocStatus = "pending" | "paid" | "canceled";
export const STATUS_META: Record<ChargeDocStatus, { label: string; badge: string }> = {
  pending: { label: "ממתין", badge: "bg-primary/15 text-primary border-primary/30" },
  paid: { label: "שולם", badge: "bg-success/15 text-success border-success/30" },
  canceled: { label: "בוטל", badge: "bg-muted text-muted-foreground border-border" },
};
