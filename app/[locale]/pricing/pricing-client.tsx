"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/src/i18n/navigation";
import { Check, ArrowRight, Loader2 } from "lucide-react";
import { authClient } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";

type Interval = "monthly" | "annual";
type Tier = "free" | "starter" | "unlimited";
type PaidTier = Exclude<Tier, "free">;

/** Static, USD list prices. Annual is billed once per year (≈20% off). */
const PRICE: Record<PaidTier, Record<Interval, string>> = {
  starter: { monthly: "$7", annual: "$67" },
  unlimited: { monthly: "$14", annual: "$134" },
};

/** Feature keys per tier (resolved against the `Pricing.features` namespace). */
const FEATURES: Record<Tier, string[]> = {
  free: ["clients1", "allFeatures", "noLimits"],
  starter: ["clients5", "allFeatures", "noLimits"],
  unlimited: ["clientsUnlimited", "allFeatures", "noLimits"],
};

const PAID_TIERS: PaidTier[] = ["starter", "unlimited"];

/**
 * Interactive pricing UI: interval toggle, three plan cards, and an EU consent
 * gate that must be ticked before any paid checkout. Slugs are
 * `${tier}-${interval}` (e.g. `starter-annual`) per the Polar product map.
 */
export function PricingClient() {
  const t = useTranslations("Pricing");
  const [interval, setInterval] = useState<Interval>("annual");
  const [consent, setConsent] = useState(false);
  const [currentTier, setCurrentTier] = useState<Tier | null>(null);
  const [error, setError] = useState("");
  const [busyTier, setBusyTier] = useState<PaidTier | null>(null);

  useEffect(() => {
    fetch("/api/account/plan")
      .then((r) => r.json())
      .then((d) => {
        if (d?.success && d.plan?.tier) setCurrentTier(d.plan.tier as Tier);
      })
      .catch(() => {
        /* Unauthenticated / network error → no current tier; CTAs still work. */
      });
  }, []);

  async function upgrade(tier: PaidTier) {
    if (!consent) {
      setError(t("consentRequired"));
      return;
    }
    setBusyTier(tier);
    setError("");
    try {
      // The Polar plugin redirects the browser to hosted checkout.
      await authClient.checkout({ slug: `${tier}-${interval}` });
    } catch {
      setError(t("checkoutError"));
      setBusyTier(null);
    }
  }

  async function manage() {
    setError("");
    try {
      await authClient.customer.portal();
    } catch {
      setError(t("checkoutError"));
    }
  }

  const priceSuffix = interval === "annual" ? t("perYear") : t("perMonth");

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowRight className="h-4 w-4 rtl:-scale-x-100" />
          {t("title")}
        </Link>

        <header className="mt-8 mb-10 text-center">
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {t("title")}
          </h1>
          <p className="mt-3 text-muted-foreground leading-relaxed">
            {t("subtitle")}
          </p>
        </header>

        {/* Interval toggle */}
        <div className="mb-10 flex justify-center">
          <div
            role="group"
            className="inline-flex items-center gap-1 rounded-[var(--radius)] border border-border bg-card p-1"
          >
            <button
              type="button"
              onClick={() => setInterval("monthly")}
              aria-pressed={interval === "monthly"}
              className={`rounded-[calc(var(--radius)-2px)] px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                interval === "monthly"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t("monthly")}
            </button>
            <button
              type="button"
              onClick={() => setInterval("annual")}
              aria-pressed={interval === "annual"}
              className={`inline-flex items-center gap-2 rounded-[calc(var(--radius)-2px)] px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                interval === "annual"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t("annual")}
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  interval === "annual"
                    ? "bg-primary-foreground/15 text-primary-foreground"
                    : "bg-success/15 text-success"
                }`}
              >
                {t("annualSave")}
              </span>
            </button>
          </div>
        </div>

        {/* Plan cards */}
        <div className="grid gap-6 md:grid-cols-3">
          {/* Free */}
          <PlanCard
            name={t("free.name")}
            tagline={t("free.tagline")}
            price={t("free.price")}
            priceSuffix=""
            featureKeys={FEATURES.free}
            t={t}
            isCurrent={currentTier === "free"}
            highlight={false}
          >
            <Button variant="outline" className="w-full" disabled>
              {currentTier === "free" ? t("currentPlan") : t("free.cta")}
            </Button>
          </PlanCard>

          {/* Paid tiers */}
          {PAID_TIERS.map((tier) => {
            const isCurrent = currentTier === tier;
            const busy = busyTier === tier;
            return (
              <PlanCard
                key={tier}
                name={t(`${tier}.name`)}
                tagline={t(`${tier}.tagline`)}
                price={PRICE[tier][interval]}
                priceSuffix={priceSuffix}
                featureKeys={FEATURES[tier]}
                t={t}
                isCurrent={isCurrent}
                highlight={tier === "unlimited"}
              >
                {isCurrent ? (
                  <div className="space-y-2">
                    <p className="text-center text-sm font-medium text-primary">
                      {t("currentPlan")}
                    </p>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={manage}
                    >
                      {t("manage")}
                    </Button>
                  </div>
                ) : (
                  <Button
                    className="w-full"
                    disabled={!consent || busy}
                    onClick={() => upgrade(tier)}
                  >
                    {busy && (
                      <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden />
                    )}
                    {t(`${tier}.cta`)}
                  </Button>
                )}
              </PlanCard>
            );
          })}
        </div>

        {/* EU consent gate + disclosures (once for the page) */}
        <div className="mx-auto mt-10 max-w-2xl space-y-4">
          <label className="flex cursor-pointer items-start gap-3 rounded-[var(--radius-card)] border border-border bg-card p-4 text-sm text-foreground">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => {
                setConsent(e.target.checked);
                if (e.target.checked) setError("");
              }}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <span className="leading-relaxed">{t("consent")}</span>
          </label>

          {error && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          )}

          <p className="text-xs leading-relaxed text-muted-foreground">
            {t("mor")}
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {t("renews")}
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {t.rich("agree", {
              terms: (chunks) => (
                <Link
                  href="/terms"
                  className="text-primary underline underline-offset-2 hover:text-primary/80"
                >
                  {chunks}
                </Link>
              ),
              privacy: (chunks) => (
                <Link
                  href="/privacy"
                  className="text-primary underline underline-offset-2 hover:text-primary/80"
                >
                  {chunks}
                </Link>
              ),
            })}
          </p>
        </div>
      </div>
    </main>
  );
}

type PlanCardProps = {
  name: string;
  tagline: string;
  price: string;
  priceSuffix: string;
  featureKeys: string[];
  t: ReturnType<typeof useTranslations<"Pricing">>;
  isCurrent: boolean;
  highlight: boolean;
  children: React.ReactNode;
};

function PlanCard({
  name,
  tagline,
  price,
  priceSuffix,
  featureKeys,
  t,
  isCurrent,
  highlight,
  children,
}: PlanCardProps) {
  return (
    <div
      className={`flex flex-col rounded-[var(--radius-card)] border bg-card p-6 ${
        highlight ? "border-primary" : "border-border"
      } ${isCurrent ? "ring-1 ring-primary" : ""}`}
    >
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-foreground">{name}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{tagline}</p>
      </div>

      <div className="mb-6 flex items-baseline gap-1">
        <span className="font-mono text-3xl font-bold tabular-nums text-foreground">
          {price}
        </span>
        {priceSuffix && (
          <span className="text-sm text-muted-foreground">{priceSuffix}</span>
        )}
      </div>

      <ul className="mb-6 flex-1 space-y-3">
        {featureKeys.map((key) => (
          <li
            key={key}
            className="flex items-start gap-2 text-sm text-foreground"
          >
            <Check
              className="mt-0.5 h-4 w-4 shrink-0 text-primary"
              aria-hidden
            />
            <span className="leading-relaxed">{t(`features.${key}`)}</span>
          </li>
        ))}
      </ul>

      <div className="mt-auto">{children}</div>
    </div>
  );
}
