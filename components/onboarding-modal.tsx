"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { PROFESSIONS, getProfession } from "@/lib/professions";
import { ROUNDING_MODES } from "@/lib/rounding";
import { CURRENCY_SYMBOLS } from "@/lib/currency";
import { THEMES } from "@/lib/themes";
import { useTheme } from "@/components/theme-provider";
import { SimpleSelect } from "@/components/ui/simple-select";

const CURRENCY_OPTIONS = ["ILS", "USD", "EUR", "USDT", "BTC", "ETH"];

interface OnboardingModalProps {
  /** Called after a successful save or skip so the parent can hide the modal. */
  onDone: () => void;
}

export function OnboardingModal({ onDone }: OnboardingModalProps) {
  const t = useTranslations("Onboarding");
  const tRounding = useTranslations("Rounding");
  const { theme, setTheme } = useTheme();

  const [profession, setProfession] = useState<string>("other");
  const [currency, setCurrency] = useState<string>("ILS");
  const [rate, setRate] = useState<string>("");
  const [rounding, setRounding] = useState<string>("none");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Geo-suggested currency (suggestion only).
  useEffect(() => {
    let active = true;
    fetch("/api/geo")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (active && data?.suggestedCurrency) setCurrency(data.suggestedCurrency);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // Picking a profession prefills rounding (user can still change it).
  function chooseProfession(id: string) {
    setProfession(id);
    const preset = getProfession(id);
    if (preset) setRounding(preset.defaults.defaultBillingRounding);
  }

  const selectedPreset = useMemo(() => getProfession(profession), [profession]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    const parsedRate = rate.trim() === "" ? null : Number(rate);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          profession,
          defaultCurrency: currency,
          defaultRate: Number.isFinite(parsedRate as number) ? parsedRate : null,
          defaultBillingRounding: rounding,
          paymentTerms: selectedPreset?.defaults.paymentTerms ?? undefined,
          preferredPdfTemplate: selectedPreset?.defaults.preferredPdfTemplate,
          onboarded: true,
        }),
      });
      if (!res.ok) throw new Error("save failed");
      onDone();
    } catch {
      setError(t("saveError"));
      setSaving(false);
    }
  }

  async function handleSkip() {
    setSaving(true);
    setError(null);
    try {
      await fetch("/api/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ onboarded: true }),
      });
    } catch {
      // Best-effort: never trap a brand-new user behind this modal because the
      // "onboarded" flag failed to persist. Dismiss regardless — the worst case
      // is the modal shows again next load, which is recoverable; a locked-out
      // user is not.
    } finally {
      onDone();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-[var(--radius-card)] border border-border bg-card p-6 space-y-6">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-foreground">{t("title")}</h2>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>

        {/* Profession */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">{t("professionLabel")}</label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {PROFESSIONS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => chooseProfession(p.id)}
                className={`rounded-[var(--radius)] border p-3 text-start text-sm transition-colors ${
                  profession === p.id
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-surface text-muted-foreground hover:border-border-strong"
                }`}
              >
                <span className="block font-medium text-foreground">{t(`professions.${p.id}`)}</span>
                {p.modelHintHe && p.modelHintHe !== "—" ? (
                  <span className="block text-xs text-muted-foreground">{p.modelHintHe}</span>
                ) : null}
              </button>
            ))}
          </div>
        </div>

        {/* Currency + Rate */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="ob-currency" className="text-sm font-medium text-foreground">
              {t("currencyLabel")}
            </label>
            <SimpleSelect
              id="ob-currency"
              value={currency}
              onChange={setCurrency}
              options={CURRENCY_OPTIONS.map((c) => ({
                value: c,
                label: `${c} ${CURRENCY_SYMBOLS[c] ?? ""}`.trim(),
              }))}
            />
            <p className="text-xs text-muted-foreground">{t("currencyHint")}</p>
          </div>
          <div className="space-y-2">
            <label htmlFor="ob-rate" className="text-sm font-medium text-foreground">
              {t("rateLabel")}
            </label>
            <input
              id="ob-rate"
              type="number"
              inputMode="decimal"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              placeholder={t("ratePlaceholder")}
              className="w-full rounded-[var(--radius)] border border-border bg-surface px-3 py-2 text-foreground"
            />
          </div>
        </div>

        {/* Rounding */}
        <div className="space-y-2">
          <label htmlFor="ob-rounding" className="text-sm font-medium text-foreground">
            {t("roundingLabel")}
          </label>
          <SimpleSelect
            id="ob-rounding"
            value={rounding}
            onChange={setRounding}
            options={ROUNDING_MODES.map((m) => ({
              value: m,
              label: tRounding(m),
            }))}
          />
        </div>

        {/* Appearance (theme) — live preview via useTheme */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">{t("appearanceLabel")}</label>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {THEMES.map((th) => (
              <button
                key={th.id}
                type="button"
                onClick={() => setTheme(th.id)}
                aria-label={th.labelHe}
                className={`rounded-[var(--radius)] border p-1 ${
                  theme === th.id ? "border-primary" : "border-border hover:border-border-strong"
                }`}
              >
                <span className="flex h-6 overflow-hidden rounded-[6px]">
                  {th.swatch.map((c, i) => (
                    <span key={i} className="flex-1" style={{ backgroundColor: c }} />
                  ))}
                </span>
              </button>
            ))}
          </div>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleSkip}
            disabled={saving}
            className="text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            {t("skip")}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-[var(--radius)] bg-primary px-5 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {saving ? "…" : t("save")}
          </button>
        </div>
      </div>
    </div>
  );
}
