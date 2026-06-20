"use client";

import { useTranslations } from "next-intl";
import { usePlan } from "@/hooks/use-plan";
import { getTrialPillView } from "@/lib/trial-view";
import { Button } from "@/components/ui/button";

interface TrialCardProps {
  onUpgrade: () => void;
}

/**
 * Dashboard card shown while the user has an active trial or immediately after
 * the trial ends while they're on the free tier. Returns null otherwise.
 */
export function TrialCard({ onUpgrade }: TrialCardProps) {
  const t = useTranslations("Trial");
  const { data } = usePlan();

  if (!data) return null;

  const { plan } = data;
  const view = getTrialPillView(plan.trial);

  const isTrialEnded =
    plan.trial !== null && plan.trial.active === false && plan.tier === "free";

  // Show only when trial is active OR trial just ended on free tier
  if (!view && !isTrialEnded) return null;

  const isActive = view !== null;
  const cardClasses = isActive
    ? "bg-primary/[0.06] border-primary/25"
    : "bg-warning/10 border-warning/30";

  return (
    <div
      className={`rounded-[var(--radius-card)] border p-5 sm:p-6 ${cardClasses}`}
    >
      <h3 className="font-semibold text-foreground mb-1">
        {isActive ? t("cardHeading") : t("endedHeading")}
      </h3>
      <p className="text-sm text-muted-foreground mb-4">
        {isActive
          ? t("cardBody", { days: view!.daysLeft })
          : t("endedBody", { limit: 1 })}
      </p>
      <Button onClick={onUpgrade}>{t("cardCta")}</Button>
    </div>
  );
}
