"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { formatDate } from "@/lib/format";
import { formatCurrency } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import ChargeDocumentView from "./ChargeDocumentView";
import { STATUS_META, displayStatus } from "./statusMeta";

interface DocumentRow {
  id: string;
  doc_number: number;
  status: string;
  currency: string;
  total: number;
  gross: number;
  outstanding: number;
  issued_at: string;
  paid_at: string | null;
  canceled_at: string | null;
  approved_at: string | null;
  approved_by: string | null;
  client_name: string;
}

type LoadState = "loading" | "error" | "ready";

function StatusBadge({ status, approvedAt }: { status: string; approvedAt: string | null }) {
  const t = useTranslations("Reports");
  const meta = STATUS_META[displayStatus(status, approvedAt)];
  return (
    <span
      className={`inline-flex items-center rounded-[var(--radius)] border px-2.5 py-0.5 text-xs font-medium ${meta.badge}`}
    >
      {t(meta.labelKey)}
    </span>
  );
}

/** Status sort order: pending first, then partial, then paid, then canceled. */
const STATUS_ORDER: Record<string, number> = { pending: 0, partial: 1, paid: 2, canceled: 3 };

/** Pending → paid → canceled; within each group, newest doc_number first. */
function sortDocs(rows: DocumentRow[]): DocumentRow[] {
  return [...rows].sort((a, b) => {
    const sa = STATUS_ORDER[a.status] ?? 99;
    const sb = STATUS_ORDER[b.status] ?? 99;
    if (sa !== sb) return sa - sb;
    return b.doc_number - a.doc_number;
  });
}

interface DocumentsTabProps {
  /** Document id to auto-open on mount (freshly issued); prompts a PDF export. */
  initialOpenId?: string | null;
  /** Called once after the initialOpenId has been consumed (opened). */
  onConsumedInitialOpen?: () => void;
}

/**
 * History of issued internal settlement documents. Lists every document and
 * opens a full ChargeDocumentView (inline) on click.
 */
export default function DocumentsTab({
  initialOpenId,
  onConsumedInitialOpen,
}: DocumentsTabProps = {}) {
  const t = useTranslations("Reports");
  const locale = useLocale();
  const [state, setState] = useState<LoadState>("loading");
  const [docs, setDocs] = useState<DocumentRow[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  // True only for a doc opened via initialOpenId (freshly issued) — drives the PDF prompt.
  const [autoPrompt, setAutoPrompt] = useState(false);

  const load = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch("/api/charge-documents");
      const json = await res.json();
      if (!res.ok || !json.success) {
        setState("error");
        return;
      }
      setDocs(sortDocs(json.data as DocumentRow[]));
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

  // Auto-open a freshly-issued document once, then hand the flag back to the shell.
  useEffect(() => {
    if (!initialOpenId) return;
    // Synchronous state set guarded by a stable prop; runs only when a new id arrives.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpenId(initialOpenId);
    setAutoPrompt(true);
    onConsumedInitialOpen?.();
  }, [initialOpenId, onConsumedInitialOpen]);

  // ── Detail view (inline) ──────────────────────────────────────────────────
  if (openId) {
    return (
      <ChargeDocumentView
        documentId={openId}
        autoPromptPdf={autoPrompt}
        onChanged={() => void load()}
        onClose={() => {
          setOpenId(null);
          setAutoPrompt(false);
        }}
      />
    );
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (state === "loading") {
    return (
      <div className="space-y-3" role="status" aria-label={t("tabs.documents")} aria-busy="true">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-20 w-full rounded-[var(--radius-card)]" />
        ))}
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (state === "error") {
    return (
      <div className="flex flex-col items-center justify-center gap-3 p-8 text-center" role="alert">
        <p className="text-foreground font-medium">{t("documents.loadErrorTitle")}</p>
        <p className="text-sm text-muted-foreground">{t("documents.loadErrorBody")}</p>
        <Button variant="outline" onClick={retry} className="min-h-[44px]">
          {t("actions.retry")}
        </Button>
      </div>
    );
  }

  // ── Empty ─────────────────────────────────────────────────────────────────
  if (docs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 p-10 text-center">
        <p className="text-lg font-medium text-foreground">{t("documents.emptyTitle")}</p>
        <p className="text-sm text-muted-foreground max-w-sm">
          {t.rich("documents.emptyBody", {
            tab: (chunks) => <span className="text-foreground">{chunks}</span>,
          })}
        </p>
      </div>
    );
  }

  // ── Success ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3">
      {docs.map((d) => {
        const meta = STATUS_META[displayStatus(d.status, d.approved_at)];
        return (
        <button
          key={d.id}
          type="button"
          onClick={() => setOpenId(d.id)}
          className={`flex min-h-14 w-full flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card)] border border-border p-4 text-start transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${meta.surface}`}
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-foreground">{t("documents.docNumber", { number: d.doc_number })}</span>
              <StatusBadge status={d.status} approvedAt={d.approved_at} />
            </div>
            <div className="text-sm text-muted-foreground">
              <bdi>{d.client_name}</bdi> · {formatDate(d.issued_at, undefined, locale)}
            </div>
          </div>
          <div className="text-end">
            <div className="font-mono text-lg font-semibold tabular-nums text-foreground"><bdi>{formatCurrency(d.gross, d.currency, locale)}</bdi></div>
            {d.status === "partial" && (
              <div className="text-xs text-muted-foreground">
                <bdi>{t("doc.outstandingShort", { amount: formatCurrency(d.outstanding, d.currency, locale) })}</bdi>
              </div>
            )}
          </div>
        </button>
        );
      })}
    </div>
  );
}
