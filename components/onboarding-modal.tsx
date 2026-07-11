"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, LoaderCircle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { CURRENCY_SYMBOLS } from "@/lib/currency";
import { PROFESSIONS, getProfession } from "@/lib/professions";
import { ROUNDING_MODES } from "@/lib/rounding";
import { THEMES } from "@/lib/themes";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldMessage } from "@/components/ui/field-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SimpleSelect } from "@/components/ui/simple-select";

const CURRENCY_OPTIONS = ["ILS", "USD", "EUR", "USDT", "BTC", "ETH"];
const TOTAL_STEPS = 2;

interface OnboardingModalProps {
  /** Called after a successful save or skip so the parent can hide the modal. */
  onDone: () => void;
}

export function OnboardingModal({ onDone }: OnboardingModalProps) {
  const t = useTranslations("Onboarding");
  const tRounding = useTranslations("Rounding");
  const locale = useLocale();
  const { theme, setTheme } = useTheme();

  const [step, setStep] = useState(1);
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
      .then((response) => (response.ok ? response.json() : null))
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
  const selectedProfessionHint = selectedPreset
    ? locale === "he"
      ? selectedPreset.modelHintHe
      : selectedPreset.modelHintEn
    : null;
  const selectedTheme = THEMES.find((option) => option.id === theme);
  const selectedThemeLabel = selectedTheme
    ? locale === "he"
      ? selectedTheme.labelHe
      : selectedTheme.labelEn
    : "";

  async function handleSave(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setSaving(true);
    setError(null);
    const parsedRate = rate.trim() === "" ? null : Number(rate);
    try {
      const response = await fetch("/api/profile", {
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
      if (!response.ok) throw new Error("save failed");
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
      // Best-effort: never trap a brand-new user behind this flow because the
      // "onboarded" flag failed to persist. Dismiss regardless.
    } finally {
      onDone();
    }
  }

  return (
    <Dialog open>
      <DialogContent
        variant="sheet"
        showCloseButton={false}
        className="gap-0 sm:max-w-2xl"
        onEscapeKeyDown={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-xl">{t("title")}</DialogTitle>
          <DialogDescription>{t("subtitle")}</DialogDescription>
        </DialogHeader>

        <div className="mt-5 flex items-center gap-3">
          <div
            role="progressbar"
            aria-label={t("title")}
            aria-valuemin={1}
            aria-valuemax={TOTAL_STEPS}
            aria-valuenow={step}
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
          >
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-200"
              style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
            />
          </div>
          <span className="shrink-0 font-mono text-xs font-semibold tabular-nums text-muted-foreground" dir="ltr">
            {step} / {TOTAL_STEPS}
          </span>
        </div>

        <div className="mt-2 text-sm font-semibold text-foreground" aria-live="polite" aria-atomic="true">
          {step === 1 ? t("professionLabel") : t("currencyLabel")}
        </div>

        <form onSubmit={handleSave}>
          {step === 1 ? (
            <section className="mt-5 space-y-3 motion-safe:animate-fade-in">
              <Label htmlFor="ob-profession">{t("professionLabel")}</Label>
              <SimpleSelect
                id="ob-profession"
                value={profession}
                onChange={chooseProfession}
                options={PROFESSIONS.map((option) => ({
                  value: option.id,
                  label: t(`professions.${option.id}`),
                }))}
                aria-label={t("professionLabel")}
              />
              {selectedProfessionHint && selectedProfessionHint !== "—" ? (
                <div className="flex items-center gap-2 rounded-[var(--radius)] border border-primary/20 bg-primary/5 px-3 py-2.5 text-sm text-muted-foreground">
                  <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  <span>{selectedProfessionHint}</span>
                </div>
              ) : null}
            </section>
          ) : (
            <section className="mt-5 space-y-5 motion-safe:animate-fade-in">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="ob-currency">{t("currencyLabel")}</Label>
                  <SimpleSelect
                    id="ob-currency"
                    value={currency}
                    onChange={setCurrency}
                    options={CURRENCY_OPTIONS.map((option) => ({
                      value: option,
                      label: `${option} ${CURRENCY_SYMBOLS[option] ?? ""}`.trim(),
                    }))}
                    aria-label={t("currencyLabel")}
                  />
                  <FieldMessage>{t("currencyHint")}</FieldMessage>
                </div>

                <div>
                  <Label htmlFor="ob-rate">{t("rateLabel")}</Label>
                  <Input
                    id="ob-rate"
                    name="defaultRate"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="any"
                    autoComplete="off"
                    value={rate}
                    onChange={(event) => setRate(event.target.value)}
                    placeholder={t("ratePlaceholder")}
                    className="text-start tabular-nums"
                    dir="ltr"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="ob-rounding">{t("roundingLabel")}</Label>
                <SimpleSelect
                  id="ob-rounding"
                  value={rounding}
                  onChange={setRounding}
                  options={ROUNDING_MODES.map((option) => ({
                    value: option,
                    label: tRounding(option),
                  }))}
                  aria-label={t("roundingLabel")}
                />
              </div>

              <details className="group rounded-[var(--radius)] border border-border bg-surface/60">
                <summary className="flex min-h-11 cursor-pointer touch-manipulation list-none items-center justify-between gap-3 rounded-[var(--radius)] px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                  <span>{t("appearanceLabel")}</span>
                  <span className="text-xs text-muted-foreground">{selectedThemeLabel}</span>
                </summary>
                <div className="grid grid-cols-4 gap-2 border-t border-border p-3 sm:grid-cols-6">
                  {THEMES.map((option) => {
                    const label = locale === "he" ? option.labelHe : option.labelEn;
                    const selected = theme === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setTheme(option.id)}
                        aria-label={label}
                        aria-pressed={selected}
                        className={`min-h-11 touch-manipulation rounded-[var(--radius)] border p-1.5 transition-[border-color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                          selected
                            ? "border-primary shadow-[inset_0_0_0_1px_var(--color-primary)]"
                            : "border-border hover:border-border-strong"
                        }`}
                      >
                        <span className="flex h-7 overflow-hidden rounded-[calc(var(--radius)-2px)]" aria-hidden="true">
                          {option.swatch.map((color, index) => (
                            <span key={index} className="flex-1" style={{ backgroundColor: color }} />
                          ))}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </details>
            </section>
          )}

          {error ? <FieldMessage id="onboarding-error" variant="error">{error}</FieldMessage> : null}

          <DialogFooter className="mt-6 border-t border-border pt-4 sm:justify-between">
            <Button type="button" variant="ghost" onClick={handleSkip} disabled={saving}>
              {t("skip")}
            </Button>
            {step === 1 ? (
              <Button type="button" onClick={() => setStep(2)}>
                {t("currencyLabel")}
                <ArrowRight className="h-4 w-4 rtl:-scale-x-100" aria-hidden="true" />
              </Button>
            ) : (
              <div className="flex w-full gap-2 sm:w-auto">
                <Button type="button" variant="outline" onClick={() => setStep(1)} disabled={saving}>
                  <ArrowLeft className="h-4 w-4 rtl:-scale-x-100" aria-hidden="true" />
                  {t("professionLabel")}
                </Button>
                <Button type="submit" disabled={saving} aria-busy={saving}>
                  {saving ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                  {t("save")}
                </Button>
              </div>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
