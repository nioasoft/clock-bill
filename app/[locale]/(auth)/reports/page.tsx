"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { AppLayout } from "@/components/app-layout";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { Tabs } from "@/components/ui/tabs";
import AdHocReportTab from "./AdHocReportTab";
import BillableTab from "./BillableTab";
import DocumentsTab from "./DocumentsTab";

type Tab = "billable" | "documents" | "report";
type BillingStage = "client" | "work" | "document" | "payment";

const TAB_KEYS: [Tab, string][] = [
  ["billable", "tabs.billable"],
  ["documents", "tabs.documents"],
  ["report", "tabs.report"],
];

export default function SettlementPage() {
  const t = useTranslations("Reports");
  const [tab, setTab] = useState<Tab>("billable");
  // Set when a document is freshly issued so the documents tab auto-opens it
  // (and prompts for a PDF). Cleared once the documents tab consumes it.
  const [openDocId, setOpenDocId] = useState<string | null>(null);
  const [billingStage, setBillingStage] = useState<BillingStage>("client");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search);
    const requestedTab = p.get("tab");
    if (requestedTab === "billable" || requestedTab === "documents" || requestedTab === "report") {
      queueMicrotask(() => setTab(requestedTab));
    } else if (p.has("clientId") || p.has("projectId") || p.has("startDate") || p.has("endDate")) {
      // Intentional one-time, URL-driven tab selection on mount. Using an effect
      // (not a lazy useState initializer) avoids an SSR hydration mismatch on shared links.
      queueMicrotask(() => setTab("report"));
    }
  }, []);

  const changeTab = useCallback((next: Tab) => {
    setTab(next);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", next);
    window.history.replaceState({}, "", `${url.pathname}${url.search}`);
  }, []);

  const activeStage: BillingStage = tab === "documents" ? "document" : billingStage;
  const stageOrder: BillingStage[] = ["client", "work", "document", "payment"];
  const activeStageIndex = stageOrder.indexOf(activeStage);

  return (
    <AppLayout>
      <PageContainer>
        <PageHeader title={t("pageTitle")} />

        {tab !== "report" && (
          <ol
            aria-label={t("workflow.ariaLabel")}
            className="mb-5 grid grid-cols-4 gap-1 rounded-[var(--radius-card)] border border-border bg-card p-1.5 sm:gap-2 sm:p-2"
          >
            {stageOrder.map((stage, index) => {
              const current = index === activeStageIndex;
              const complete = index < activeStageIndex;
              return (
                <li
                  key={stage}
                  aria-current={current ? "step" : undefined}
                  className={`flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-[var(--radius)] px-2 py-2 text-xs font-semibold sm:text-sm ${
                    current
                      ? "bg-primary text-primary-foreground"
                      : complete
                        ? "bg-success/10 text-success"
                        : "text-muted-foreground"
                  }`}
                >
                  <span aria-hidden="true" className="font-mono tabular-nums">{complete ? "✓" : index + 1}</span>
                  <span className="truncate">{t(`workflow.${stage}`)}</span>
                </li>
              );
            })}
          </ol>
        )}

        {/* Tab bar */}
        <div className="mb-6">
          <Tabs
            ariaLabel={t("pageTitle")}
            active={tab}
            onChange={(k) => changeTab(k as Tab)}
            tabs={TAB_KEYS.map(([key, labelKey]) => ({ key, label: t(labelKey) }))}
          />
        </div>

        {tab === "billable" && (
          <BillableTab
            onProgress={setBillingStage}
            onIssued={(id) => {
              setOpenDocId(id);
              setBillingStage("document");
              changeTab("documents");
            }}
          />
        )}
        {tab === "documents" && (
          <DocumentsTab
            initialOpenId={openDocId}
            onConsumedInitialOpen={() => setOpenDocId(null)}
          />
        )}
        {tab === "report" && <AdHocReportTab />}
      </PageContainer>
    </AppLayout>
  );
}
