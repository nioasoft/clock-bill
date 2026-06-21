"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations, useLocale, NextIntlClientProvider } from "next-intl";
import { STATUS_META, type ChargeDocStatus } from "./statusMeta";
import { showSuccessToast, showErrorToast } from "@/lib/toast";
import { formatDate } from "@/lib/format";
import { formatCurrency } from "@/lib/currency";
import { resolveDocumentLocale, type DocumentLanguage } from "@/lib/document-language";
import { lineQtyRate, summarizeLines, documentMoney, type SummaryMode, type SummaryLine } from "@/lib/charge-documents";
import { ChargePaymentsPanel } from "./ChargePaymentsPanel";
import { useDocumentMessages } from "@/lib/document-messages";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { printPdfContent, type PdfTemplate, type OnColorText } from "./printStyles";
import { PdfChargeDocument } from "./PdfChargeDocument";

interface DocumentLine {
  id: string;
  source_type: string;
  time_entry_id: string | null;
  period_month: string | null;
  label: string;
  description: string | null;
  notes: string | null;
  item_ref: number | null;
  billing_kind: string;
  quantity: number | null;
  unit: string | null;
  rate: number | null;
  amount: number;
  project_name: string | null;
}

interface ChargeDocument {
  id: string;
  doc_number: number;
  status: string;
  currency: string;
  total: number;
  notes: string | null;
  issued_at: string;
  paid_at: string | null;
  client_name: string;
  pdf_template: string | null;
  /** Snapshotted document language at issuance ("he" | "en"); null on legacy docs. */
  document_language: string | null;
  /** The client's CURRENT document-language setting (for legacy-doc fallback). */
  client_document_language: string | null;
  /** VAT rate (%) snapshot, or null when no VAT applies. */
  vat_rate_snapshot: number | null;
  /** Optional summary grouping: 'project' | 'type' | null. */
  summary_mode: string | null;
  /** When the document was last emailed to the client (ISO timestamp), or null. */
  last_sent_at: string | null;
  /** The email address the document was last sent to, or null. */
  sent_to_email: string | null;
  /** The client's current email address (used as the send recipient suggestion). */
  client_email: string | null;
  /** Document-level discount type ('percent' | 'amount'), or null when none. */
  discount_type: string | null;
  /** Document-level discount value (percentage or absolute), or null when none. */
  discount_value: number | null;
}

/** Business-profile fields needed for the PDF header + template/colors. */
interface BusinessProfile {
  businessName: string | null;
  logoUrl: string | null;
  signatureUrl: string | null;
  taxId: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  showWebsiteOnDoc: boolean | null;
  bankName: string | null;
  bankBranch: string | null;
  bankAccountNumber: string | null;
  bankSwift: string | null;
  preferredPdfTemplate: string | null;
  pdfPrimaryColor: string | null;
  pdfAccentColor: string | null;
  pdfPrimaryText: string | null;
  pdfAccentText: string | null;
}

type LoadState = "loading" | "error" | "ready";

const KNOWN_TEMPLATES: readonly PdfTemplate[] = [
  "modern",
  "classic",
  "bold",
  "elegant",
  "nature",
  "ocean",
];

function asTemplate(value: string | null | undefined): PdfTemplate {
  return value && (KNOWN_TEMPLATES as readonly string[]).includes(value)
    ? (value as PdfTemplate)
    : "modern";
}

/** True for lines that came from an "item"-type time entry (have a reference number). */
function isItemLine(line: DocumentLine): boolean {
  return line.billing_kind === "item";
}

interface ChargeDocumentViewProps {
  documentId: string;
  onChanged?: () => void;
  onClose?: () => void;
  /** When true, prompt the user once (after load) to export a PDF — used right after issuing. */
  autoPromptPdf?: boolean;
}

/**
 * Detail view for a single internal settlement document. Read/edit/act on a
 * charge document depending on its status, with a print-to-PDF export.
 */
export default function ChargeDocumentView({
  documentId,
  onChanged,
  onClose,
  autoPromptPdf = false,
}: ChargeDocumentViewProps) {
  const t = useTranslations("Reports");
  const locale = useLocale();
  const [state, setState] = useState<LoadState>("loading");
  const [doc, setDoc] = useState<ChargeDocument | null>(null);
  const [lines, setLines] = useState<DocumentLine[]>([]);
  const [profile, setProfile] = useState<BusinessProfile | null>(null);

  // ── Document language (printed PDF) ──────────────────────────────────────
  // A SAVED charge document prints in the language SNAPSHOTTED at issuance.
  // Legacy docs (null snapshot) fall back to the client's resolved language.
  // A manual He/En toggle overrides per print WITHOUT mutating the snapshot.
  const snapshotLang = (doc?.document_language ?? null) as DocumentLanguage | null;
  const effectiveDefault: DocumentLanguage =
    snapshotLang ??
    resolveDocumentLocale(
      (doc?.client_document_language ?? null) as DocumentLanguage | null,
      doc?.currency || "ILS"
    );
  const [docLangOverride, setDocLangOverride] = useState<DocumentLanguage | null>(null);
  const docLocale: DocumentLanguage = docLangOverride ?? effectiveDefault;
  const docMessages = useDocumentMessages(docLocale);

  // Document-level notes draft (only editable while pending).
  const [notesDraft, setNotesDraft] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  // Summary-block grouping (only editable while pending; persisted on the doc).
  const [savingSummary, setSavingSummary] = useState(false);

  // Inline line editor: which line is open + its draft text.
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [lineDraft, setLineDraft] = useState<{ description: string; notes: string }>({
    description: "",
    notes: "",
  });
  const [savingLine, setSavingLine] = useState(false);

  // Confirm dialog: a single reusable destructive/neutral confirmation.
  const [confirm, setConfirm] = useState<{
    title: string;
    description: string;
    actionLabel: string;
    destructive: boolean;
    run: () => Promise<void>;
  } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const [actionBusy, setActionBusy] = useState(false);

  // Send-to-client state.
  const [sending, setSending] = useState(false);
  const [sendConfirmOpen, setSendConfirmOpen] = useState(false);
  const [noEmailNotice, setNoEmailNotice] = useState(false);

  // Post-issue PDF prompt: show a one-time "create PDF now?" dialog after the
  // document first loads. The ref guards against re-showing on later refetches.
  const [pdfPromptOpen, setPdfPromptOpen] = useState(false);
  const pdfPrompted = useRef(false);

  // Bumped to force a refetch after a mutation. The fetch lives in an effect
  // keyed on [documentId, reloadKey] with an `active` guard so an in-flight
  // response from a previous document/key never overwrites newer state.
  const [reloadKey, setReloadKey] = useState(0);
  const refetch = useCallback((): void => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await fetch(`/api/charge-documents/${documentId}`);
        const json = await res.json();
        if (!active) return;
        if (!res.ok || !json.success) {
          setState("error");
          return;
        }
        const document = json.data.document as ChargeDocument;
        setDoc(document);
        setLines(json.data.lines as DocumentLine[]);
        setNotesDraft(document.notes ?? "");
        setState("ready");
        // Offer a PDF export once, right after a freshly-issued doc loads.
        if (autoPromptPdf && !pdfPrompted.current) {
          pdfPrompted.current = true;
          setPdfPromptOpen(true);
        }
      } catch {
        if (active) setState("error");
      }
    })();
    return () => {
      active = false;
    };
  }, [documentId, reloadKey, autoPromptPdf]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await fetch("/api/reports/init");
        const json = await res.json();
        if (active && res.ok && json.success && json.profile) {
          setProfile(json.profile as BusinessProfile);
        }
      } catch {
        // Profile is optional — the PDF falls back to defaults without it.
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const isPending = doc?.status === "pending";
  const isPaid = doc?.status === "paid";
  const isCanceled = doc?.status === "canceled";

  const patchDocument = useCallback(
    async (body: Record<string, unknown>): Promise<boolean> => {
      const res = await fetch(`/api/charge-documents/${documentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        showErrorToast(json.message || t("doc.updateError"));
        return false;
      }
      refetch();
      onChanged?.();
      return true;
    },
    [documentId, refetch, onChanged, t]
  );

  const handleSaveNotes = useCallback(async (): Promise<void> => {
    if (!isPending) return;
    setSavingNotes(true);
    const ok = await patchDocument({ notes: notesDraft });
    if (ok) showSuccessToast(t("doc.notesSaved"));
    setSavingNotes(false);
  }, [isPending, notesDraft, patchDocument, t]);

  const handleSetSummary = useCallback(
    async (mode: SummaryMode | null): Promise<void> => {
      setSavingSummary(true);
      await patchDocument({ summaryMode: mode });
      setSavingSummary(false);
    },
    [patchDocument]
  );

  const startEditLine = useCallback((line: DocumentLine): void => {
    setEditingLineId(line.id);
    setLineDraft({ description: line.description ?? "", notes: line.notes ?? "" });
  }, []);

  const handleSaveLine = useCallback(
    async (lineId: string): Promise<void> => {
      setSavingLine(true);
      const ok = await patchDocument({
        editLine: {
          lineId,
          description: lineDraft.description,
          notes: lineDraft.notes,
        },
      });
      if (ok) {
        showSuccessToast(t("doc.lineUpdated"));
        setEditingLineId(null);
      }
      setSavingLine(false);
    },
    [lineDraft, patchDocument, t]
  );

  const requestRemoveLine = useCallback(
    (line: DocumentLine): void => {
      setConfirm({
        title: t("doc.removeLineTitle"),
        description: t("doc.removeLineBody", { label: line.label }),
        actionLabel: t("doc.removeLineAction"),
        destructive: true,
        run: async () => {
          const ok = await patchDocument({ removeLineId: line.id });
          if (ok) showSuccessToast(t("doc.lineRemoved"));
        },
      });
    },
    [patchDocument, t]
  );

  const postAction = useCallback(
    async (path: string, successMessage: string, closeAfter: boolean): Promise<void> => {
      setActionBusy(true);
      try {
        const res = await fetch(`/api/charge-documents/${documentId}/${path}`, {
          method: "POST",
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          showErrorToast(json.message || t("doc.actionFailed"));
          return;
        }
        showSuccessToast(successMessage);
        if (closeAfter) {
          onChanged?.();
          onClose?.();
        } else {
          refetch();
          onChanged?.();
        }
      } catch {
        showErrorToast(t("doc.actionFailed"));
      } finally {
        setActionBusy(false);
      }
    },
    [documentId, refetch, onChanged, onClose, t]
  );

  const handleDelete = useCallback(async (): Promise<void> => {
    setActionBusy(true);
    try {
      const res = await fetch(`/api/charge-documents/${documentId}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || !json.success) {
        showErrorToast(json.message || t("doc.deleteFailed"));
        return;
      }
      showSuccessToast(t("doc.deleted"));
      onChanged?.();
      onClose?.();
    } catch {
      showErrorToast(t("doc.deleteFailed"));
    } finally {
      setActionBusy(false);
    }
  }, [documentId, onChanged, onClose, t]);

  const handleSend = useCallback(async (): Promise<void> => {
    setSending(true);
    try {
      const res = await fetch(`/api/charge-documents/${documentId}/send`, { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setSendConfirmOpen(false);
        if (json.error_code === "CLIENT_HAS_NO_EMAIL") {
          setNoEmailNotice(true);
        } else {
          showErrorToast(json.message || t("doc.sendError"));
        }
        return;
      }
      setNoEmailNotice(false);
      showSuccessToast(t("doc.sendSuccess"));
      setSendConfirmOpen(false);
      refetch();
    } catch {
      setSendConfirmOpen(false);
      showErrorToast(t("doc.sendError"));
    } finally {
      setSending(false);
    }
  }, [documentId, t, refetch]);

  const runConfirm = useCallback(async (): Promise<void> => {
    if (!confirm) return;
    setConfirmBusy(true);
    try {
      await confirm.run();
    } finally {
      setConfirmBusy(false);
      setConfirm(null);
    }
  }, [confirm]);

  const handleExportPdf = useCallback((): void => {
    // Guard: the print routine clones `#pdf-content`, which only renders once
    // the document-language messages have loaded. Never print an empty subtree.
    if (!docMessages) return;
    const template = asTemplate(doc?.pdf_template ?? profile?.preferredPdfTemplate);
    const primary = profile?.pdfPrimaryColor || "#A8622D";
    const accent = profile?.pdfAccentColor || "#347B52";
    const primaryText: OnColorText = profile?.pdfPrimaryText === "dark" ? "dark" : "light";
    // Sanitize: collapse "/" and whitespace runs to "_" so it's a safe filename.
    const filename = `${t("doc.pdfFilenamePrefix")}_${doc?.doc_number ?? ""}_${doc?.client_name ?? ""}`
      .replace(/[/\s]+/g, "_")
      .trim();
    // Hebrew documents print RTL, English LTR — keyed on the DOCUMENT locale
    // (the snapshotted language / manual override), not the UI locale.
    printPdfContent(template, primary, accent, filename, docLocale === "he" ? "rtl" : "ltr", primaryText);
  }, [doc, profile, t, docLocale, docMessages]);

  // ── States ──────────────────────────────────────────────────────────────
  if (state === "loading") {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-5 w-32" />
        <div className="space-y-2 pt-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    );
  }

  if (state === "error" || !doc) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="text-foreground font-medium">{t("doc.loadErrorTitle")}</p>
        <p className="text-sm text-muted-foreground">{t("doc.loadErrorBody")}</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={refetch} className="min-h-[44px]">
            {t("actions.retry")}
          </Button>
          {onClose && (
            <Button variant="ghost" onClick={onClose} className="min-h-[44px]">
              {t("actions.back")}
            </Button>
          )}
        </div>
      </div>
    );
  }

  const status = STATUS_META[doc.status as ChargeDocStatus] ?? STATUS_META.pending;

  // Full money breakdown: net subtotal → discount → discounted net → VAT → gross.
  const money = documentMoney({
    total: doc.total,
    discountType: (doc.discount_type as "percent" | "amount" | null) ?? null,
    discountValue: doc.discount_value ?? null,
    vatRate: doc.vat_rate_snapshot,
  });
  const hasVat = doc.vat_rate_snapshot != null && doc.vat_rate_snapshot > 0;
  const hasDiscount = money.discountAmount > 0;

  // Optional summary groups (mirrors the printed PDF).
  const summaryMode =
    doc.summary_mode === "project" || doc.summary_mode === "type"
      ? (doc.summary_mode as SummaryMode)
      : null;
  const summary = summaryMode
    ? summarizeLines(lines as unknown as SummaryLine[], summaryMode)
    : [];

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold text-foreground">
              {t("documents.docNumber", { number: doc.doc_number })}
            </h2>
            <span
              className={`inline-flex items-center rounded-[var(--radius)] border px-2.5 py-0.5 text-xs font-medium ${status.badge}`}
            >
              {t(status.labelKey)}
            </span>
          </div>
          <p className="text-muted-foreground"><bdi>{doc.client_name}</bdi></p>
          <p className="text-sm text-muted-foreground">
            {t("doc.issuedOn", { date: formatDate(doc.issued_at, undefined, locale) })}
            {doc.paid_at ? ` · ${t("doc.paidOn", { date: formatDate(doc.paid_at, undefined, locale) })}` : ""}
          </p>
        </div>
        <div className="text-end">
          <div className="text-xs text-muted-foreground">{hasVat ? t("doc.totalDue") : t("doc.total")}</div>
          <div className="font-mono text-2xl font-bold tabular-nums text-foreground">
            {formatCurrency(money.gross, doc.currency, locale)}
          </div>
          <div className="text-xs text-muted-foreground">
            {hasVat
              ? t("doc.inclVatNote", { rate: Number((doc.vat_rate_snapshot as number).toFixed(2)) })
              : t("doc.noVatNote")}
          </div>
        </div>
      </div>

      {onClose && (
        <Button variant="ghost" onClick={onClose} className="min-h-[44px] -ms-2">
          {t("doc.backToList")}
        </Button>
      )}

      {isPaid && (
        <p className="rounded-[var(--radius)] border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          {t("doc.lockedNotice")}
        </p>
      )}

      {/* ── Summary (optional, grouped) ── */}
      {summaryMode && summary.length > 0 && (
        <div className="overflow-hidden rounded-[var(--radius-card)] border border-border">
          <div className="border-b border-border bg-card-elevated px-3 py-2 text-sm font-medium text-foreground">
            {t("doc.summaryHeading")}
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="px-3 py-2 text-start font-medium">
                  {summaryMode === "project" ? t("doc.summaryColProject") : t("doc.summaryColType")}
                </th>
                <th className="px-3 py-2 text-start font-medium">{t("doc.summaryColHours")}</th>
                <th className="px-3 py-2 text-end font-medium">{t("doc.colAmount")}</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((g, i) => (
                <tr key={g.key ?? `__none__${i}`} className="border-b border-border last:border-b-0">
                  <td className="px-3 py-2 text-foreground"><bdi>{g.key ?? t("doc.summaryNoProject")}</bdi></td>
                  <td className="px-3 py-2 font-mono tabular-nums text-muted-foreground">
                    {g.hours > 0 ? t("units.hoursMeasure", { hours: Number(g.hours.toFixed(2)) }) : "—"}
                  </td>
                  <td className="px-3 py-2 text-end font-mono tabular-nums text-foreground">
                    {formatCurrency(g.amount, doc.currency, locale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Lines ── */}
      <div className="overflow-hidden rounded-[var(--radius-card)] border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-card-elevated text-muted-foreground">
              <th className="px-3 py-2 text-start font-medium">{t("doc.colItem")}</th>
              <th className="px-3 py-2 text-start font-medium">{t("doc.colDetails")}</th>
              <th className="px-3 py-2 text-start font-medium">{t("doc.colQtyRate")}</th>
              <th className="px-3 py-2 text-end font-medium">{t("doc.colAmount")}</th>
              {isPending && <th className="px-3 py-2 text-end font-medium sr-only">{t("doc.colActions")}</th>}
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 && (
              <tr>
                <td colSpan={isPending ? 5 : 4} className="px-3 py-6 text-center text-muted-foreground">
                  {t("doc.noLines")}
                </td>
              </tr>
            )}
            {lines.map((line) => {
              const editing = editingLineId === line.id;
              return (
                <tr key={line.id} className="border-b border-border last:border-b-0 align-top">
                  <td className="px-3 py-3 text-foreground">
                    <bdi>{line.label}</bdi>
                    {isItemLine(line) && line.item_ref != null && (
                      <div className="text-xs text-muted-foreground">{t("units.ref", { ref: line.item_ref })}</div>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    {editing ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          aria-label={t("doc.lineDescriptionAria")}
                          value={lineDraft.description}
                          onChange={(e) =>
                            setLineDraft((d) => ({ ...d, description: e.target.value }))
                          }
                          placeholder={t("doc.descriptionPlaceholder")}
                          className="w-full rounded-[var(--radius)] border border-border bg-background px-2 py-1.5 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                        <input
                          type="text"
                          aria-label={t("doc.lineNoteAria")}
                          value={lineDraft.notes}
                          onChange={(e) =>
                            setLineDraft((d) => ({ ...d, notes: e.target.value }))
                          }
                          placeholder={t("doc.notePlaceholder")}
                          className="w-full rounded-[var(--radius)] border border-border bg-background px-2 py-1.5 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>
                    ) : (
                      <div>
                        <div className="text-foreground"><bdi>{line.description || "—"}</bdi></div>
                        {line.notes && (
                          <div className="text-xs text-muted-foreground"><bdi>{line.notes}</bdi></div>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">
                    {(() => {
                      const qr = lineQtyRate(line);
                      if (!qr) return "—";
                      return (
                        <span className="font-mono tabular-nums">
                          {qr.isHourly
                            ? t("units.hoursMeasure", { hours: Number(qr.qty.toFixed(2)) })
                            : <>{Number(qr.qty.toFixed(2))}{qr.unit ? <> <bdi>{qr.unit}</bdi></> : null}</>}
                          {" × "}
                          {formatCurrency(qr.rate, doc.currency, locale)}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-3 py-3 text-end font-mono tabular-nums text-foreground">
                    {formatCurrency(line.amount, doc.currency, locale)}
                  </td>
                  {isPending && (
                    <td className="px-3 py-3 text-end">
                      {editing ? (
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            onClick={() => void handleSaveLine(line.id)}
                            disabled={savingLine}
                            className="min-h-[44px]"
                          >
                            {savingLine ? t("actions.saving") : t("actions.save")}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingLineId(null)}
                            disabled={savingLine}
                            className="min-h-[44px]"
                          >
                            {t("actions.cancel")}
                          </Button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => startEditLine(line)}
                            className="min-h-[44px]"
                          >
                            {t("actions.edit")}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => requestRemoveLine(line)}
                            className="min-h-[44px] text-destructive hover:text-destructive"
                          >
                            {t("doc.removeLineAction")}
                          </Button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Totals breakdown (when VAT or discount applies) ── */}
      {(hasVat || hasDiscount) && (
        <div className="flex justify-end">
          <table className="text-sm">
            <tbody>
              <tr>
                <td className="px-3 py-1 text-end text-muted-foreground">{t("doc.subtotal")}</td>
                <td className="px-3 py-1 text-start font-mono tabular-nums text-foreground">
                  {formatCurrency(money.netSubtotal, doc.currency, locale)}
                </td>
              </tr>
              {hasDiscount && (
                <tr>
                  <td className="px-3 py-1 text-end text-muted-foreground">{t("doc.discount")}</td>
                  <td className="px-3 py-1 text-start font-mono tabular-nums text-foreground">
                    −{formatCurrency(money.discountAmount, doc.currency, locale)}
                  </td>
                </tr>
              )}
              {hasVat && (
                <tr>
                  <td className="px-3 py-1 text-end text-muted-foreground">
                    {t("doc.vat", { rate: Number((doc.vat_rate_snapshot as number).toFixed(2)) })}
                  </td>
                  <td className="px-3 py-1 text-start font-mono tabular-nums text-foreground">
                    {formatCurrency(money.vatAmount, doc.currency, locale)}
                  </td>
                </tr>
              )}
              <tr className="border-t border-border">
                <td className="px-3 py-1.5 text-end font-semibold text-foreground">{t("doc.totalDue")}</td>
                <td className="px-3 py-1.5 text-start font-mono font-bold tabular-nums text-foreground">
                  {formatCurrency(money.gross, doc.currency, locale)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* ── Payments panel (all non-canceled documents) ── */}
      {!isCanceled && (
        <ChargePaymentsPanel
          documentId={documentId}
          currency={doc.currency}
          locale={locale as "he" | "en"}
          onChanged={() => { refetch(); onChanged?.(); }}
        />
      )}

      {/* ── Document notes ── */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-foreground" htmlFor="doc-notes">
          {t("doc.notesLabel")}
        </label>
        {isPending ? (
          <div className="space-y-2">
            <textarea
              id="doc-notes"
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              rows={3}
              className="w-full rounded-[var(--radius)] border border-border bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder={t("doc.notesPlaceholder")}
            />
            <Button
              variant="outline"
              onClick={() => void handleSaveNotes()}
              disabled={savingNotes || notesDraft === (doc.notes ?? "")}
              className="min-h-[44px]"
            >
              {savingNotes ? t("actions.saving") : t("doc.saveNotes")}
            </Button>
          </div>
        ) : (
          <p className="text-muted-foreground">{doc.notes ? <bdi>{doc.notes}</bdi> : "—"}</p>
        )}
      </div>

      {/* ── Sent status ── */}
      {doc.last_sent_at && (
        <p className="text-xs text-muted-foreground">
          {t("doc.sentStatus", {
            date: new Date(doc.last_sent_at).toLocaleDateString(locale === "he" ? "he-IL" : "en-US"),
            email: doc.sent_to_email ?? "",
          })}
        </p>
      )}

      {/* ── Document-language toggle ── */}
      {/* Which language the printed PDF renders in. Defaults to the document's
          SNAPSHOTTED language; the He/En override applies per print only and
          does NOT mutate the saved snapshot. */}
      <div
        role="group"
        aria-label={t("documentLanguageToggle")}
        className="flex items-center gap-2"
      >
        <span className="text-sm text-muted-foreground">{t("documentLanguageToggle")}</span>
        <div className="flex items-center gap-1 rounded-[var(--radius)] border border-border p-1">
          <button
            type="button"
            onClick={() => setDocLangOverride("he")}
            aria-pressed={docLocale === "he"}
            className={`min-h-11 rounded-[var(--radius)] px-3 py-2 text-sm font-medium transition-colors ${
              docLocale === "he"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t("documentLanguageHe")}
          </button>
          <button
            type="button"
            onClick={() => setDocLangOverride("en")}
            aria-pressed={docLocale === "en"}
            className={`min-h-11 rounded-[var(--radius)] px-3 py-2 text-sm font-medium transition-colors ${
              docLocale === "en"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t("documentLanguageEn")}
          </button>
        </div>
      </div>

      {/* ── Summary-block control (pending only) ── */}
      {/* Whether the document opens with a grouped summary, and how it groups.
          Persisted on the document; the print PDF mirrors it. */}
      {isPending && (
        <div role="group" aria-label={t("doc.summaryToggle")} className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">{t("doc.summaryToggle")}</span>
          <div className="flex items-center gap-1 rounded-[var(--radius)] border border-border p-1">
            {([
              { value: null, label: t("doc.summaryNone") },
              { value: "project" as const, label: t("doc.summaryByProject") },
              { value: "type" as const, label: t("doc.summaryByType") },
            ]).map((opt) => {
              const active = (doc.summary_mode ?? null) === opt.value;
              return (
                <button
                  key={opt.value ?? "none"}
                  type="button"
                  onClick={() => void handleSetSummary(opt.value)}
                  disabled={savingSummary}
                  aria-pressed={active}
                  className={`min-h-11 rounded-[var(--radius)] px-3 py-2 text-sm font-medium transition-colors ${
                    active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Discount editor (pending or partial documents) ── */}
      {(isPending || doc.status === "partial") && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">{t("doc.discountLabel")}</span>
          <select
            aria-label={t("doc.discountType")}
            value={doc.discount_type ?? ""}
            onChange={(e) => {
              const type = e.target.value as "percent" | "amount" | "";
              if (!type) void patchDocument({ discount: null });
              else void patchDocument({ discount: { type, value: doc.discount_value ?? 0 } });
            }}
            className="rounded-[var(--radius)] border border-border bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">{t("doc.discountNone")}</option>
            <option value="percent">{t("doc.discountPercent")}</option>
            <option value="amount">{t("doc.discountAmount")}</option>
          </select>
          {doc.discount_type && (
            <input
              inputMode="decimal"
              defaultValue={doc.discount_value ?? 0}
              aria-label={t("doc.discountValue")}
              onBlur={(e) =>
                void patchDocument({
                  discount: {
                    type: doc.discount_type as "percent" | "amount",
                    value: Number(e.target.value) || 0,
                  },
                })
              }
              className="w-24 rounded-[var(--radius)] border border-border bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          )}
        </div>
      )}

      {/* ── Actions ── */}
      <div className="flex flex-wrap gap-3 border-t border-border pt-4">
        <Button
          onClick={handleExportPdf}
          variant="secondary"
          disabled={!docMessages}
          className="min-h-[44px]"
        >
          {t("doc.exportPdf")}
        </Button>

        {!isCanceled && (
          <Button
            variant="outline"
            className="min-h-[44px]"
            disabled={sending}
            onClick={() => setSendConfirmOpen(true)}
          >
            {sending ? "…" : doc.last_sent_at ? t("doc.resend") : t("doc.sendToClient")}
          </Button>
        )}

        {noEmailNotice && (
          <p className="w-full text-sm text-destructive">
            {t("doc.sendNoEmail")}
          </p>
        )}

        {isPending && (
          <Button
            variant="destructive"
            onClick={() =>
              setConfirm({
                title: t("doc.cancelDocTitle"),
                description: t("doc.cancelDocBody"),
                actionLabel: t("doc.cancelDocAction"),
                destructive: true,
                run: () => postAction("cancel", t("doc.docCanceled"), true),
              })
            }
            disabled={actionBusy}
            className="min-h-[44px]"
          >
            {t("doc.cancelDocAction")}
          </Button>
        )}

        {isCanceled && (
          <Button
            variant="ghost"
            onClick={() =>
              setConfirm({
                title: t("doc.deleteDocTitle"),
                description: t("doc.deleteDocBody"),
                actionLabel: t("doc.deleteDocAction"),
                destructive: true,
                run: handleDelete,
              })
            }
            disabled={actionBusy}
            className="min-h-[44px] text-destructive hover:text-destructive"
          >
            {t("doc.deleteDocAction")}
          </Button>
        )}
      </div>

      {/* ── Confirm dialog ── */}
      <Dialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirm?.title}</DialogTitle>
            <DialogDescription>{confirm?.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => setConfirm(null)}
              disabled={confirmBusy}
              className="min-h-[44px]"
            >
              {t("actions.cancel")}
            </Button>
            <Button
              variant={confirm?.destructive ? "destructive" : "default"}
              onClick={() => void runConfirm()}
              disabled={confirmBusy}
              className="min-h-[44px]"
            >
              {confirmBusy ? t("actions.working") : confirm?.actionLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Post-issue "export PDF now?" prompt (shown once) ── */}
      <Dialog open={pdfPromptOpen} onOpenChange={setPdfPromptOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("doc.pdfPromptTitle")}</DialogTitle>
            <DialogDescription>{t("doc.pdfPromptBody")}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => setPdfPromptOpen(false)}
              className="min-h-[44px]"
            >
              {t("doc.pdfPromptLater")}
            </Button>
            <Button
              onClick={() => {
                handleExportPdf();
                setPdfPromptOpen(false);
              }}
              className="min-h-[44px]"
            >
              {t("doc.pdfPromptConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Send to client confirm dialog ── */}
      <Dialog open={sendConfirmOpen} onOpenChange={setSendConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("doc.sendConfirmTitle")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-foreground">
            {t("doc.sendConfirmBody", { email: doc.client_email ?? doc.sent_to_email ?? "" })}
          </p>
          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              className="min-h-[44px]"
              onClick={() => setSendConfirmOpen(false)}
              disabled={sending}
            >
              {t("actions.cancel")}
            </Button>
            <Button
              className="min-h-[44px]"
              disabled={sending}
              onClick={() => void handleSend()}
            >
              {sending ? "…" : t("doc.sendConfirmAction")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Hidden PDF print block (light/print styling) ──
          Rendered under a nested provider in the DOCUMENT'S language (own
          useTranslations/useLocale). Cloned to <body> by the print routine.
          Gated on docMessages so the subtree is mounted before window.print()
          runs (same 3-layer guard as the ad-hoc report). */}
      {docMessages && (
        <NextIntlClientProvider locale={docLocale} messages={docMessages}>
          <PdfChargeDocument doc={doc} lines={lines} profile={profile} />
        </NextIntlClientProvider>
      )}
    </div>
  );
}
