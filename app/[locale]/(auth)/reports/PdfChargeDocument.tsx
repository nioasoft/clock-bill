"use client";

import { useTranslations, useLocale } from "next-intl";
import { formatDate as formatDateLib } from "@/lib/format";
import { formatCurrency as formatCurrencyLib } from "@/lib/currency";
import { STATUS_META, type ChargeDocStatus } from "./statusMeta";

/** One billed line on a charge document (printed PDF). */
export interface PdfDocumentLine {
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

  return (
    <div id="pdf-content" className="print-only" dir={locale === "he" ? "rtl" : "ltr"}>
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
                  <bdi>{profile.businessName}</bdi>
                </h1>
                <div style={{ fontSize: "12px", color: "#64748b", lineHeight: 1.6 }}>
                  {profile.taxId && <div>{t("pdf.taxId")}: <bdi>{profile.taxId}</bdi></div>}
                  {profile.address && <div><bdi>{profile.address}</bdi></div>}
                  {profile.phone && <div><bdi>{profile.phone}</bdi></div>}
                  {profile.email && <div><bdi>{profile.email}</bdi></div>}
                  {profile.showWebsiteOnDoc && profile.website && <div><bdi>{profile.website}</bdi></div>}
                </div>
              </>
            )}
          </div>
          <div style={{ textAlign: "start" }}>
            <h2 style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "0.5rem" }}>
              {t("doc.settlementDocTitle")}
            </h2>
            <div style={{ fontSize: "13px", color: "#64748b" }}>
              <div>{t("doc.pdfNumber", { number: doc.doc_number })}</div>
              <div>{t("doc.pdfStatus", { status: t(status.labelKey) })}</div>
              <div style={{ marginTop: "0.5rem" }}>
                {t("doc.pdfIssueDate", { date: formatDate(doc.issued_at) })}
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
            {t("doc.pdfFor")}
          </div>
          <div style={{ fontWeight: 600, fontSize: "16px" }}><bdi>{doc.client_name}</bdi></div>
        </div>
      </div>

      <table className="pdf-table" style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ backgroundColor: "#f8fafc" }}>
            <th style={{ padding: "0.5rem 0.75rem", textAlign: "start" }}>{t("doc.colItem")}</th>
            <th style={{ padding: "0.5rem 0.75rem", textAlign: "start" }}>{t("doc.colDetails")}</th>
            <th style={{ padding: "0.5rem 0.75rem", textAlign: "start" }}>{t("doc.colQtyRate")}</th>
            <th style={{ padding: "0.5rem 0.75rem", textAlign: "start" }}>{t("doc.colAmount")}</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
              <td style={{ padding: "0.5rem 0.75rem", fontSize: "12px" }}>
                <bdi>{line.label}</bdi>
                {isItemLine(line) && line.item_ref != null && (
                  <span style={{ color: "#94a3b8" }}> · {t("units.ref", { ref: line.item_ref })}</span>
                )}
              </td>
              <td style={{ padding: "0.5rem 0.75rem", fontSize: "12px" }}>
                <bdi>{line.description || ""}{line.notes ? ` (${line.notes})` : ""}</bdi>
              </td>
              <td style={{ padding: "0.5rem 0.75rem", fontSize: "12px", whiteSpace: "nowrap" }}>
                {isItemLine(line) && line.quantity != null && line.rate != null
                  ? `${line.quantity}${line.unit ? ` ${line.unit}` : ""} × ${formatCurrency(line.rate, doc.currency)}`
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
              {t("doc.total")}
            </td>
            <td style={{ padding: "0.5rem 0.75rem", fontWeight: 600, whiteSpace: "nowrap" }}>
              {formatCurrency(doc.total, doc.currency)}
            </td>
          </tr>
        </tfoot>
      </table>

      <div style={{ marginTop: "0.5rem", fontSize: "11px", color: "#94a3b8" }}>{t("preVatNote")}</div>

      {doc.notes && (
        <div className="pdf-section" style={{ marginTop: "1.25rem", fontSize: "12px", color: "#475569" }}>
          <div style={{ fontWeight: 600, marginBottom: "0.25rem" }}>{t("doc.notesHeading")}</div>
          <div><bdi>{doc.notes}</bdi></div>
        </div>
      )}

      {/* Footer: bank/payment details (left) + signature (right). Each shows
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
  );
}
