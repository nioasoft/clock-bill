"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/src/i18n/navigation";

interface CurrencyTotal { currency: string; outstanding: number; amountLabel: string; }
type State = "loading" | "ready" | "error";

/** Dashboard section: per-currency total still open for collection. Renders
 *  null when nothing is outstanding so the section wrapper collapses. */
export function OpenForCollectionCard() {
  const t = useTranslations("Dashboard");
  const [state, setState] = useState<State>("loading");
  const [totals, setTotals] = useState<CurrencyTotal[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/charge-documents/outstanding");
        const json = await res.json();
        if (!active) return;
        if (!res.ok || !json.success) { setState("error"); return; }
        setTotals(json.data.totals as CurrencyTotal[]);
        setState("ready");
      } catch {
        if (active) setState("error");
      }
    })();
    return () => { active = false; };
  }, []);

  if (state === "loading") {
    return (
      <div className="bg-card border border-border/50 rounded-[var(--radius-card)] p-6">
        <div className="h-5 w-40 bg-muted rounded animate-pulse mb-4" />
        <div className="h-10 w-32 bg-muted rounded animate-pulse" />
      </div>
    );
  }
  if (state === "error") {
    return (
      <div className="bg-card border border-border/50 rounded-[var(--radius-card)] p-6">
        <h3 className="font-display text-xl font-semibold text-foreground mb-2">{t("openForCollection.title")}</h3>
        <p className="text-sm text-muted-foreground">{t("openForCollection.error")}</p>
      </div>
    );
  }
  if (totals.length === 0) return null;

  return (
    <div className="bg-card border border-border/50 rounded-[var(--radius-card)] p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-xl font-semibold text-foreground">{t("openForCollection.title")}</h3>
        <Link href="/reports" className="text-sm font-medium text-primary hover:underline min-h-[44px] flex items-center">
          {t("openForCollection.viewAll")}
        </Link>
      </div>
      <ul className="space-y-2">
        {totals.map((c) => (
          <li key={c.currency} className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{c.currency}</span>
            <span className="font-mono text-lg font-bold tabular-nums text-foreground">{c.amountLabel}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
