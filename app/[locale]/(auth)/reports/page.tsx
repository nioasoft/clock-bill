"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { AppLayout } from "@/components/app-layout";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { Tabs } from "@/components/ui/tabs";
import AdHocReportTab from "./AdHocReportTab";
import BillableTab from "./BillableTab";
import DocumentsTab from "./DocumentsTab";

type Tab = "billable" | "documents" | "report";

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

  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search);
    if (p.has("clientId") || p.has("projectId") || p.has("startDate") || p.has("endDate")) {
      // Intentional one-time, URL-driven tab selection on mount. Using an effect
      // (not a lazy useState initializer) avoids an SSR hydration mismatch on shared links.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTab("report");
    }
  }, []);

  return (
    <AppLayout>
      <PageContainer>
        <PageHeader title={t("pageTitle")} />

        {/* Tab bar */}
        <div className="mb-6">
          <Tabs
            ariaLabel={t("pageTitle")}
            active={tab}
            onChange={(k) => setTab(k as Tab)}
            tabs={TAB_KEYS.map(([key, labelKey]) => ({ key, label: t(labelKey) }))}
          />
        </div>

        {tab === "billable" && (
          <BillableTab
            onIssued={(id) => {
              setOpenDocId(id);
              setTab("documents");
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
