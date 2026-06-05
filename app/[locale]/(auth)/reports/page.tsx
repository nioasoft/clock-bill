"use client";

import { useEffect, useState } from "react";
import { AppLayout } from "@/components/app-layout";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import AdHocReportTab from "./AdHocReportTab";
import BillableTab from "./BillableTab";
import DocumentsTab from "./DocumentsTab";

type Tab = "billable" | "documents" | "report";

const TABS: [Tab, string][] = [
  ["billable", "לחיוב"],
  ["documents", "תעודות"],
  ["report", "דוח חד-פעמי"],
];

export default function SettlementPage() {
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
        <PageHeader title="התחשבנות" />

        {/* Tab bar */}
        <div className="flex gap-2 border-b border-border mb-6">
          {TABS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`min-h-[44px] px-4 rounded-t-[var(--radius)] transition-colors ${
                tab === key
                  ? "bg-card text-foreground border border-border border-b-card"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
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
