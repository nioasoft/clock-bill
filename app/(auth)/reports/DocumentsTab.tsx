"use client";

import { useCallback, useEffect, useState } from "react";
import { formatDate } from "@/lib/format";
import { formatCurrency } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import ChargeDocumentView from "./ChargeDocumentView";
import { STATUS_META, type ChargeDocStatus } from "./statusMeta";

interface DocumentRow {
  id: string;
  doc_number: number;
  status: string;
  currency: string;
  total: number;
  issued_at: string;
  paid_at: string | null;
  canceled_at: string | null;
  client_name: string;
}

type LoadState = "loading" | "error" | "ready";

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status as ChargeDocStatus] ?? STATUS_META.pending;
  return (
    <span
      className={`inline-flex items-center rounded-[var(--radius)] border px-2.5 py-0.5 text-xs font-medium ${meta.badge}`}
    >
      {meta.label}
    </span>
  );
}

/**
 * History of issued internal settlement documents. Lists every document and
 * opens a full ChargeDocumentView (inline) on click.
 */
export default function DocumentsTab() {
  const [state, setState] = useState<LoadState>("loading");
  const [docs, setDocs] = useState<DocumentRow[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch("/api/charge-documents");
      const json = await res.json();
      if (!res.ok || !json.success) {
        setState("error");
        return;
      }
      setDocs(json.data as DocumentRow[]);
      setState("ready");
    } catch {
      setState("error");
    }
  }, []);

  // Manual retry: reset to the loading skeleton, then refetch.
  const retry = useCallback((): void => {
    setState("loading");
    void load();
  }, [load]);

  useEffect(() => {
    // load() only setState()s after an awaited fetch (not synchronously), so it
    // does not cause the cascading-render problem the rule guards against.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  // ── Detail view (inline) ──────────────────────────────────────────────────
  if (openId) {
    return (
      <ChargeDocumentView
        documentId={openId}
        onChanged={() => void load()}
        onClose={() => setOpenId(null)}
      />
    );
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (state === "loading") {
    return (
      <div className="space-y-3" dir="rtl">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-20 w-full rounded-[var(--radius-card)]" />
        ))}
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (state === "error") {
    return (
      <div className="flex flex-col items-center justify-center gap-3 p-8 text-center" dir="rtl">
        <p className="text-foreground font-medium">לא הצלחנו לטעון את התעודות</p>
        <p className="text-sm text-muted-foreground">אירעה תקלה בטעינת הנתונים.</p>
        <Button variant="outline" onClick={retry} className="min-h-[44px]">
          נסה שוב
        </Button>
      </div>
    );
  }

  // ── Empty ─────────────────────────────────────────────────────────────────
  if (docs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 p-10 text-center" dir="rtl">
        <p className="text-lg font-medium text-foreground">עדיין לא הפקת תעודות</p>
        <p className="text-sm text-muted-foreground max-w-sm">
          הפק תעודת התחשבנות מתוך לשונית <span className="text-foreground">לחיוב</span> והיא תופיע כאן.
        </p>
      </div>
    );
  }

  // ── Success ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3" dir="rtl">
      {docs.map((d) => (
        <button
          key={d.id}
          type="button"
          onClick={() => setOpenId(d.id)}
          className="flex w-full min-h-[44px] flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card)] border border-border bg-card p-4 text-start transition-colors hover:bg-card-elevated focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-foreground">תעודה #{d.doc_number}</span>
              <StatusBadge status={d.status} />
            </div>
            <div className="text-sm text-muted-foreground">
              {d.client_name} · {formatDate(d.issued_at)}
            </div>
          </div>
          <div className="font-mono text-lg font-semibold tabular-nums text-foreground">
            {formatCurrency(d.total, d.currency)}
          </div>
        </button>
      ))}
    </div>
  );
}
