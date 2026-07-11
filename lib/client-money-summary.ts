import {
  buildLineFromEntry,
  documentMoney,
  outstanding,
  type BillableEntry,
  type DiscountType,
} from "./charge-documents";
import { addMoney } from "./money";
import { resolveRounding } from "./rounding";

export interface ClientMoneyEntry extends BillableEntry {
  clientId: string;
  projectRounding: string | null;
  clientRounding: string | null;
}

export interface ClientMoneyDocument {
  clientId: string;
  currency: string;
  total: number | null;
  discountType: DiscountType | null;
  discountValue: number | null;
  vatRate: number | null;
  paidSum: number;
}

export interface ClientMoneySummary {
  unbilled: number;
  outstanding: number;
  paid: number;
  hasOtherCurrency: boolean;
}

interface SummaryInput {
  clientCurrencies: Map<string, string>;
  profileRounding: string | null;
  entries: ClientMoneyEntry[];
  documents: ClientMoneyDocument[];
}

const emptySummary = (): ClientMoneySummary => ({
  unbilled: 0,
  outstanding: 0,
  paid: 0,
  hasOtherCurrency: false,
});

/**
 * Derive the clients list's money trail from the same snapshots and rounding
 * rules used when issuing a charge document. Legacy documents in another
 * currency are deliberately flagged instead of being added to unlike money.
 */
export function summarizeClientMoney(input: SummaryInput): Map<string, ClientMoneySummary> {
  const result = new Map<string, ClientMoneySummary>();
  for (const clientId of input.clientCurrencies.keys()) result.set(clientId, emptySummary());

  for (const entry of input.entries) {
    const current = result.get(entry.clientId) ?? emptySummary();
    const line = buildLineFromEntry({
      ...entry,
      billingRounding: resolveRounding(
        entry.projectRounding,
        entry.clientRounding,
        input.profileRounding
      ),
    });
    result.set(entry.clientId, { ...current, unbilled: addMoney(current.unbilled, line.amount) });
  }

  for (const document of input.documents) {
    const current = result.get(document.clientId) ?? emptySummary();
    const clientCurrency = input.clientCurrencies.get(document.clientId);
    if (clientCurrency && document.currency !== clientCurrency) {
      result.set(document.clientId, { ...current, hasOtherCurrency: true });
      continue;
    }
    const { gross } = documentMoney({
      total: document.total ?? 0,
      discountType: document.discountType,
      discountValue: document.discountValue,
      vatRate: document.vatRate,
    });
    result.set(document.clientId, {
      ...current,
      outstanding: addMoney(current.outstanding, outstanding(gross, document.paidSum)),
      paid: addMoney(current.paid, document.paidSum),
    });
  }

  return result;
}
