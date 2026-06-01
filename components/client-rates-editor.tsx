"use client";

import { fieldClass } from "@/lib/form-styles";
import { CURRENCY_SYMBOLS } from "@/lib/currency";
import type { ClientRateInput, RateKind } from "@/lib/schemas/rates";

interface ClientRatesEditorProps {
  /** Controlled list of the client's hourly + item rates. */
  rates: ClientRateInput[];
  /** Currency code (ILS/USD/…) — drives the unit suffix shown on each row. */
  currency: string;
  /** Emits the next rates array on any add/remove/edit/default-change. */
  onChange: (rates: ClientRateInput[]) => void;
  disabled?: boolean;
}

/**
 * Shared editor for a client's hourly rates and per-unit items.
 *
 * Controlled component: it owns no state, only transforms the `rates` array and
 * emits it via `onChange`. Used by both the clients-list form and the client
 * detail page so the two stay in sync. Retainer fields live outside this editor
 * (they belong to the client row, not to client_rates).
 */
export function ClientRatesEditor({ rates, currency, onChange, disabled }: ClientRatesEditorProps) {
  const symbol = CURRENCY_SYMBOLS[currency] || "₪";

  const addRate = (kind: RateKind) =>
    onChange([
      ...rates,
      {
        kind,
        name: "",
        rate: 0,
        isDefault: kind === "hourly" && !rates.some((r) => r.kind === "hourly" && r.isDefault),
      },
    ]);

  const removeRate = (idx: number) => {
    const removed = rates[idx];
    let next = rates.filter((_, i) => i !== idx);
    // If the default hourly was removed, promote the first remaining hourly.
    if (removed?.kind === "hourly" && removed.isDefault && !next.some((r) => r.kind === "hourly" && r.isDefault)) {
      let promoted = false;
      next = next.map((r) => {
        if (!promoted && r.kind === "hourly") {
          promoted = true;
          return { ...r, isDefault: true };
        }
        return r;
      });
    }
    onChange(next);
  };

  const updateRate = (idx: number, patch: Partial<ClientRateInput>) =>
    onChange(rates.map((r, i) => (i === idx ? { ...r, ...patch } : r)));

  const setDefault = (idx: number) =>
    onChange(rates.map((r, i) => ({ ...r, isDefault: i === idx && r.kind === "hourly" })));

  return (
    <div className="space-y-4 rounded-[var(--radius)] border border-border bg-background/50 p-4">
      {/* Hourly rates */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">תעריפים שעתיים</span>
          <button
            type="button"
            onClick={() => addRate("hourly")}
            className="rounded-[var(--radius)] border border-primary/40 px-2.5 py-1 text-sm font-medium text-primary hover:bg-primary/10"
            disabled={disabled}
          >
            + הוסף תעריף שעתי
          </button>
        </div>
        {rates.some((r) => r.kind === "hourly") ? (
          <div className="space-y-2">
            {rates.map((r, idx) =>
              r.kind !== "hourly" ? null : (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="defaultHourly"
                    checked={r.isDefault}
                    onChange={() => setDefault(idx)}
                    className="h-4 w-4 shrink-0 accent-primary"
                    disabled={disabled}
                    aria-label="תעריף ברירת מחדל"
                    title="ברירת מחדל"
                  />
                  <input
                    type="text"
                    value={r.name}
                    onChange={(e) => updateRate(idx, { name: e.target.value })}
                    placeholder="שם (למשל תכנות)"
                    className={fieldClass(false)}
                    disabled={disabled}
                  />
                  <div className="relative w-44 shrink-0">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={r.rate || ""}
                      onChange={(e) => updateRate(idx, { rate: parseFloat(e.target.value) || 0 })}
                      className={`${fieldClass(false)} font-mono pe-16`}
                      disabled={disabled}
                      placeholder="0.00"
                    />
                    <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-xs text-muted-foreground">
                      {symbol}/שעה
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeRate(idx)}
                    className="shrink-0 rounded-[var(--radius)] px-2 py-1 text-destructive hover:bg-destructive/10"
                    disabled={disabled}
                    aria-label="הסר תעריף"
                  >
                    ✕
                  </button>
                </div>
              )
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            לא הוגדרו תעריפים שעתיים — ייעשה שימוש בתעריף ברירת המחדל.
          </p>
        )}
      </div>

      {/* Items (price per unit) */}
      <div className="space-y-2 border-t border-border pt-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">פריטים (מחיר ליחידה)</span>
          <button
            type="button"
            onClick={() => addRate("item")}
            className="rounded-[var(--radius)] border border-primary/40 px-2.5 py-1 text-sm font-medium text-primary hover:bg-primary/10"
            disabled={disabled}
          >
            + הוסף פריט
          </button>
        </div>
        {rates.some((r) => r.kind === "item") && (
          <div className="space-y-2">
            {rates.map((r, idx) =>
              r.kind !== "item" ? null : (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={r.name}
                    onChange={(e) => updateRate(idx, { name: e.target.value })}
                    placeholder="שם (למשל כתיבת מכתב)"
                    className={fieldClass(false)}
                    disabled={disabled}
                  />
                  <div className="relative w-44 shrink-0">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={r.rate || ""}
                      onChange={(e) => updateRate(idx, { rate: parseFloat(e.target.value) || 0 })}
                      className={`${fieldClass(false)} font-mono pe-16`}
                      disabled={disabled}
                      placeholder="0.00"
                    />
                    <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-xs text-muted-foreground">
                      {symbol}/יח׳
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeRate(idx)}
                    className="shrink-0 rounded-[var(--radius)] px-2 py-1 text-destructive hover:bg-destructive/10"
                    disabled={disabled}
                    aria-label="הסר פריט"
                  >
                    ✕
                  </button>
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
