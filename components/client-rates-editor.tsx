"use client";

import { useTranslations } from "next-intl";
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
 *
 * Layout is intentionally dense: each rate is a single compact row
 * (default · name · price · remove), grouped under two slim section headers.
 */
export function ClientRatesEditor({ rates, currency, onChange, disabled }: ClientRatesEditorProps) {
  const t = useTranslations("Clients");
  const symbol = CURRENCY_SYMBOLS[currency] || "₪";

  const addRate = (kind: RateKind) =>
    onChange([
      ...rates,
      {
        kind,
        name: "",
        rate: 0,
        isDefault: kind === "hourly" && !rates.some((r) => r.kind === "hourly" && r.isDefault),
        unit: null,
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

  const hourly = rates.some((r) => r.kind === "hourly");
  const items = rates.some((r) => r.kind === "item");

  /** One compact rate row. `showDefault` renders the default-radio cell (hourly only). */
  const row = (r: ClientRateInput, idx: number, unit: string, showDefault: boolean) => (
    <div key={idx} className="flex items-center gap-2">
      {showDefault ? (
        <input
          type="radio"
          name="defaultHourly"
          checked={r.isDefault}
          onChange={() => setDefault(idx)}
          className="h-4 w-4 shrink-0 accent-primary"
          disabled={disabled}
          aria-label={t("defaultRateAria")}
          title={t("defaultBadge")}
        />
      ) : (
        <span className="w-4 shrink-0" aria-hidden />
      )}
      <input
        type="text"
        value={r.name}
        onChange={(e) => updateRate(idx, { name: e.target.value })}
        placeholder={showDefault ? t("rateNameHourlyPlaceholder") : t("rateNameItemPlaceholder")}
        className={`${fieldClass(false)} min-w-0 flex-1`}
        disabled={disabled}
      />
      {!showDefault && (
        <input
          type="text"
          value={r.unit ?? ""}
          onChange={(e) => updateRate(idx, { unit: e.target.value || null })}
          placeholder={t("unitPlaceholder")}
          className={`${fieldClass(false)} w-28 shrink-0 sm:w-32`}
          disabled={disabled}
          aria-label={t("unitAria")}
          maxLength={30}
        />
      )}
      <div className="relative w-32 shrink-0 sm:w-36">
        <input
          type="number"
          min="0"
          step="0.01"
          value={r.rate || ""}
          onChange={(e) => updateRate(idx, { rate: parseFloat(e.target.value) || 0 })}
          className={`${fieldClass(false)} font-mono pe-12`}
          disabled={disabled}
          placeholder="0.00"
        />
        <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-xs text-muted-foreground">
          {symbol}/{r.unit?.trim() || unit}
        </span>
      </div>
      <button
        type="button"
        onClick={() => removeRate(idx)}
        className="shrink-0 rounded-[var(--radius)] px-2 py-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        disabled={disabled}
        aria-label={t("remove")}
        title={t("remove")}
      >
        ✕
      </button>
    </div>
  );

  const sectionHeader = (title: string, addLabel: string, kind: RateKind) => (
    <div className="flex items-center justify-between">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</span>
      <button
        type="button"
        onClick={() => addRate(kind)}
        className="rounded-[var(--radius)] px-2 py-1 text-sm font-medium text-primary hover:bg-primary/10"
        disabled={disabled}
      >
        {addLabel}
      </button>
    </div>
  );

  return (
    <div className="divide-y divide-border rounded-[var(--radius)] border border-border bg-background/50">
      {/* Hourly rates */}
      <div className="space-y-2 p-3">
        {sectionHeader(t("hourlyRatesHeader"), t("addRate"), "hourly")}
        {hourly ? (
          <div className="space-y-1.5">
            {rates.map((r, idx) => (r.kind === "hourly" ? row(r, idx, t("unitHour"), true) : null))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">{t("noHourlyRates")}</p>
        )}
      </div>

      {/* Items (price per unit) */}
      <div className="space-y-2 p-3">
        {sectionHeader(t("itemsHeader"), t("addItem"), "item")}
        {items && (
          <div className="space-y-1.5">
            {rates.map((r, idx) => (r.kind === "item" ? row(r, idx, t("unitItem"), false) : null))}
          </div>
        )}
        <p className="text-xs text-muted-foreground">{t("preVatHint")}</p>
      </div>
    </div>
  );
}
