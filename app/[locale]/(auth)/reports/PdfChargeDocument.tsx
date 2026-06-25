"use client";

import { useTranslations, useLocale } from "next-intl";
import { formatDate as formatDateLib } from "@/lib/format";
import { formatCurrency as formatCurrencyLib } from "@/lib/currency";
import {
  lineQtyRate,
  summarizeLines,
  documentMoney,
  type SummaryMode,
  type SummaryLine,
} from "@/lib/charge-documents";
import { STATUS_META, type ChargeDocStatus } from "./statusMeta";

/** One billed line on a charge document (printed PDF). */
export interface PdfDocumentLine {
  id: string;
  source_type: string;
  time_entry_id: string | null;
  period_month: string | null;
  /** Source entry date snapshot (YYYY-MM-DD); null for fixed/retainer + legacy lines. */
  date: string | null;
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

/** Charge-document fields the printed PDF header/table needs. */
export interface PdfChargeDocument {
  doc_number: number;
  status: string;
  currency: string;
  total: number;
  notes: string | null;
  issued_at: string;
  client_name: string;
  /** VAT rate (%) snapshot, or null when no VAT applies. */
  vat_rate_snapshot: number | null;
  /** Document-level discount snapshot. */
  discount_type: "percent" | "amount" | null;
  discount_value: number | null;
  /** Optional summary grouping: 'project' | 'type' | null. */
  summary_mode: string | null;
  /** Whether to show the items' date range in the header. */
  show_date_range: boolean;
}

/** Business-profile fields rendered in the PDF header/footer. */
export interface PdfBusinessProfile {
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
}

export interface PdfChargeDocumentProps {
  doc: PdfChargeDocument;
  lines: PdfDocumentLine[];
  profile: PdfBusinessProfile | null;
}

/** True for lines that came from an "item"-type time entry (have a reference number). */
function isItemLine(line: PdfDocumentLine): boolean {
  return line.billing_kind === "item";
}

/** Tidy a numeric quantity for display (strip trailing zeros, max 2 dp). */
function tidyNumber(n: number): number {
  return Number(n.toFixed(2));
}

/**
 * Printable charge-document subtree (hidden until print). Renders in the
 * DOCUMENT language: it calls its OWN useTranslations/useLocale — the captured
 * closures of the parent component do NOT rebind under a nested
 * NextIntlClientProvider, so the locale-bound formatters (formatCurrency /
 * formatDate) are RE-CREATED here against this component's own `locale`.
 */
export function PdfChargeDocument({ doc, lines, profile }: PdfChargeDocumentProps) {
  const t = useTranslations("Reports");
  const locale = useLocale();

  // Locale-bound formatters, re-created inside this component so they bind to
  // the nested (document) locale — NOT received as props from the parent.
  const formatCurrency = (amount: number, currency: string) =>
    formatCurrencyLib(amount, currency, locale);
  const formatDate = (date: string | Date) => formatDateLib(date, undefined, locale);

  const status = STATUS_META[doc.status as ChargeDocStatus] ?? STATUS_META.pending;

  // Money breakdown: subtotal → discount → VAT → gross.
  const money = documentMoney({
    total: doc.total,
    discountType: doc.discount_type,
    discountValue: doc.discount_value,
    vatRate: doc.vat_rate_snapshot,
  });
  const hasVat = doc.vat_rate_snapshot != null && doc.vat_rate_snapshot > 0;
  const hasDiscount = money.discountAmount > 0;

  // Optional summary groups.
  const summaryMode =
    doc.summary_mode === "project" || doc.summary_mode === "type"
      ? (doc.summary_mode as SummaryMode)
      : null;
  const summary = summaryMode
    ? summarizeLines(lines as unknown as SummaryLine[], summaryMode)
    : [];

  // Items' date range for the header (lexical sort works on YYYY-MM-DD). Shown
  // only when enabled and at least one line carries a date.
  const lineDates = lines
    .map((l) => l.date)
    .filter((d): d is string => !!d)
    .sort();
  const dateRange = lineDates.length
    ? { from: lineDates[0], to: lineDates[lineDates.length - 1] }
    : null;

  return (
    <div id="pdf-content" className="print-only" dir={locale === "he" ? "rtl" : "ltr"}>
      {/* ── Header banner (colored, mirrors the settings template preview) ── */}
      <div className="pdf-banner">
        <div style={{ flex: 1, minWidth: 0 }}>
          {profile?.logoUrl && (
            // Plain <img>: next/image's lazy-loading/optimization breaks print rendering.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.logoUrl} alt="Logo" className="pdf-banner-logo" />
          )}
          {/* Business identity shows ONLY when there is a real business name —
              never fall back to the document title (that would duplicate it). */}
          {profile?.businessName && (
            <>
              <h1 className="pdf-business-name"><bdi>{profile.businessName}</bdi></h1>
              <div className="pdf-banner-sub">
                {profile.taxId && <div>{t("pdf.taxId")}: <bdi>{profile.taxId}</bdi></div>}
                {profile.address && <div><bdi>{profile.address}</bdi></div>}
                {profile.phone && <div><bdi>{profile.phone}</bdi></div>}
                {profile.email && <div><bdi>{profile.email}</bdi></div>}
                {profile.showWebsiteOnDoc && profile.website && <div><bdi>{profile.website}</bdi></div>}
              </div>
            </>
          )}
        </div>
        <div className="pdf-banner-meta">
          <div className="pdf-doc-title">{t("doc.settlementDocTitle")}</div>
          <div className="pdf-banner-sub">
            <div>{t("doc.pdfNumber", { number: doc.doc_number })}</div>
            <div>{t("doc.pdfStatus", { status: t(status.labelKey) })}</div>
            <div>{t("doc.pdfIssueDate", { date: formatDate(doc.issued_at) })}</div>
            {doc.show_date_range && dateRange && (
              <div>
                {dateRange.from === dateRange.to
                  ? t("doc.pdfDateSingle", { date: formatDate(dateRange.from) })
                  : t("doc.pdfDateRange", {
                      from: formatDate(dateRange.from),
                      to: formatDate(dateRange.to),
                    })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Body (padded) ── */}
      <div className="pdf-body">
      <div className="pdf-client-box">
        <div
          className="pdf-client-label"
          style={{ fontSize: "10px", marginBottom: "0.2rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px" }}
        >
          {t("doc.pdfFor")}
        </div>
        <div style={{ fontWeight: 600, fontSize: "16px" }}><bdi>{doc.client_name}</bdi></div>
      </div>

      {/* Optional summary block */}
      {summaryMode && summary.length > 0 && (
        <div className="pdf-summary pdf-section" style={{ marginBottom: "1.25rem" }}>
          <div
            className="pdf-summary-title"
            style={{ fontSize: "12px", fontWeight: 700, padding: "0.6rem 0.85rem", borderBottom: "1px solid #eee" }}
          >
            {t("doc.summaryHeading")}
          </div>
          <table className="pdf-summary-table" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ padding: "0.4rem 0.85rem", textAlign: "start", fontSize: "11px", fontWeight: 600 }}>
                  {summaryMode === "project" ? t("doc.summaryColProject") : t("doc.summaryColType")}
                </th>
                <th style={{ padding: "0.4rem 0.85rem", textAlign: "start", fontSize: "11px", fontWeight: 600, whiteSpace: "nowrap" }}>
                  {t("doc.summaryColHours")}
                </th>
                <th style={{ padding: "0.4rem 0.85rem", textAlign: "start", fontSize: "11px", fontWeight: 600, whiteSpace: "nowrap" }}>
                  {t("doc.colAmount")}
                </th>
              </tr>
            </thead>
            <tbody>
              {summary.map((g, i) => (
                <tr key={g.key ?? `__none__${i}`}>
                  <td style={{ padding: "0.4rem 0.85rem", fontSize: "12px" }}>
                    <bdi>{g.key ?? t("doc.summaryNoProject")}</bdi>
                  </td>
                  <td style={{ padding: "0.4rem 0.85rem", fontSize: "12px", whiteSpace: "nowrap" }}>
                    {g.hours > 0 ? t("units.hoursMeasure", { hours: tidyNumber(g.hours) }) : "—"}
                  </td>
                  <td style={{ padding: "0.4rem 0.85rem", fontSize: "12px", whiteSpace: "nowrap" }}>
                    {formatCurrency(g.amount, doc.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <table className="pdf-table" style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ whiteSpace: "nowrap" }}>{t("doc.colDate")}</th>
            <th>{t("doc.colItem")}</th>
            <th>{t("doc.colDetails")}</th>
            <th>{t("doc.colQtyRate")}</th>
            <th>{t("doc.colAmount")}</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => {
            const qr = lineQtyRate(line);
            return (
              <tr key={line.id}>
                <td style={{ fontSize: "12px", whiteSpace: "nowrap", color: "#475569" }}>
                  {/* Time-entry lines show their date; fixed/retainer lines show
                      their period month (MM/YYYY); legacy lines may be blank. */}
                  {line.date
                    ? formatDate(line.date)
                    : line.period_month
                      ? line.period_month.split("-").reverse().join("/")
                      : ""}
                </td>
                <td style={{ fontSize: "12px" }}>
                  <bdi>{line.label}</bdi>
                  {isItemLine(line) && line.item_ref != null && (
                    <span style={{ color: "#94a3b8" }}> · {t("units.ref", { ref: line.item_ref })}</span>
                  )}
                </td>
                <td style={{ fontSize: "12px" }}>
                  <bdi>{line.description || ""}{line.notes ? ` (${line.notes})` : ""}</bdi>
                </td>
                <td style={{ fontSize: "12px", whiteSpace: "nowrap" }}>
                  {qr
                    ? `${
                        qr.isHourly
                          ? t("units.hoursMeasure", { hours: tidyNumber(qr.qty) })
                          : `${tidyNumber(qr.qty)}${qr.unit ? ` ${qr.unit}` : ""}`
                      } × ${formatCurrency(qr.rate, doc.currency)}`
                    : ""}
                </td>
                <td style={{ fontSize: "12px", whiteSpace: "nowrap" }}>
                  {formatCurrency(line.amount, doc.currency)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Totals block (subtotal / VAT / grand total) — aligned to the amount side. */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "0.75rem" }}>
        <table style={{ minWidth: "240px", borderCollapse: "collapse" }}>
          <tbody>
            {hasVat && (
              <>
                <tr className="pdf-totals-row">
                  <td className="pdf-totals-label" style={{ fontSize: "12px" }}>{t("doc.subtotal")}</td>
                  <td className="pdf-totals-value" style={{ fontSize: "12px" }}>{formatCurrency(money.netSubtotal, doc.currency)}</td>
                </tr>
                {hasDiscount && (
                  <tr className="pdf-totals-row">
                    <td className="pdf-totals-label" style={{ fontSize: "12px" }}>{t("doc.discount")}</td>
                    <td className="pdf-totals-value" style={{ fontSize: "12px" }}>−{formatCurrency(money.discountAmount, doc.currency)}</td>
                  </tr>
                )}
                <tr className="pdf-totals-row">
                  <td className="pdf-totals-label" style={{ fontSize: "12px" }}>
                    {t("doc.vat", { rate: tidyNumber(doc.vat_rate_snapshot as number) })}
                  </td>
                  <td className="pdf-totals-value" style={{ fontSize: "12px" }}>{formatCurrency(money.vatAmount, doc.currency)}</td>
                </tr>
              </>
            )}
            {!hasVat && hasDiscount && (
              <tr className="pdf-totals-row">
                <td className="pdf-totals-label" style={{ fontSize: "12px" }}>{t("doc.discount")}</td>
                <td className="pdf-totals-value" style={{ fontSize: "12px" }}>−{formatCurrency(money.discountAmount, doc.currency)}</td>
              </tr>
            )}
            <tr className="pdf-totals-row pdf-totals-grand">
              <td className="pdf-totals-label">{hasVat ? t("doc.totalDue") : t("doc.total")}</td>
              <td className="pdf-totals-value">{formatCurrency(money.gross, doc.currency)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {!hasVat && (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <div className="pdf-note" style={{ marginTop: "0.3rem", textAlign: "end" }}>{t("doc.noVatNote")}</div>
        </div>
      )}

      {doc.notes && (
        <div className="pdf-section" style={{ marginTop: "1.25rem", fontSize: "12px", color: "#475569" }}>
          <div style={{ fontWeight: 600, marginBottom: "0.25rem" }}>{t("doc.notesHeading")}</div>
          <div><bdi>{doc.notes}</bdi></div>
        </div>
      )}

      {/* Footer: bank/payment details (start) + signature (end). Each shows
          only when filled. Signature falls back to the typed business name. */}
      {(profile?.bankName || profile?.bankAccountNumber || profile?.bankBranch || profile?.bankSwift || profile?.signatureUrl || profile?.businessName) && (
        <div
          className="pdf-section"
          style={{ marginTop: "1.75rem", display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "1.5rem", flexWrap: "wrap" }}
        >
          {(profile?.bankName || profile?.bankAccountNumber || profile?.bankBranch || profile?.bankSwift) ? (
            <div style={{ fontSize: "12px", color: "#475569", lineHeight: 1.6 }}>
              <div style={{ fontWeight: 600, marginBottom: "0.25rem" }}>{t("doc.paymentDetails")}</div>
              {profile.bankName && <div>{t("pdf.bankName")}: <bdi>{profile.bankName}</bdi></div>}
              {profile.bankBranch && <div>{t("pdf.bankBranch")}: <bdi>{profile.bankBranch}</bdi></div>}
              {profile.bankAccountNumber && <div>{t("pdf.bankAccount")}: <bdi>{profile.bankAccountNumber}</bdi></div>}
              {profile.bankSwift && <div>SWIFT/IBAN: <bdi>{profile.bankSwift}</bdi></div>}
            </div>
          ) : <div />}

          {(profile?.signatureUrl || profile?.businessName) && (
            <div style={{ textAlign: "center", minWidth: "150px" }}>
              {profile.signatureUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.signatureUrl} alt="" style={{ height: 46, objectFit: "contain", margin: "0 auto" }} />
              ) : (
                <div style={{ fontFamily: "'Segoe Script','Brush Script MT',cursive", fontSize: "22px", color: "#1e293b", lineHeight: 1.3 }}>
                  <bdi>{profile.businessName}</bdi>
                </div>
              )}
              <div style={{ borderTop: "1px solid #cbd5e1", marginTop: "4px", paddingTop: "4px", fontSize: "11px", color: "#94a3b8" }}>
                {t("doc.signature")}
              </div>
            </div>
          )}
        </div>
      )}
      </div>
    </div>
  );
}
