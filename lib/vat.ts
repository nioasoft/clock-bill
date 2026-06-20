/**
 * VAT (מע״מ) resolution for generated settlement / charge documents.
 *
 * VAT applicability is a property of the FREELANCER's global status (are they
 * VAT-registered, and at what rate) with an optional per-CLIENT override (e.g.
 * a foreign client billed net/exempt). The effective rate is resolved at issue
 * time and snapshotted onto the charge document, so re-printing an old document
 * always reflects the VAT that was actually billed.
 */
import { roundMoney, addMoney } from "./money";

/** Per-client VAT override. null = "inherit" (follow the global business setting). */
export type ClientVatMode = "add" | "exempt" | null;

export const CLIENT_VAT_MODES: readonly Exclude<ClientVatMode, null>[] = [
  "add",
  "exempt",
];

/** Israeli standard VAT rate (%) — the fallback when registered without an explicit rate. */
export const DEFAULT_VAT_RATE = 18;

/**
 * Resolve the effective VAT rate (%) for a document.
 *
 * @param mode             per-client override: "add" | "exempt" | null(=inherit)
 * @param profileRegistered whether the freelancer is VAT-registered (עוסק מורשה)
 * @param profileRate       the freelancer's configured VAT rate, or null
 * @returns the rate to apply, or null when no VAT applies (exempt / not registered)
 */
export function resolveVatRate(
  mode: ClientVatMode,
  profileRegistered: boolean,
  profileRate: number | null
): number | null {
  if (mode === "exempt") return null;
  if (mode === "add") return profileRate ?? DEFAULT_VAT_RATE;
  // inherit (null): follow the global business setting.
  if (!profileRegistered) return null;
  return profileRate ?? DEFAULT_VAT_RATE;
}

/** Subtotal / VAT / total breakdown for a document, money-safe. */
export interface VatBreakdown {
  subtotal: number;
  vatAmount: number;
  total: number;
}

/**
 * Compute the subtotal / VAT / total breakdown from a net subtotal and a rate.
 * A null rate (no VAT) yields vatAmount 0 and total === subtotal.
 *
 * @param subtotal the net line sum (pre-VAT)
 * @param rate     the VAT rate (%) to apply, or null for no VAT
 */
export function computeVatBreakdown(
  subtotal: number,
  rate: number | null
): VatBreakdown {
  const net = roundMoney(subtotal);
  if (rate == null || rate <= 0) {
    return { subtotal: net, vatAmount: 0, total: net };
  }
  const vatAmount = roundMoney(net * (rate / 100));
  return { subtotal: net, vatAmount, total: addMoney(net, vatAmount) };
}
