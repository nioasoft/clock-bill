"use client";

import { useTranslations, useLocale } from "next-intl";
import { formatDuration as formatDurationLib, formatDate as formatDateLib } from "@/lib/format";
import { formatCurrency as formatCurrencyLib } from "@/lib/currency";
import type {
  ReportData,
  ReportEntry,
  RateLabelSummary,
  UserProfile,
  ReportFilters,
} from "./AdHocReportTab";

interface PdfReportContentProps {
  /** The generated report payload (rows, summaries, fixed charges). */
  report: ReportData;
  /** The freelancer's business profile (header/footer), or null while loading. */
  userProfile: UserProfile | null;
  /** Active report filters (date range used in the header). */
  filters: ReportFilters;
  /** Whether to render the work-times (start/end) column. */
  showWorkTimes: boolean;
}

/**
 * The printable ad-hoc report markup, isolated into its own component so it can
 * render under a nested NextIntlClientProvider in the CLIENT's document
 * language. It calls its OWN useTranslations/useLocale — the captured closures
 * from AdHocReportTab would NOT rebind to the nested provider's locale, so the
 * markup must live in a component rendered *inside* that provider.
 *
 * The light-mode inline styles are the documented PDF exception to the design
 * tokens — they print on white paper and are kept verbatim from the original
 * inline subtree.
 */
export function PdfReportContent({
  report: reportData,
  userProfile,
  filters,
  showWorkTimes,
}: PdfReportContentProps) {
  const t = useTranslations("Reports");
  const locale = useLocale();

  // Locale-aware duration ("2 שע׳ 30 דק׳" / "2h 30m").
  const formatDuration = (minutes: number) => formatDurationLib(minutes, locale);

  // Per-entry billed amount, honoring the item vs hourly snapshot.
  const entryAmount = (entry: ReportEntry): number => {
    if (typeof entry.amount === "number") return entry.amount;
    if (entry.billingKind === "item") return (entry.quantity ?? 0) * (entry.hourlyRate ?? 0);
    return (entry.duration / 60) * (entry.hourlyRate ?? 0);
  };

  // Item count ("3 יח׳" / "3 items") vs an hours measure for the by-label breakdown.
  const formatMeasure = (row: RateLabelSummary): string =>
    row.kind === "item"
      ? t("units.items", { count: row.totalQuantity })
      : t("units.hoursMeasure", { hours: (row.totalMinutes / 60).toFixed(1) });

  // Locale-aware currency (grouping + symbol placement per locale).
  const formatCurrency = (amount: number, currency: string) =>
    formatCurrencyLib(amount, currency, locale);

  // Locale-aware short date for tables/labels.
  const formatDate = (date: string | Date) => formatDateLib(date, undefined, locale);

  return (
    <div id="pdf-content" className="print-only" dir={locale === "he" ? "rtl" : "ltr"}>
      {/* ── Header: Business → Client ── */}
      <div className="pdf-header" style={{ marginBottom: "2rem", paddingBottom: "1.5rem", borderBottom: "2px solid #e2e8f0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          {/* Business info (inline-start side) */}
          <div style={{ flex: 1 }}>
            {userProfile?.logoUrl && (
              // This block is cloned into a print container for PDF export;
              // next/image's lazy-loading/optimization breaks print rendering,
              // so a plain <img> is required here.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={userProfile.logoUrl} alt={t("pdf.logoAlt")} style={{ maxHeight: "50px", marginBottom: "10px" }} />
            )}
            <h1 className="pdf-business-name" style={{ fontSize: "22px", fontWeight: "bold", marginBottom: "0.25rem" }}>
              {userProfile?.businessName ? <bdi>{userProfile.businessName}</bdi> : t("report.docTitle")}
            </h1>
            <div style={{ fontSize: "12px", color: "#64748b", lineHeight: 1.6 }}>
              {userProfile?.taxId && <div>{t("pdf.taxId")}: <bdi>{userProfile.taxId}</bdi></div>}
              {userProfile?.address && <div><bdi>{userProfile.address}</bdi></div>}
              {userProfile?.phone && <div><bdi>{userProfile.phone}</bdi></div>}
              {userProfile?.email && <div><bdi>{userProfile.email}</bdi></div>}
            </div>
          </div>
          {/* Report title + date range (inline-end side) */}
          <div style={{ textAlign: "start" }}>
            <h2 style={{ fontSize: "26px", fontWeight: "bold", marginBottom: "0.5rem" }}>{t("report.headerTitle")}</h2>
            <div style={{ fontSize: "13px", color: "#64748b" }}>
              <div>{t("report.fromDate", { date: formatDate(filters.startDate) })}</div>
              <div>{t("report.toDate", { date: formatDate(filters.endDate) })}</div>
              <div style={{ marginTop: "0.5rem" }}>{t("report.issueDate", { date: formatDate(new Date()) })}</div>
            </div>
          </div>
        </div>

        {/* Client details (if filtered to specific client) */}
        {reportData.byClient.length === 1 && (
          <div style={{ marginTop: "1.5rem", padding: "1rem", backgroundColor: "#f8fafc", borderRadius: "8px" }}>
            <div style={{ fontSize: "11px", color: "#94a3b8", marginBottom: "0.25rem", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.5px" }}>{t("report.for")}</div>
            <div style={{ fontWeight: "600", fontSize: "16px" }}><bdi>{reportData.byClient[0].clientName}</bdi></div>
            <div style={{ fontSize: "12px", color: "#64748b", lineHeight: 1.6 }}>
              {reportData.byClient[0].clientContactName && <span><bdi>{reportData.byClient[0].clientContactName}</bdi> &middot; </span>}
              {reportData.byClient[0].clientEmail && <span><bdi>{reportData.byClient[0].clientEmail}</bdi> &middot; </span>}
              {reportData.byClient[0].clientPhone && <span><bdi>{reportData.byClient[0].clientPhone}</bdi></span>}
              {reportData.byClient[0].clientAddress && <div><bdi>{reportData.byClient[0].clientAddress}</bdi></div>}
            </div>
          </div>
        )}
      </div>

      {/* ── Per-project work breakdown ── */}
      {reportData.byProject.map((project) => (
        <div key={project.projectId} className="pdf-section" style={{ marginBottom: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.75rem", borderBottom: "1px solid #e2e8f0", paddingBottom: "0.5rem" }}>
            <h2 className="pdf-section-title" style={{ fontSize: "16px", fontWeight: "bold", margin: 0 }}>
              <bdi>{project.projectName}</bdi>
              {reportData.byClient.length > 1 && (
                <span style={{ fontWeight: "normal", fontSize: "13px", color: "#64748b" }}> — <bdi>{project.clientName}</bdi></span>
              )}
            </h2>
            <div style={{ fontSize: "13px", color: "#64748b" }}>
              {project.hourlyRate ? t("report.perHour", { amount: formatCurrency(project.hourlyRate, project.currency) }) : ""}
            </div>
          </div>

          <table className="pdf-table" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ backgroundColor: "#f8fafc" }}>
                <th style={{ padding: "0.5rem 0.75rem", textAlign: "start", fontWeight: "600", fontSize: "11px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>{t("columns.date")}</th>
                {showWorkTimes && (
                  <th style={{ padding: "0.5rem 0.75rem", textAlign: "start", fontWeight: "600", fontSize: "11px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>{t("columns.hours")}</th>
                )}
                <th style={{ padding: "0.5rem 0.75rem", textAlign: "start", fontWeight: "600", fontSize: "11px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>{t("columns.workDescription")}</th>
                <th style={{ padding: "0.5rem 0.75rem", textAlign: "start", fontWeight: "600", fontSize: "11px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>{t("columns.duration")}</th>
                <th style={{ padding: "0.5rem 0.75rem", textAlign: "start", fontWeight: "600", fontSize: "11px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>{t("columns.amount")}</th>
              </tr>
            </thead>
            <tbody>
              {project.entries.map((entry) => (
                <tr key={entry.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "0.5rem 0.75rem", fontSize: "12px", whiteSpace: "nowrap" }}>{formatDate(entry.date)}</td>
                  {showWorkTimes && (
                    <td style={{ padding: "0.5rem 0.75rem", fontSize: "12px", whiteSpace: "nowrap" }}>
                      {entry.startTime && entry.endTime
                        ? `${new Date(entry.startTime).toLocaleTimeString(locale === "he" ? "he-IL" : "en-US", { hour: '2-digit', minute: '2-digit' })} - ${new Date(entry.endTime).toLocaleTimeString(locale === "he" ? "he-IL" : "en-US", { hour: '2-digit', minute: '2-digit' })}`
                        : entry.startTime
                          ? `${new Date(entry.startTime).toLocaleTimeString(locale === "he" ? "he-IL" : "en-US", { hour: '2-digit', minute: '2-digit' })} -`
                          : "-"}
                    </td>
                  )}
                  <td style={{ padding: "0.5rem 0.75rem", fontSize: "12px" }}>
                    <bdi>{entry.description}{entry.notes ? ` (${entry.notes})` : ""}</bdi>
                    {entry.rateLabel ? <span style={{ color: "#94a3b8" }}> · <bdi>{entry.rateLabel}</bdi></span> : ""}
                    {entry.billingKind === "item" && entry.itemRef != null ? <span style={{ color: "#94a3b8" }}> · {t("units.ref", { ref: entry.itemRef })}</span> : ""}
                  </td>
                  <td style={{ padding: "0.5rem 0.75rem", fontSize: "12px", whiteSpace: "nowrap" }}>
                    {entry.billingKind === "item"
                      ? (entry.unit
                          ? t("units.itemsWithUnit", { count: entry.quantity ?? 0, unit: entry.unit })
                          : t("units.items", { count: entry.quantity ?? 0 }))
                      : formatDuration(entry.duration)}
                  </td>
                  <td style={{ padding: "0.5rem 0.75rem", fontSize: "12px", whiteSpace: "nowrap" }}>
                    {entry.isBillable
                      ? (entryAmount(entry) > 0 ? formatCurrency(entryAmount(entry), entry.currency) : "-")
                      : t("report.notBillable")}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: "2px solid #e2e8f0", fontWeight: "600" }}>
                <td style={{ padding: "0.5rem 0.75rem", fontSize: "12px" }}></td>
                {showWorkTimes && <td style={{ padding: "0.5rem 0.75rem", fontSize: "12px" }}></td>}
                <td style={{ padding: "0.5rem 0.75rem", fontSize: "12px" }}>{t("report.projectTotal", { project: project.projectName })}</td>
                <td style={{ padding: "0.5rem 0.75rem", fontSize: "12px" }}>{formatDuration(project.totalMinutes)}</td>
                <td style={{ padding: "0.5rem 0.75rem", fontSize: "12px" }}>
                  {project.totalAmount > 0 ? formatCurrency(project.totalAmount, project.currency) : "-"}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      ))}

      {/* ── Fixed monthly charges ── */}
      {reportData.fixedCharges && reportData.fixedCharges.length > 0 && (
        <div className="pdf-section" style={{ marginBottom: "1.5rem" }}>
          <h2 className="pdf-section-title" style={{ fontSize: "16px", fontWeight: "bold", marginBottom: "0.75rem", borderBottom: "1px solid #e2e8f0", paddingBottom: "0.5rem" }}>
            {t("sections.fixedCharges")}
          </h2>
          <table className="pdf-table" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ backgroundColor: "#f8fafc" }}>
                <th style={{ padding: "0.5rem 0.75rem", textAlign: "start", fontWeight: "600", fontSize: "11px", color: "#64748b" }}>{t("columns.month")}</th>
                <th style={{ padding: "0.5rem 0.75rem", textAlign: "start", fontWeight: "600", fontSize: "11px", color: "#64748b" }}>{t("columns.project")}</th>
                <th style={{ padding: "0.5rem 0.75rem", textAlign: "start", fontWeight: "600", fontSize: "11px", color: "#64748b" }}>{t("columns.amount")}</th>
              </tr>
            </thead>
            <tbody>
              {reportData.fixedCharges.map((line, i) => (
                <tr key={`${line.projectId}-${line.month}-${i}`} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "0.5rem 0.75rem", fontSize: "12px" }}>{line.month}</td>
                  <td style={{ padding: "0.5rem 0.75rem", fontSize: "12px" }}><bdi>{line.projectName}</bdi></td>
                  <td style={{ padding: "0.5rem 0.75rem", fontSize: "12px", fontWeight: "500" }}>{formatCurrency(line.amount, line.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Breakdown by rate/item label ── */}
      {reportData.byRateLabel && reportData.byRateLabel.length > 0 && (
        <div className="pdf-section" style={{ marginBottom: "1.5rem" }}>
          <h2 className="pdf-section-title" style={{ fontSize: "16px", fontWeight: "bold", marginBottom: "0.75rem", borderBottom: "1px solid #e2e8f0", paddingBottom: "0.5rem" }}>
            {t("sections.byLabel")}
          </h2>
          <table className="pdf-table" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ backgroundColor: "#f8fafc" }}>
                <th style={{ padding: "0.5rem 0.75rem", textAlign: "start", fontWeight: "600", fontSize: "11px", color: "#64748b" }}>{t("columns.label")}</th>
                <th style={{ padding: "0.5rem 0.75rem", textAlign: "start", fontWeight: "600", fontSize: "11px", color: "#64748b" }}>{t("columns.type")}</th>
                <th style={{ padding: "0.5rem 0.75rem", textAlign: "start", fontWeight: "600", fontSize: "11px", color: "#64748b" }}>{t("columns.hoursOrQty")}</th>
                <th style={{ padding: "0.5rem 0.75rem", textAlign: "start", fontWeight: "600", fontSize: "11px", color: "#64748b" }}>{t("columns.amount")}</th>
              </tr>
            </thead>
            <tbody>
              {reportData.byRateLabel.map((row, i) => (
                <tr key={`${row.label}-${row.currency}-${i}`} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "0.5rem 0.75rem", fontSize: "12px" }}><bdi>{row.label}</bdi></td>
                  <td style={{ padding: "0.5rem 0.75rem", fontSize: "12px" }}>{row.kind === "item" ? t("kind.item") : t("kind.hours")}</td>
                  <td style={{ padding: "0.5rem 0.75rem", fontSize: "12px", whiteSpace: "nowrap" }}>{formatMeasure(row)}</td>
                  <td style={{ padding: "0.5rem 0.75rem", fontSize: "12px", fontWeight: "500" }}>{formatCurrency(row.totalAmount, row.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Grand total ── */}
      <div style={{ marginTop: "1.5rem", padding: "1.25rem", backgroundColor: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: "13px", color: "#64748b" }}>{t("summary.totalHours")}</div>
            <div style={{ fontSize: "20px", fontWeight: "bold" }}>{t("summary.hoursValue", { hours: reportData.summary.totalHours.toFixed(1) })}</div>
          </div>
          {Object.keys(reportData.summary.totalAmounts).length > 0 && (
            <div style={{ textAlign: "start" }}>
              <div style={{ fontSize: "13px", color: "#64748b" }}>{t("summary.totalDue")}</div>
              <div style={{ fontSize: "24px", fontWeight: "bold" }}>
                {Object.entries(reportData.summary.totalAmounts).map(
                  ([currency, amount]) => formatCurrency(amount, currency)
                ).join(" + ")}
              </div>
            </div>
          )}
        </div>
        <div style={{ marginTop: "0.5rem", fontSize: "11px", color: "#94a3b8" }}>{t("preVatNote")}</div>
      </div>

      {/* ── Footer ── */}
      <div style={{ marginTop: "2rem", paddingTop: "1rem", borderTop: "1px solid #e2e8f0", fontSize: "11px", color: "#94a3b8", textAlign: "center" }}>
        <bdi>{userProfile?.businessName || t("report.appName")}</bdi> &middot; {t("report.generatedOn", { date: formatDate(new Date()) })}
      </div>
    </div>
  );
}
