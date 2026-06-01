"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { STATUS_META, type ChargeDocStatus } from "./statusMeta";
import { showSuccessToast, showErrorToast } from "@/lib/toast";
import { formatDate } from "@/lib/format";
import { formatCurrency } from "@/lib/currency";
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
import { printPdfContent, type PdfTemplate } from "./printStyles";

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
  rate: number | null;
  amount: number;
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
}

/** Business-profile fields needed for the PDF header + template/colors. */
interface BusinessProfile {
  businessName: string | null;
  logoUrl: string | null;
  taxId: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  preferredPdfTemplate: string | null;
  pdfPrimaryColor: string | null;
  pdfAccentColor: string | null;
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

/** True for lines that came from an "item"-type time entry (have an אסמכתא). */
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
  const [state, setState] = useState<LoadState>("loading");
  const [doc, setDoc] = useState<ChargeDocument | null>(null);
  const [lines, setLines] = useState<DocumentLine[]>([]);
  const [profile, setProfile] = useState<BusinessProfile | null>(null);

  // Document-level notes draft (only editable while pending).
  const [notesDraft, setNotesDraft] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

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
        showErrorToast(json.message || "שגיאה בעדכון תעודה");
        return false;
      }
      refetch();
      onChanged?.();
      return true;
    },
    [documentId, refetch, onChanged]
  );

  const handleSaveNotes = useCallback(async (): Promise<void> => {
    if (!isPending) return;
    setSavingNotes(true);
    const ok = await patchDocument({ notes: notesDraft });
    if (ok) showSuccessToast("ההערות נשמרו");
    setSavingNotes(false);
  }, [isPending, notesDraft, patchDocument]);

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
        showSuccessToast("השורה עודכנה");
        setEditingLineId(null);
      }
      setSavingLine(false);
    },
    [lineDraft, patchDocument]
  );

  const requestRemoveLine = useCallback(
    (line: DocumentLine): void => {
      setConfirm({
        title: "הסרת שורה",
        description: `להסיר את "${line.label}" מהתעודה? פריט שמקורו ברישום זמן יחזור לרשימת הפריטים לחיוב.`,
        actionLabel: "הסר",
        destructive: true,
        run: async () => {
          const ok = await patchDocument({ removeLineId: line.id });
          if (ok) showSuccessToast("השורה הוסרה");
        },
      });
    },
    [patchDocument]
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
          showErrorToast(json.message || "הפעולה נכשלה");
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
        showErrorToast("הפעולה נכשלה");
      } finally {
        setActionBusy(false);
      }
    },
    [documentId, refetch, onChanged, onClose]
  );

  const handleDelete = useCallback(async (): Promise<void> => {
    setActionBusy(true);
    try {
      const res = await fetch(`/api/charge-documents/${documentId}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || !json.success) {
        showErrorToast(json.message || "מחיקה נכשלה");
        return;
      }
      showSuccessToast("התעודה נמחקה");
      onChanged?.();
      onClose?.();
    } catch {
      showErrorToast("מחיקה נכשלה");
    } finally {
      setActionBusy(false);
    }
  }, [documentId, onChanged, onClose]);

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
    const template = asTemplate(doc?.pdf_template ?? profile?.preferredPdfTemplate);
    const primary = profile?.pdfPrimaryColor || "#A8622D";
    const accent = profile?.pdfAccentColor || "#347B52";
    // Sanitize: collapse "/" and whitespace runs to "_" so it's a safe filename.
    const filename = `תעודה_${doc?.doc_number ?? ""}_${doc?.client_name ?? ""}`
      .replace(/[/\s]+/g, "_")
      .trim();
    printPdfContent(template, primary, accent, filename);
  }, [doc, profile]);

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
      <div className="flex flex-col items-center justify-center gap-3 p-8 text-center" dir="rtl">
        <p className="text-foreground font-medium">לא הצלחנו לטעון את התעודה</p>
        <p className="text-sm text-muted-foreground">ייתכן שהיא נמחקה או שאירעה תקלה.</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={refetch} className="min-h-[44px]">
            נסה שוב
          </Button>
          {onClose && (
            <Button variant="ghost" onClick={onClose} className="min-h-[44px]">
              חזרה
            </Button>
          )}
        </div>
      </div>
    );
  }

  const status = STATUS_META[doc.status as ChargeDocStatus] ?? STATUS_META.pending;

  return (
    <div dir="rtl" className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold text-foreground">
              תעודה #{doc.doc_number}
            </h2>
            <span
              className={`inline-flex items-center rounded-[var(--radius)] border px-2.5 py-0.5 text-xs font-medium ${status.badge}`}
            >
              {status.label}
            </span>
          </div>
          <p className="text-muted-foreground">{doc.client_name}</p>
          <p className="text-sm text-muted-foreground">
            הופקה: {formatDate(doc.issued_at)}
            {doc.paid_at ? ` · שולם: ${formatDate(doc.paid_at)}` : ""}
          </p>
        </div>
        <div className="text-end">
          <div className="text-xs text-muted-foreground">סה״כ</div>
          <div className="font-mono text-2xl font-bold tabular-nums text-foreground">
            {formatCurrency(doc.total, doc.currency)}
          </div>
        </div>
      </div>

      {onClose && (
        <Button variant="ghost" onClick={onClose} className="min-h-[44px] -ms-2">
          ← חזרה לרשימה
        </Button>
      )}

      {isPaid && (
        <p className="rounded-[var(--radius)] border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          התעודה נעולה — בטל תשלום כדי לערוך.
        </p>
      )}

      {/* ── Lines ── */}
      <div className="overflow-hidden rounded-[var(--radius-card)] border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-card-elevated text-muted-foreground">
              <th className="px-3 py-2 text-start font-medium">פריט</th>
              <th className="px-3 py-2 text-start font-medium">פירוט</th>
              <th className="px-3 py-2 text-start font-medium">כמות / תעריף</th>
              <th className="px-3 py-2 text-end font-medium">סכום</th>
              {isPending && <th className="px-3 py-2 text-end font-medium sr-only">פעולות</th>}
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 && (
              <tr>
                <td colSpan={isPending ? 5 : 4} className="px-3 py-6 text-center text-muted-foreground">
                  אין שורות בתעודה.
                </td>
              </tr>
            )}
            {lines.map((line) => {
              const editing = editingLineId === line.id;
              return (
                <tr key={line.id} className="border-b border-border last:border-b-0 align-top">
                  <td className="px-3 py-3 text-foreground">
                    {line.label}
                    {isItemLine(line) && line.item_ref != null && (
                      <div className="text-xs text-muted-foreground">אסמכתא {line.item_ref}</div>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    {editing ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          aria-label="תיאור שורה"
                          value={lineDraft.description}
                          onChange={(e) =>
                            setLineDraft((d) => ({ ...d, description: e.target.value }))
                          }
                          placeholder="תיאור"
                          className="w-full rounded-[var(--radius)] border border-border bg-background px-2 py-1.5 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                        <input
                          type="text"
                          aria-label="הערה לשורה"
                          value={lineDraft.notes}
                          onChange={(e) =>
                            setLineDraft((d) => ({ ...d, notes: e.target.value }))
                          }
                          placeholder="הערה"
                          className="w-full rounded-[var(--radius)] border border-border bg-background px-2 py-1.5 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>
                    ) : (
                      <div>
                        <div className="text-foreground">{line.description || "—"}</div>
                        {line.notes && (
                          <div className="text-xs text-muted-foreground">{line.notes}</div>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">
                    {isItemLine(line) && line.quantity != null && line.rate != null ? (
                      <span className="font-mono tabular-nums">
                        {line.quantity} × {formatCurrency(line.rate, doc.currency)}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-3 text-end font-mono tabular-nums text-foreground">
                    {formatCurrency(line.amount, doc.currency)}
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
                            {savingLine ? "שומר…" : "שמור"}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingLineId(null)}
                            disabled={savingLine}
                            className="min-h-[44px]"
                          >
                            ביטול
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
                            ערוך
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => requestRemoveLine(line)}
                            className="min-h-[44px] text-destructive hover:text-destructive"
                          >
                            הסר
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

      {/* ── Document notes ── */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-foreground" htmlFor="doc-notes">
          הערות לתעודה
        </label>
        {isPending ? (
          <div className="space-y-2">
            <textarea
              id="doc-notes"
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              rows={3}
              className="w-full rounded-[var(--radius)] border border-border bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="הערות פנימיות…"
            />
            <Button
              variant="outline"
              onClick={() => void handleSaveNotes()}
              disabled={savingNotes || notesDraft === (doc.notes ?? "")}
              className="min-h-[44px]"
            >
              {savingNotes ? "שומר…" : "שמור הערות"}
            </Button>
          </div>
        ) : (
          <p className="text-muted-foreground">{doc.notes || "—"}</p>
        )}
      </div>

      {/* ── Actions ── */}
      <div className="flex flex-wrap gap-3 border-t border-border pt-4">
        <Button onClick={handleExportPdf} variant="secondary" className="min-h-[44px]">
          ייצוא PDF
        </Button>

        {isPending && (
          <>
            <Button
              onClick={() =>
                setConfirm({
                  title: "סימון כשולם",
                  description: "לסמן את התעודה כשולמה? היא תינעל לעריכה עד שתבטל את התשלום.",
                  actionLabel: "סמן כשולם",
                  destructive: false,
                  run: () => postAction("pay", "סומן כשולם", false),
                })
              }
              disabled={actionBusy}
              className="min-h-[44px]"
            >
              סמן כשולם
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                setConfirm({
                  title: "ביטול תעודה",
                  description:
                    "לבטל את התעודה? הפעולה אינה הפיכה. הפריטים שמקורם ברישום זמן יחזרו לרשימת הפריטים לחיוב.",
                  actionLabel: "בטל תעודה",
                  destructive: true,
                  run: () => postAction("cancel", "התעודה בוטלה", true),
                })
              }
              disabled={actionBusy}
              className="min-h-[44px]"
            >
              בטל תעודה
            </Button>
          </>
        )}

        {isPaid && (
          <Button
            variant="outline"
            onClick={() =>
              setConfirm({
                title: "ביטול תשלום",
                description: "לבטל את סימון התשלום ולפתוח את התעודה לעריכה מחדש?",
                actionLabel: "בטל תשלום",
                destructive: false,
                run: () => postAction("unpay", "התשלום בוטל", false),
              })
            }
            disabled={actionBusy}
            className="min-h-[44px]"
          >
            בטל תשלום
          </Button>
        )}

        {isCanceled && (
          <Button
            variant="ghost"
            onClick={() =>
              setConfirm({
                title: "מחיקת תעודה",
                description: "למחוק לצמיתות את התעודה המבוטלת? לא ניתן לשחזר.",
                actionLabel: "מחק תעודה",
                destructive: true,
                run: handleDelete,
              })
            }
            disabled={actionBusy}
            className="min-h-[44px] text-destructive hover:text-destructive"
          >
            מחק תעודה
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
              ביטול
            </Button>
            <Button
              variant={confirm?.destructive ? "destructive" : "default"}
              onClick={() => void runConfirm()}
              disabled={confirmBusy}
              className="min-h-[44px]"
            >
              {confirmBusy ? "מבצע…" : confirm?.actionLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Post-issue "export PDF now?" prompt (shown once) ── */}
      <Dialog open={pdfPromptOpen} onOpenChange={setPdfPromptOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>התעודה נוצרה בהצלחה</DialogTitle>
            <DialogDescription>להפיק PDF עכשיו?</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => setPdfPromptOpen(false)}
              className="min-h-[44px]"
            >
              לא עכשיו
            </Button>
            <Button
              onClick={() => {
                handleExportPdf();
                setPdfPromptOpen(false);
              }}
              className="min-h-[44px]"
            >
              הפק PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Hidden PDF print block (light/print styling) ── */}
      <div id="pdf-content" className="print-only" dir="rtl">
        <div
          className="pdf-header"
          style={{
            marginBottom: "2rem",
            paddingBottom: "1.5rem",
            borderBottom: "2px solid #e2e8f0",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ flex: 1 }}>
              {profile?.logoUrl && (
                // Plain <img>: next/image's lazy-loading/optimization breaks print rendering.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.logoUrl}
                  alt="Logo"
                  style={{ maxHeight: "50px", marginBottom: "10px" }}
                />
              )}
              {/* Business identity shows ONLY when there is a real business name —
                  never fall back to the document title (that would duplicate the h2). */}
              {profile?.businessName && (
                <>
                  <h1
                    className="pdf-business-name"
                    style={{ fontSize: "22px", fontWeight: "bold", marginBottom: "0.25rem" }}
                  >
                    {profile.businessName}
                  </h1>
                  <div style={{ fontSize: "12px", color: "#64748b", lineHeight: 1.6 }}>
                    {profile.taxId && <div>ע.מ / ח.פ: {profile.taxId}</div>}
                    {profile.address && <div>{profile.address}</div>}
                    {profile.phone && <div>{profile.phone}</div>}
                    {profile.email && <div>{profile.email}</div>}
                  </div>
                </>
              )}
            </div>
            <div style={{ textAlign: "start" }}>
              <h2 style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "0.5rem" }}>
                תעודת התחשבנות פנימית
              </h2>
              <div style={{ fontSize: "13px", color: "#64748b" }}>
                <div>מספר {doc.doc_number}</div>
                <div>סטטוס: {status.label}</div>
                <div style={{ marginTop: "0.5rem" }}>
                  תאריך הפקה: {new Date(doc.issued_at).toLocaleDateString("he-IL")}
                </div>
              </div>
            </div>
          </div>

          <div
            style={{
              marginTop: "1.5rem",
              padding: "1rem",
              backgroundColor: "#f8fafc",
              borderRadius: "8px",
            }}
          >
            <div
              style={{
                fontSize: "11px",
                color: "#94a3b8",
                marginBottom: "0.25rem",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              עבור
            </div>
            <div style={{ fontWeight: 600, fontSize: "16px" }}>{doc.client_name}</div>
          </div>
        </div>

        <table className="pdf-table" style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ backgroundColor: "#f8fafc" }}>
              <th style={{ padding: "0.5rem 0.75rem", textAlign: "start" }}>פריט</th>
              <th style={{ padding: "0.5rem 0.75rem", textAlign: "start" }}>פירוט</th>
              <th style={{ padding: "0.5rem 0.75rem", textAlign: "start" }}>כמות / תעריף</th>
              <th style={{ padding: "0.5rem 0.75rem", textAlign: "start" }}>סכום</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: "0.5rem 0.75rem", fontSize: "12px" }}>
                  {line.label}
                  {isItemLine(line) && line.item_ref != null && (
                    <span style={{ color: "#94a3b8" }}> · אסמכתא {line.item_ref}</span>
                  )}
                </td>
                <td style={{ padding: "0.5rem 0.75rem", fontSize: "12px" }}>
                  {line.description || ""}
                  {line.notes ? ` (${line.notes})` : ""}
                </td>
                <td style={{ padding: "0.5rem 0.75rem", fontSize: "12px", whiteSpace: "nowrap" }}>
                  {isItemLine(line) && line.quantity != null && line.rate != null
                    ? `${line.quantity} × ${formatCurrency(line.rate, doc.currency)}`
                    : ""}
                </td>
                <td style={{ padding: "0.5rem 0.75rem", fontSize: "12px", whiteSpace: "nowrap" }}>
                  {formatCurrency(line.amount, doc.currency)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3} style={{ padding: "0.5rem 0.75rem", textAlign: "start", fontWeight: 600 }}>
                סה״כ
              </td>
              <td style={{ padding: "0.5rem 0.75rem", fontWeight: 600, whiteSpace: "nowrap" }}>
                {formatCurrency(doc.total, doc.currency)}
              </td>
            </tr>
          </tfoot>
        </table>

        {doc.notes && (
          <div className="pdf-section" style={{ marginTop: "1.25rem", fontSize: "12px", color: "#475569" }}>
            <div style={{ fontWeight: 600, marginBottom: "0.25rem" }}>הערות</div>
            <div>{doc.notes}</div>
          </div>
        )}
      </div>
    </div>
  );
}
