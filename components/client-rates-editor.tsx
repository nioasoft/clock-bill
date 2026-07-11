"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
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
  const editorId = useId();

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

  /** One labeled rate row. `showDefault` renders the client-default control. */
  const row = (r: ClientRateInput, idx: number, unit: string, showDefault: boolean) => (
    <div key={`${r.kind}-${idx}`} className="grid gap-3 border-t border-border py-4 first:border-t-0 lg:grid-cols-[6.5rem_minmax(10rem,1fr)_9rem_10rem_minmax(10rem,0.8fr)_3rem] lg:items-end">
      <div>
        <span className="mb-1.5 block text-xs font-medium text-muted-foreground lg:sr-only">{t("rateEditor.defaultColumn")}</span>
        {showDefault ? (
          <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-[var(--radius)] border border-border px-3 text-sm font-medium text-foreground hover:bg-muted">
            <input
              type="radio"
              name={`${editorId}-default-hourly`}
              checked={r.isDefault}
              onChange={() => setDefault(idx)}
              className="h-4 w-4 accent-primary"
              disabled={disabled || Boolean(r.projectId)}
            />
            {t("defaultBadge")}
          </label>
        ) : (
          <span className="flex min-h-11 items-center text-sm text-muted-foreground">{t("rateEditor.itemType")}</span>
        )}
      </div>

      <div>
        <label htmlFor={`${editorId}-${idx}-name`} className="mb-1.5 block text-xs font-medium text-muted-foreground lg:sr-only">{t("rateEditor.nameColumn")}</label>
        <Input
          id={`${editorId}-${idx}-name`}
          name={`rates.${idx}.name`}
          type="text"
          value={r.name}
          onChange={(e) => updateRate(idx, { name: e.target.value })}
          placeholder={showDefault ? t("rateNameHourlyPlaceholder") : t("rateNameItemPlaceholder")}
          disabled={disabled}
          maxLength={100}
        />
      </div>

      <div>
        <label htmlFor={`${editorId}-${idx}-unit`} className="mb-1.5 block text-xs font-medium text-muted-foreground lg:sr-only">{t("rateEditor.unitColumn")}</label>
        {showDefault ? (
          <span className="flex min-h-11 items-center rounded-[var(--radius)] border border-transparent px-3 text-sm text-muted-foreground">{t("unitHour")}</span>
        ) : (
          <Input
            id={`${editorId}-${idx}-unit`}
            name={`rates.${idx}.unit`}
            type="text"
            list={`${editorId}-unit-suggestions`}
            value={r.unit ?? ""}
            onChange={(e) => updateRate(idx, { unit: e.target.value || null })}
            placeholder={t("unitPlaceholder")}
            disabled={disabled}
            maxLength={30}
          />
        )}
      </div>

      <div>
        <label htmlFor={`${editorId}-${idx}-price`} className="mb-1.5 block text-xs font-medium text-muted-foreground lg:sr-only">{t("rateEditor.priceColumn")}</label>
        <div className="relative min-w-0">
          <Input
            id={`${editorId}-${idx}-price`}
            name={`rates.${idx}.rate`}
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={r.rate || ""}
            onChange={(e) => updateRate(idx, { rate: parseFloat(e.target.value) || 0 })}
            className="font-mono pe-12"
            disabled={disabled}
            placeholder="0.00"
          />
          <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-xs text-muted-foreground"><bdi>{symbol}/{r.unit?.trim() || unit}</bdi></span>
        </div>
      </div>

      <div>
        <span className="mb-1.5 block text-xs font-medium text-muted-foreground lg:sr-only">{t("rateEditor.scopeColumn")}</span>
        {projects.length > 0 ? (
          <SimpleSelect
            name={`rates.${idx}.projectId`}
            value={r.projectId ?? ""}
            onChange={(v) => setScope(idx, v || null)}
            disabled={disabled}
            aria-label={t("rateScopeAria")}
            className="min-h-11 w-full px-2 text-sm"
            options={[
              { value: "", label: t("rateScopeAll") },
              ...projects.map((p) => ({ value: p.id, label: p.name })),
            ]}
          />
        ) : (
          <span className="flex min-h-11 items-center text-sm text-muted-foreground">{t("rateScopeAll")}</span>
        )}
      </div>

      <Button
        type="button"
        onClick={() => removeRate(idx)}
        variant="ghost"
        size="icon"
        className="justify-self-end text-muted-foreground hover:bg-destructive/10 hover:text-destructive lg:justify-self-auto"
        disabled={disabled}
        aria-label={t("rateEditor.removeNamed", { name: r.name || t("rateEditor.unnamed") })}
        title={t("remove")}
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
      </Button>
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
    <div className="divide-y divide-border rounded-[var(--radius-card)] border border-border bg-background/30">
      <datalist id={`${editorId}-unit-suggestions`}>
        {tUnits("suggestions").split(",").map((u) => (
          <option key={u} value={u} />
        ))}
      </datalist>
      {/* Hourly rates */}
      <div className="space-y-3 p-4">
        {sectionHeader(t("hourlyRatesHeader"), t("addRate"), "hourly")}
        <div className="hidden grid-cols-[6.5rem_minmax(10rem,1fr)_9rem_10rem_minmax(10rem,0.8fr)_3rem] gap-3 border-t border-border pt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:grid">
          <span>{t("rateEditor.defaultColumn")}</span><span>{t("rateEditor.nameColumn")}</span><span>{t("rateEditor.unitColumn")}</span><span>{t("rateEditor.priceColumn")}</span><span>{t("rateEditor.scopeColumn")}</span><span className="sr-only">{t("colActions")}</span>
        </div>
        {hourly ? (
          <div className="space-y-1.5">
            {rates.map((r, idx) => (r.kind === "hourly" ? row(r, idx, t("unitHour"), true) : null))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">{t("noHourlyRates")}</p>
        )}
      </div>

      {/* Items (price per unit) */}
      <div className="space-y-3 p-4">
        {sectionHeader(t("itemsHeader"), t("addItem"), "item")}
        {items && (
          <div className="hidden grid-cols-[6.5rem_minmax(10rem,1fr)_9rem_10rem_minmax(10rem,0.8fr)_3rem] gap-3 border-t border-border pt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:grid">
            <span>{t("rateEditor.typeColumn")}</span><span>{t("rateEditor.nameColumn")}</span><span>{t("rateEditor.unitColumn")}</span><span>{t("rateEditor.priceColumn")}</span><span>{t("rateEditor.scopeColumn")}</span><span className="sr-only">{t("colActions")}</span>
          </div>
        )}
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
