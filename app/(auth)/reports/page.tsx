"use client";

import { useState } from "react";
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

        {tab === "billable" && <BillableTab onIssued={() => setTab("documents")} />}
        {tab === "documents" && <DocumentsTab />}
        {tab === "report" && <AdHocReportTab />}
      </PageContainer>
    </AppLayout>
  );
}
