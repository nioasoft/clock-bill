"use client";

import { useTranslations } from "next-intl";
import { CURRENCY_SYMBOLS } from "@/lib/currency";
import { SimpleSelect } from "@/components/ui/simple-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ClientRateInput, RateKind } from "@/lib/schemas/rates";

interface ClientRatesEditorProps {
  /** Controlled list of the client's hourly + item rates. */
  rates: ClientRateInput[];
  /** Currency code (ILS/USD/…) — drives the unit suffix shown on each row. */
  currency: string;
  /** Emits the next rates array on any add/remove/edit/default-change. */
  onChange: (rates: ClientRateInput[]) => void;
  /**
   * The client's projects, for per-rate project scoping. Empty/omitted (e.g.
   * a brand-new client) hides the scope select; existing projectId values
   * still pass through unchanged.
   */
  projects?: { id: string; name: string }[];
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
export function ClientRatesEditor({ rates, currency, onChange, projects = [], disabled }: ClientRatesEditorProps) {
  const t = useTranslations("Clients");
  const tUnits = useTranslations("Units");
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
        projectId: null,
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

  // Scoping a rate to a project clears its default flag (the client default
  // must stay visible on every project) and promotes the first general hourly.
  const setScope = (idx: number, projectId: string | null) => {
    let next = rates.map((r, i) =>
      i === idx ? { ...r, projectId, isDefault: r.isDefault && !projectId } : r
    );
    if (!next.some((r) => r.kind === "hourly" && r.isDefault)) {
      let promoted = false;
      next = next.map((r) => {
        if (!promoted && r.kind === "hourly" && !r.projectId) {
          promoted = true;
          return { ...r, isDefault: true };
        }
        return r;
      });
    }
    onChange(next);
  };

  const setDefault = (idx: number) =>
    onChange(rates.map((r, i) => ({ ...r, isDefault: i === idx && r.kind === "hourly" })));

  const hourly = rates.some((r) => r.kind === "hourly");
  const items = rates.some((r) => r.kind === "item");

  /** One compact rate row. `showDefault` renders the default-radio cell (hourly only). */
  const row = (r: ClientRateInput, idx: number, unit: string, showDefault: boolean) => (
    <div key={idx} className="space-y-1">
      <div className="grid grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center gap-2 sm:flex">
      {showDefault ? (
        <label className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-[var(--radius)] hover:bg-muted">
          <input
            type="radio"
            name="defaultHourly"
            checked={r.isDefault}
            onChange={() => setDefault(idx)}
            className="h-5 w-5 accent-primary"
            disabled={disabled}
            aria-label={t("defaultRateAria")}
            title={t("defaultBadge")}
          />
        </label>
      ) : (
        <span className="h-11 w-11 shrink-0" aria-hidden />
      )}
      <Input
        type="text"
        value={r.name}
        onChange={(e) => updateRate(idx, { name: e.target.value })}
        placeholder={showDefault ? t("rateNameHourlyPlaceholder") : t("rateNameItemPlaceholder")}
        className="min-w-0 flex-1"
        disabled={disabled}
      />
      {!showDefault && (
        <Input
          type="text"
          list="unit-suggestions"
          value={r.unit ?? ""}
          onChange={(e) => updateRate(idx, { unit: e.target.value || null })}
          placeholder={t("unitPlaceholder")}
          className="col-start-2 col-span-2 min-w-0 sm:w-32 sm:shrink-0"
          disabled={disabled}
          aria-label={t("unitAria")}
          maxLength={30}
        />
      )}
      <div className="relative col-start-2 col-span-2 min-w-0 sm:w-36 sm:shrink-0">
        <Input
          type="number"
          min="0"
          step="0.01"
          value={r.rate || ""}
          onChange={(e) => updateRate(idx, { rate: parseFloat(e.target.value) || 0 })}
          className="font-mono pe-12"
          disabled={disabled}
          placeholder="0.00"
        />
        <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-xs text-muted-foreground">
          {symbol}/{r.unit?.trim() || unit}
        </span>
      </div>
      <Button
        type="button"
        onClick={() => removeRate(idx)}
        variant="ghost"
        size="icon"
        className="col-start-3 row-start-1 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive sm:col-auto sm:row-auto"
        disabled={disabled}
        aria-label={t("remove")}
        title={t("remove")}
      >
        <span aria-hidden="true">✕</span>
      </Button>
      </div>
      {projects.length > 0 && (
        <div className="flex flex-col gap-1.5 ps-[3.25rem] sm:flex-row sm:items-center">
          <span className="shrink-0 text-xs text-muted-foreground">{t("rateScopeLabel")}</span>
          <SimpleSelect
            value={r.projectId ?? ""}
            onChange={(v) => setScope(idx, v || null)}
            disabled={disabled}
            aria-label={t("rateScopeAria")}
            className="min-h-11 w-full px-2 text-sm sm:w-auto sm:min-w-44"
            options={[
              { value: "", label: t("rateScopeAll") },
              ...projects.map((p) => ({ value: p.id, label: p.name })),
            ]}
          />
        </div>
      )}
    </div>
  );

  const sectionHeader = (title: string, addLabel: string, kind: RateKind) => (
    <div className="flex items-center justify-between">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</span>
      <Button
        type="button"
        onClick={() => addRate(kind)}
        variant="ghost"
        size="sm"
        className="text-primary hover:bg-primary/10 hover:text-primary"
        disabled={disabled}
      >
        {addLabel}
      </Button>
    </div>
  );

  return (
    <div className="divide-y divide-border rounded-[var(--radius)] border border-border bg-background/50">
      <datalist id="unit-suggestions">
        {tUnits("suggestions").split(",").map((u) => (
          <option key={u} value={u} />
        ))}
      </datalist>
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
