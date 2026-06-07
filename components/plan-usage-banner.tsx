"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/src/i18n/navigation";

interface PlanUsageBannerProps {
  /** Active client count from /api/clients. */
  active: number;
  /** Plan cap; null = unlimited. */
  limit: number | null;
}

/**
 * Compact plan-usage indicator for the clients page. Shows "X of Y clients"
 * and, when at the cap, an upgrade CTA. Pure presentational — data comes from
 * the /api/clients `plan` field.
 */
export function PlanUsageBanner({ active, limit }: PlanUsageBannerProps) {
  const t = useTranslations("Clients.usage");
  const atLimit = limit !== null && active >= limit;

  return (
    <div className="flex items-center gap-3 rounded-[var(--radius)] border border-border bg-card px-3 py-2 text-sm">
      <span className={atLimit ? "text-destructive" : "text-muted-foreground"}>
        {limit === null
          ? t("unlimited", { active })
          : t("count", { active, limit })}
      </span>
      {atLimit && (
        <>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">{t("atLimit")}</span>
          <Link
            href="/settings"
            className="font-medium text-primary hover:text-primary/80"
          >
            {t("upgrade")}
          </Link>
        </>
      )}
    </div>
  );
}
