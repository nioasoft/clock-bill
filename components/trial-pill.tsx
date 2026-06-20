"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/src/i18n/navigation";
import { usePlan } from "@/hooks/use-plan";
import { getTrialPillView } from "@/lib/trial-view";

/**
 * A compact pill shown in the sidebar (and wherever else) while the user has
 * an active trial. Clickable — links to the pricing page to upgrade. Returns
 * null when there is no active trial to display.
 */
export function TrialPill() {
  const t = useTranslations("Trial");
  const { data } = usePlan();

  if (!data) return null;

  const view = getTrialPillView(data.plan.trial);
  if (!view) return null;

  const endingClasses =
    "bg-warning/15 text-warning border border-warning/30";
  const activeClasses =
    "bg-primary/[0.06] text-primary border border-primary/25";

  return (
    <Link
      href="/pricing"
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        view.ending ? endingClasses : activeClasses
      }`}
    >
      {view.ending
        ? t("pillEnding", { days: view.daysLeft })
        : t("pillActive", { days: view.daysLeft })}
    </Link>
  );
}
