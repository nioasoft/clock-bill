export type PublicPaymentMethod =
  | "bank_transfer"
  | "bit"
  | "cash"
  | "check"
  | "credit"
  | "other";

export interface PublicPaymentEvent {
  amount: number;
  paidAt: string;
  method: PublicPaymentMethod | null;
}

export interface PublicDocumentHistoryEvent {
  key: string;
  type: "issued" | "sent" | "payment";
  occurredAt: string;
  amount?: number;
  method?: PublicPaymentMethod | null;
}

interface PublicDocumentHistoryInput {
  issuedAt: string;
  lastSentAt: string | null;
  payments: PublicPaymentEvent[];
}

/**
 * Build the client-visible document history from non-sensitive events only.
 * Internal IDs, recipient addresses, payment notes, and the bearer token never
 * cross the Server Component boundary.
 */
export function buildPublicDocumentHistory({
  issuedAt,
  lastSentAt,
  payments,
}: PublicDocumentHistoryInput): PublicDocumentHistoryEvent[] {
  const history: PublicDocumentHistoryEvent[] = [];

  if (issuedAt) {
    history.push({ key: "issued", type: "issued", occurredAt: issuedAt });
  }
  if (lastSentAt) {
    history.push({ key: "sent", type: "sent", occurredAt: lastSentAt });
  }
  payments.forEach((payment, index) => {
    history.push({
      key: `payment-${index}`,
      type: "payment",
      occurredAt: payment.paidAt,
      amount: payment.amount,
      method: payment.method,
    });
  });

  return history.sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
  );
}
