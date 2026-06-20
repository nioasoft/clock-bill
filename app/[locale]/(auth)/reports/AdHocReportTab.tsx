"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { NextIntlClientProvider } from "next-intl";
import { Link } from "@/src/i18n/navigation";
import { formatDuration as formatDurationLib, formatDate as formatDateLib } from "@/lib/format";
import { formatCurrency as formatCurrencyLib } from "@/lib/currency";
import { showSuccessToast, showErrorToast } from "@/lib/toast";
import { resolveDocumentLocale, type DocumentLanguage } from "@/lib/document-language";
import { useDocumentMessages } from "@/lib/document-messages";
import { printPdfContent } from "./printStyles";
import { PdfReportContent } from "./PdfReportContent";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import { SimpleSelect } from "@/components/ui/simple-select";

export interface UserProfile {
  businessName: string | null;
  logoUrl: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  taxId: string | null;
  defaultCurrency: string;
  preferredPdfTemplate: string;
  pdfPrimaryColor: string;
  pdfAccentColor: string;
}

/** Active report filters (date range + client/project scope). */
export interface ReportFilters {
  clientId: string;
  projectId: string;
  startDate: string;
  endDate: string;
  includeFixedCharges: boolean;
}

interface Project {
  id: string;
  name: string;
  clientId: string;
  clientName: string;
}

interface Client {
  id: string;
  name: string;
  /** The client's document-language setting; null = "auto" (infer from currency). */
  documentLanguage: string | null;
  /** The client's billing currency (drives the auto document language). */
  currency: string;
}

export interface ReportEntry {
  id: string;
  projectId: string;
  projectName: string;
  clientId: string;
  clientName: string;
  clientContactName: string | null;
  clientEmail: string | null;
  clientPhone: string | null;
  clientAddress: string | null;
  description: string;
  duration: number;
  date: string;
  startTime: string | null;
  endTime: string | null;
  tags: string[];
  notes: string | null;
  isBillable: boolean;
  pricingModel: string;
  hourlyRate: number | null;
  currency: string;
  billingKind?: "hourly" | "item";
  rateLabel?: string | null;
  quantity?: number | null;
  itemRef?: number | null;
  unit?: string | null;
  amount?: number;
}

interface ReportSummary {
  totalMinutes: number;
  totalHours: number;
  totalEntries: number;
  fixedAmounts: Record<string, number>;
  totalAmounts: Record<string, number>;
}

interface FixedChargeEntry {
  projectId: string;
  projectName: string;
  clientId: string;
  clientName: string;
  month: string;
  amount: number;
  currency: string;
  type: "fixed_monthly";
}

interface ClientSummary {
  clientId: string;
  clientName: string;
  clientContactName: string | null;
  clientEmail: string | null;
  clientPhone: string | null;
  clientAddress: string | null;
  totalMinutes: number;
  totalHours: number;
  totalAmounts: Record<string, number>;
  entries: ReportEntry[];
}

interface ProjectSummary {
  projectId: string;
  projectName: string;
  clientId: string;
  clientName: string;
  pricingModel: string;
  hourlyRate: number | null;
  currency: string;
  totalMinutes: number;
  totalHours: number;
  totalAmount: number;
  entries: ReportEntry[];
}

interface DateSummary {
  date: string;
  totalMinutes: number;
  totalHours: number;
  totalAmounts: Record<string, number>;
  entryCount: number;
  entries: ReportEntry[];
}

interface WeekSummary {
  weekStart: string;
  weekEnd: string;
  totalMinutes: number;
  totalHours: number;
  totalAmounts: Record<string, number>;
  entryCount: number;
  entries: ReportEntry[];
}

export interface RateLabelSummary {
  label: string;
  kind: string;
  currency: string;
  totalMinutes: number;
  totalQuantity: number;
  totalAmount: number;
  entryCount: number;
}

export interface ReportData {
  entries: ReportEntry[];
  fixedCharges: FixedChargeEntry[];
  summary: ReportSummary;
  byClient: ClientSummary[];
  byProject: ProjectSummary[];
  byDate?: DateSummary[];
  byWeek?: WeekSummary[];
  byRateLabel?: RateLabelSummary[];
}

type PdfTemplate = "modern" | "classic" | "bold" | "elegant" | "nature" | "ocean";

interface ReportPreset {
  id: string;
  name: string;
  clientId: string | null;
  projectId: string | null;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
}


export default function AdHocReportTab() {
  const t = useTranslations("Reports");
  const locale = useLocale();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [clients, setClients] = useState<Client[]>([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const [showSavePresetDialog, setShowSavePresetDialog] = useState(false);
  const [showLoadPresetDialog, setShowLoadPresetDialog] = useState(false);
  const [presets, setPresets] = useState<ReportPreset[]>([]);
  const [presetsLoading, setPresetsLoading] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [filters, setFilters] = useState({
    clientId: "",
    projectId: "",
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .split("T")[0], // First day of current month
    endDate: new Date().toISOString().split("T")[0], // Today
    includeFixedCharges: true,
  });
  const [error, setError] = useState("");
  const [showWorkTimes, setShowWorkTimes] = useState(false);

  // ── Document language (printed PDF / Excel) ──────────────────────────────
  // The generated document renders in the CLIENT's language, not the UI locale.
  // For a single selected client we resolve from its setting+currency; for
  // "all clients" we fall back to the UI locale. A manual He/En toggle can
  // override per print, and the override resets when the client changes.
  const selectedClient = filters.clientId
    ? clients.find((c) => c.id === filters.clientId)
    : undefined;
  const clientDocLocale: DocumentLanguage = selectedClient
    ? resolveDocumentLocale(
        (selectedClient.documentLanguage ?? null) as DocumentLanguage | null,
        selectedClient.currency || "ILS"
      )
    : locale === "en"
      ? "en"
      : "he";

  const [docLangOverride, setDocLangOverride] = useState<DocumentLanguage | null>(null);
  // Reset the manual override whenever the selected client changes.
  useEffect(() => {
    setDocLangOverride(null);
  }, [filters.clientId]);

  const docLocale: DocumentLanguage = docLangOverride ?? clientDocLocale;
  const docMessages = useDocumentMessages(docLocale);

  // Single bootstrap call: profile + clients + projects + presets in one
  // request (one DB transaction) instead of four parallel fetches.
  useEffect(() => {
    const fetchInit = async () => {
      setClientsLoading(true);
      setProjectsLoading(true);
      setPresetsLoading(true);
      try {
        const response = await fetch("/api/reports/init");
        const data = await response.json();
        if (!data.success) return;

        if (data.profile) {
          setUserProfile({
            businessName: data.profile.businessName,
            logoUrl: data.profile.logoUrl,
            phone: data.profile.phone,
            email: data.profile.email,
            address: data.profile.address,
            taxId: data.profile.taxId,
            defaultCurrency: data.profile.defaultCurrency,
            preferredPdfTemplate: data.profile.preferredPdfTemplate || "modern",
            pdfPrimaryColor: data.profile.pdfPrimaryColor || "#A8622D",
            pdfAccentColor: data.profile.pdfAccentColor || "#347B52",
          });
        }

        setClients(data.clients || []);
        setProjects(data.projects || []);
        setPresets(data.presets || []);
      } catch (error) {
        console.error("Error loading reports init:", error);
      } finally {
        setClientsLoading(false);
        setProjectsLoading(false);
        setPresetsLoading(false);
      }
    };

    fetchInit();
  }, []);

  // Check for URL parameters on mount (for shared links)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const clientId = params.get("clientId");
    const projectId = params.get("projectId");
    const startDate = params.get("startDate");
    const endDate = params.get("endDate");
    const includeFixedCharges = params.get("includeFixedCharges");

    // If any filter parameters exist in URL, update filters and generate report
    if (clientId || projectId || startDate || endDate) {
      setFilters({
        clientId: clientId || "",
        projectId: projectId || "",
        startDate: startDate || new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          .toISOString()
          .split("T")[0],
        endDate: endDate || new Date().toISOString().split("T")[0],
        includeFixedCharges: includeFixedCharges !== "0",
      });

      // Auto-generate report after a short delay to ensure filters are set
      setTimeout(() => {
        generateReport();
      }, 100);
    }
    // Mount-only: parse shared-link URL params once. generateReport is a stable
    // closure here; adding it (or filters) would re-run on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const generateReport = async () => {
    setReportLoading(true);
    setError("");

    try {
      // Build query parameters
      const params = new URLSearchParams();
      if (filters.clientId) params.append("clientId", filters.clientId);
      if (filters.projectId) params.append("projectId", filters.projectId);
      if (filters.startDate) params.append("startDate", filters.startDate);
      if (filters.endDate) params.append("endDate", filters.endDate);
      params.append("includeFixedCharges", filters.includeFixedCharges ? "1" : "0");

      const response = await fetch(`/api/reports?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setReportData(data.report);
      } else {
        setError(data.message || t("report.generateError"));
      }
    } catch (error) {
      console.error("Error generating report:", error);
      setError(t("report.generateError"));
    } finally {
      setReportLoading(false);
    }
  };

  const handleSavePreset = async () => {
    if (!presetName.trim()) {
      showErrorToast(t("preset.nameRequired"));
      return;
    }

    try {
      const response = await fetch("/api/reports/presets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: presetName.trim(),
          clientId: filters.clientId || null,
          projectId: filters.projectId || null,
          startDate: filters.startDate || null,
          endDate: filters.endDate || null,
        }),
      });

      const data = await response.json();

      if (data.success) {
        showSuccessToast(t("preset.saved"));
        setPresetName("");
        setShowSavePresetDialog(false);

        // Refresh presets list
        const presetsResponse = await fetch("/api/reports/presets");
        const presetsData = await presetsResponse.json();
        if (presetsData.success) {
          setPresets(presetsData.presets || []);
        }
      } else {
        showErrorToast(data.message || t("preset.saveError"));
      }
    } catch (error) {
      console.error("Error saving preset:", error);
      showErrorToast(t("preset.saveError"));
    }
  };

  const handleLoadPreset = async (preset: ReportPreset) => {
    setFilters({
      clientId: preset.clientId || "",
      projectId: preset.projectId || "",
      startDate: preset.startDate || new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        .toISOString()
        .split("T")[0],
      endDate: preset.endDate || new Date().toISOString().split("T")[0],
      includeFixedCharges: true,
    });
    setShowLoadPresetDialog(false);
    showSuccessToast(t("preset.loaded"));
  };

  const handleDeletePreset = async (presetId: string) => {
    try {
      const response = await fetch(`/api/reports/presets/${presetId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (data.success) {
        showSuccessToast(t("preset.deleted"));

        // Refresh presets list
        const presetsResponse = await fetch("/api/reports/presets");
        const presetsData = await presetsResponse.json();
        if (presetsData.success) {
          setPresets(presetsData.presets || []);
        }
      } else {
        showErrorToast(data.message || t("preset.deleteError"));
      }
    } catch (error) {
      console.error("Error deleting preset:", error);
      showErrorToast(t("preset.deleteError"));
    }
  };

  const handleClientChange = (clientId: string) => {
    setFilters({ ...filters, clientId, projectId: "" }); // Reset project when client changes
  };

  const getFilteredProjects = () => {
    if (!filters.clientId) return projects;
    return projects.filter((p) => p.clientId === filters.clientId);
  };

  // Locale-aware duration ("2 שע׳ 30 דק׳" / "2h 30m").
  const formatDuration = (minutes: number) => formatDurationLib(minutes, locale);

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

  const handleExportPdf = () => {
    // Guard: the print routine clones `#pdf-content`, which only renders once
    // the document-language messages have loaded. Never print an empty subtree.
    if (!docMessages) return;
    const template = (userProfile?.preferredPdfTemplate || "modern") as PdfTemplate;
    confirmExportPdf(template);
  };

  const confirmExportPdf = (template: PdfTemplate) => {
    // Delegate to the shared, direction-aware print helper (same routine the
    // charge-document view uses) so RTL/LTR and template styling stay consistent.
    const clientName = filters.clientId
      ? clients.find((c) => c.id === filters.clientId)?.name || "all-clients"
      : "all-clients";
    const dateRange = `${filters.startDate}_to_${filters.endDate}`;
    const pdfFilename = `report_${dateRange}_${clientName}`;
    const primaryColor = userProfile?.pdfPrimaryColor || "#A8622D";
    const accentColor = userProfile?.pdfAccentColor || "#347B52";
    // Hebrew documents print RTL, English LTR — keyed on the DOCUMENT locale
    // (the client's language / manual override), not the freelancer's UI locale.
    printPdfContent(
      template,
      primaryColor,
      accentColor,
      pdfFilename,
      docLocale === "he" ? "rtl" : "ltr"
    );
  };

  const handleExportExcel = async () => {
    try {
      // Build query parameters
      const params = new URLSearchParams();
      if (filters.clientId) params.append("clientId", filters.clientId);
      if (filters.projectId) params.append("projectId", filters.projectId);
      if (filters.startDate) params.append("startDate", filters.startDate);
      if (filters.endDate) params.append("endDate", filters.endDate);
      params.append("includeFixedCharges", filters.includeFixedCharges ? "1" : "0");
      // Excel headers/labels render in the DOCUMENT locale (client language),
      // not the UI locale. The route builds locale-keyed labels from ?locale=.
      params.append("locale", docLocale);

      // Fetch Excel file from API
      const response = await fetch(`/api/reports/excel?${params.toString()}`);

      if (!response.ok) {
        throw new Error(t("excel.error"));
      }

      // Get blob and create download link
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;

      // Extract filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get("Content-Disposition");
      let filename = `report_${new Date().toISOString().split("T")[0]}.xlsx`;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/i);
        if (filenameMatch && filenameMatch[1]) {
          filename = decodeURIComponent(filenameMatch[1]);
        }
      }

      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      showSuccessToast(t("excel.success"));
    } catch (error) {
      console.error("Error exporting Excel:", error);
      showErrorToast(t("excel.error"));
    }
  };

  const handleShareReport = async () => {
    try {
      // Build shareable URL with current filters
      const params = new URLSearchParams();
      if (filters.clientId) params.append("clientId", filters.clientId);
      if (filters.projectId) params.append("projectId", filters.projectId);
      if (filters.startDate) params.append("startDate", filters.startDate);
      if (filters.endDate) params.append("endDate", filters.endDate);
      params.append("includeFixedCharges", filters.includeFixedCharges ? "1" : "0");

      const baseUrl = window.location.origin + "/reports";
      const shareUrl = `${baseUrl}?${params.toString()}`;

      // Copy to clipboard
      await navigator.clipboard.writeText(shareUrl);
      showSuccessToast(t("share.copied"));

      // Optional: Auto-generate report when shared link is opened
      // This will be handled by useEffect that reads URL params on mount
    } catch (error) {
      console.error("Error copying link:", error);
      showErrorToast(t("share.error"));
    }
  };
  return (
    <>
        {/* Filters Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-bold text-lg">{t("filters.title")}</h2>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="min-h-[44px] px-4 py-2 text-sm font-medium text-primary hover:bg-primary-light rounded-[var(--radius-card)] transition-colors"
            >
              {showFilters ? t("filters.hide") : t("filters.show")}
            </button>
          </div>

          {showFilters && (
            <div className="rounded-[var(--radius-card)] border border-border bg-card p-4 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Start date */}
                <div>
                  <label htmlFor="reportStartDate" className="block text-sm font-medium text-foreground mb-1">{t("filters.startDate")}</label>
                  <input
                    type="date"
                    id="reportStartDate"
                    value={filters.startDate}
                    onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                    className="block w-full rounded-[var(--radius)] border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                {/* End date */}
                <div>
                  <label htmlFor="reportEndDate" className="block text-sm font-medium text-foreground mb-1">{t("filters.endDate")}</label>
                  <input
                    type="date"
                    id="reportEndDate"
                    value={filters.endDate}
                    onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                    className="block w-full rounded-[var(--radius)] border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                {/* Client */}
                <div>
                  <label htmlFor="reportClient" className="block text-sm font-medium text-foreground mb-1">{t("filters.client")}</label>
                  <SimpleSelect
                    id="reportClient"
                    value={filters.clientId}
                    onChange={(v) => handleClientChange(v)}
                    disabled={clientsLoading}
                    options={[
                      { value: "", label: t("filters.allClients") },
                      ...clients.map((client) => ({ value: client.id, label: client.name })),
                    ]}
                  />
                </div>

                {/* Project */}
                <div>
                  <label htmlFor="reportProject" className="block text-sm font-medium text-foreground mb-1">{t("filters.project")}</label>
                  <SimpleSelect
                    id="reportProject"
                    value={filters.projectId}
                    onChange={(v) => setFilters({ ...filters, projectId: v })}
                    disabled={projectsLoading || !filters.clientId}
                    options={[
                      { value: "", label: t("filters.allProjects") },
                      ...getFilteredProjects().map((project) => ({ value: project.id, label: project.name })),
                    ]}
                  />
                </div>
              </div>

              {/* Toggles */}
              <div className="flex flex-col gap-3 border-t border-border pt-4">
                <label className="flex items-start gap-2 text-sm font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.includeFixedCharges}
                    onChange={(e) => setFilters({ ...filters, includeFixedCharges: e.target.checked })}
                    className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
                  />
                  <span>
                    {t("filters.includeFixed")}
                    <span className="block text-xs font-normal text-muted-foreground">{t("filters.includeFixedHint")}</span>
                  </span>
                </label>
                <label className="flex items-start gap-2 text-sm font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showWorkTimes}
                    onChange={(e) => setShowWorkTimes(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
                  />
                  <span>
                    {t("filters.showWorkTimes")}
                    <span className="block text-xs font-normal text-muted-foreground">{t("filters.showWorkTimesHint")}</span>
                  </span>
                </label>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                <button
                  onClick={generateReport}
                  disabled={reportLoading}
                  className="rounded-[var(--radius-card)] bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {reportLoading ? t("report.generating") : t("report.generate")}
                </button>
                <button
                  onClick={() => setShowLoadPresetDialog(true)}
                  disabled={presetsLoading || presets.length === 0}
                  className="rounded-[var(--radius-card)] border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-surface transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title={presets.length === 0 ? t("preset.noneSaved") : t("preset.load")}
                >
                  {t("preset.load")}
                </button>
                <button
                  onClick={() => setShowSavePresetDialog(true)}
                  className="rounded-[var(--radius-card)] border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-surface transition-colors"
                  title={t("preset.save")}
                >
                  {t("preset.save")}
                </button>
                <button
                  onClick={() =>
                    setFilters({
                      clientId: "",
                      projectId: "",
                      startDate: new Date(
                        new Date().getFullYear(),
                        new Date().getMonth(),
                        1
                      )
                        .toISOString()
                        .split("T")[0],
                      endDate: new Date().toISOString().split("T")[0],
                      includeFixedCharges: true,
                    })
                  }
                  className="rounded-[var(--radius-card)] px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-surface hover:text-foreground transition-colors"
                >
                  {t("filters.clear")}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive rounded-[var(--radius-card)]">
            <p className="text-destructive">{error}</p>
          </div>
        )}

        {/* Report Results */}
        {reportData && !reportLoading && (
          <div className="space-y-6">
            {/* Export Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3 no-print">
              {/* Document-language toggle: which language the printed PDF /
                  Excel render in (client language, with manual He/En override). */}
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

              <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={handleShareReport}
                className="flex items-center gap-2 px-6 py-3 bg-accent text-accent-foreground rounded-full hover:bg-accent/90 transition-colors shadow-md"
                title={t("share.copyTooltip")}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                {t("share.button")}
              </button>
              <button
                onClick={handleExportExcel}
                className="flex items-center gap-2 px-6 py-3 bg-secondary text-secondary-foreground rounded-full hover:bg-secondary/80 transition-colors shadow-md"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                {t("excel.button")}
              </button>
              <button
                onClick={handleExportPdf}
                disabled={!docMessages}
                className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-full hover:bg-primary/90 transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                {t("pdf.button")}
              </button>
              </div>
            </div>

            {/* Printable report subtree — rendered under a nested provider in
                the CLIENT's document language (own useTranslations/useLocale).
                Cloned to <body> by the print routine. Gated on docMessages so the
                subtree is mounted before window.print() runs. */}
            {docMessages && (
              <NextIntlClientProvider locale={docLocale} messages={docMessages}>
                <PdfReportContent
                  report={reportData}
                  userProfile={userProfile}
                  filters={filters}
                  showWorkTimes={showWorkTimes}
                />
              </NextIntlClientProvider>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="bg-card border border-border/50 rounded-[var(--radius-card)] p-6 border-s-4 border-s-accent">
                <h3 className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
                  {t("summary.totalHours")}
                </h3>
                <p className="font-mono text-2xl font-bold tabular-nums">
                  {t("summary.hoursValue", { hours: reportData.summary.totalHours.toFixed(1) })}
                </p>
              </div>
              <div className="bg-card border border-border/50 rounded-[var(--radius-card)] p-6 border-s-4 border-s-secondary">
                <h3 className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
                  {t("summary.totalEntries")}
                </h3>
                <p className="font-mono text-2xl font-bold tabular-nums">
                  {reportData.summary.totalEntries}
                </p>
              </div>
              <div className="bg-card border border-border/50 rounded-[var(--radius-card)] p-6 border-s-4 border-s-primary">
                <h3 className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
                  {t("summary.totalAmount")}
                </h3>
                {Object.keys(reportData.summary.totalAmounts).length > 0 ? (
                  <div className="space-y-1">
                    {Object.entries(reportData.summary.totalAmounts).map(
                      ([currency, amount]) => (
                        <p
                          key={currency}
                          className="font-mono text-2xl font-bold tabular-nums"
                        >
                          {formatCurrency(amount, currency)}
                        </p>
                      )
                    )}
                  </div>
                ) : (
                  <p className="text-lg text-muted-foreground">{t("summary.notAvailable")}</p>
                )}
              </div>
              <div className="bg-card border border-border/50 rounded-[var(--radius-card)] p-6 border-s-4 border-s-accent">
                <h3 className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
                  {t("sections.fixedCharges")}
                </h3>
                {Object.keys(reportData.summary.fixedAmounts || {}).length > 0 ? (
                  <div className="space-y-1">
                    {Object.entries(reportData.summary.fixedAmounts).map(
                      ([currency, amount]) => (
                        <p
                          key={currency}
                          className="font-mono text-2xl font-bold tabular-nums"
                        >
                          {formatCurrency(amount, currency)}
                        </p>
                      )
                    )}
                  </div>
                ) : (
                  <p className="text-lg text-muted-foreground">0.00</p>
                )}
              </div>
              <div className="bg-card border border-border/50 rounded-[var(--radius-card)] p-6 border-s-4 border-s-success">
                <h3 className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
                  {t("summary.period")}
                </h3>
                <p className="text-lg font-semibold">
                  {t("summary.periodRange", { start: filters.startDate, end: filters.endDate })}
                </p>
              </div>
            </div>

            {/* By Client Summary */}
            {reportData.byClient.length > 0 && (
              <div className="bg-card border border-border/50 rounded-[var(--radius-card)] p-6">
                <h3 className="font-display text-lg font-bold mb-4">{t("sections.byClient")}</h3>
                <div className="space-y-3">
                  {reportData.byClient.map((client) => (
                    <div
                      key={client.clientId}
                      className="flex items-center justify-between p-3 bg-surface/50 hover:bg-surface rounded-[var(--radius)] border border-border/30 transition-colors"
                    >
                      <div className="flex-1">
                        <p className="font-medium"><bdi>{client.clientName}</bdi></p>
                        <p className="text-sm text-muted-foreground">
                          {t("summary.recordCount", { count: client.entries.length })}
                        </p>
                      </div>
                      <div className="text-end">
                        <p className="font-mono text-lg font-semibold">
                          {formatDuration(client.totalMinutes)}
                        </p>
                        {Object.keys(client.totalAmounts).length > 0 && (
                          <p className="text-sm text-muted-foreground">
                            {Object.entries(client.totalAmounts)
                              .map(([currency, amount]) =>
                                formatCurrency(amount, currency)
                              )
                              .join(" + ")}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* By Project Summary */}
            {reportData.byProject.length > 0 && (
              <div className="bg-card border border-border/50 rounded-[var(--radius-card)] p-6">
                <h3 className="font-display text-lg font-bold mb-4">{t("sections.byProject")}</h3>
                <div className="space-y-3">
                  {reportData.byProject.map((project) => (
                    <div
                      key={project.projectId}
                      className="flex items-center justify-between p-3 bg-surface/50 hover:bg-surface rounded-[var(--radius)] border border-border/30 transition-colors"
                    >
                      <div className="flex-1">
                        <p className="font-medium"><bdi>{project.projectName}</bdi></p>
                        <p className="text-sm text-muted-foreground">
                          <bdi>{project.clientName}</bdi> • {project.pricingModel}
                        </p>
                        {project.hourlyRate && (
                          <p className="text-sm text-muted-foreground">
                            {t("report.perHour", { amount: formatCurrency(project.hourlyRate, project.currency) })}
                          </p>
                        )}
                      </div>
                      <div className="text-end">
                        <p className="font-mono text-lg font-semibold">
                          {formatDuration(project.totalMinutes)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {t("summary.recordCount", { count: project.entries.length })}
                        </p>
                        {project.totalAmount > 0 && (
                          <p className="text-sm font-medium">
                            {formatCurrency(project.totalAmount, project.currency)}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* By Rate Label Summary (breakdown by work-type / item) */}
            {reportData.byRateLabel && reportData.byRateLabel.length > 0 && (
              <div className="bg-card border border-border/50 rounded-[var(--radius-card)] p-6">
                <h3 className="font-display text-lg font-bold mb-4">{t("sections.byLabel")}</h3>
                <div className="space-y-3">
                  {reportData.byRateLabel.map((row, index) => (
                    <div
                      key={`${row.label}-${row.currency}-${index}`}
                      className="flex items-center justify-between p-3 bg-surface/50 hover:bg-surface rounded-[var(--radius)] border border-border/30 transition-colors"
                    >
                      <div className="flex-1">
                        <p className="font-medium">
                          <bdi>{row.label}</bdi>
                          <span className="ms-2 text-xs text-muted-foreground">
                            {row.kind === "item" ? t("kind.item") : t("kind.hours")}
                          </span>
                        </p>
                        <p className="text-sm text-muted-foreground">{t("summary.recordCount", { count: row.entryCount })}</p>
                      </div>
                      <div className="text-end">
                        <p className="font-mono text-lg font-semibold">{formatMeasure(row)}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatCurrency(row.totalAmount, row.currency)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {reportData.fixedCharges && reportData.fixedCharges.length > 0 && (
              <div className="bg-card border border-border/50 rounded-[var(--radius-card)] p-6">
                <h3 className="font-display text-lg font-bold mb-4">{t("sections.fixedCharges")}</h3>
                <div className="space-y-3">
                  {reportData.fixedCharges.map((line, index) => (
                    <div
                      key={`${line.projectId}-${line.month}-${index}`}
                      className="flex items-center justify-between p-3 bg-surface/50 hover:bg-surface rounded-[var(--radius)] border border-border/30 transition-colors"
                    >
                      <div className="flex-1">
                        <p className="font-medium"><bdi>{line.projectName}</bdi></p>
                        <p className="text-sm text-muted-foreground">
                          <bdi>{line.clientName}</bdi> • {line.month}
                        </p>
                      </div>
                      <div className="text-end">
                        <p className="font-mono text-lg font-semibold">
                          {formatCurrency(line.amount, line.currency)}
                        </p>
                        <p className="text-sm text-muted-foreground">{t("report.fixedMonthly")}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* By Date Summary (Daily Breakdown) */}
            {reportData.byDate && reportData.byDate.length > 0 && (
              <div className="bg-card border border-border/50 rounded-[var(--radius-card)] p-6">
                <h3 className="font-display text-lg font-bold mb-4">{t("sections.byDate")}</h3>
                <div className="space-y-2">
                  {reportData.byDate.map((dateSummary) => (
                    <div
                      key={dateSummary.date}
                      className="flex items-center justify-between p-3 bg-surface/50 hover:bg-surface rounded-[var(--radius)] border border-border/30 transition-colors"
                    >
                      <div className="flex-1">
                        <p className="font-medium">{formatDate(dateSummary.date)}</p>
                        <p className="text-sm text-muted-foreground">
                          {t("summary.recordCount", { count: dateSummary.entryCount })}
                        </p>
                      </div>
                      <div className="text-end">
                        <p className="font-mono text-lg font-semibold">
                          {formatDuration(dateSummary.totalMinutes)}
                        </p>
                        {Object.keys(dateSummary.totalAmounts).length > 0 && (
                          <p className="text-sm text-muted-foreground">
                            {Object.entries(dateSummary.totalAmounts)
                              .map(([currency, amount]) =>
                                formatCurrency(amount, currency)
                              )
                              .join(" + ")}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* By Week Summary (Weekly Breakdown) */}
            {reportData.byWeek && reportData.byWeek.length > 0 && (
              <div className="bg-card border border-border/50 rounded-[var(--radius-card)] p-6">
                <h3 className="font-display text-lg font-bold mb-4">{t("sections.byWeek")}</h3>
                <div className="space-y-2">
                  {reportData.byWeek.map((weekSummary) => (
                    <div
                      key={weekSummary.weekStart}
                      className="flex items-center justify-between p-3 bg-surface/50 hover:bg-surface rounded-[var(--radius)] border border-border/30 transition-colors"
                    >
                      <div className="flex-1">
                        <p className="font-medium">
                          {t("summary.weekRange", { start: weekSummary.weekStart, end: weekSummary.weekEnd })}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {t("summary.recordCount", { count: weekSummary.entryCount })}
                        </p>
                      </div>
                      <div className="text-end">
                        <p className="font-mono text-lg font-semibold">
                          {formatDuration(weekSummary.totalMinutes)}
                        </p>
                        {Object.keys(weekSummary.totalAmounts).length > 0 && (
                          <p className="text-sm text-muted-foreground">
                            {Object.entries(weekSummary.totalAmounts)
                              .map(([currency, amount]) =>
                                formatCurrency(amount, currency)
                              )
                              .join(" + ")}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Detailed Entries Table */}
            {reportData.entries.length > 0 && (
              <div className="bg-card border border-border/50 rounded-[var(--radius-card)] overflow-hidden">
                <div className="p-6 border-b border-border">
                  <h3 className="font-display text-lg font-bold">{t("sections.detailedEntries")}</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-surface">
                      <tr>
                        <th className="px-6 py-3 text-start text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                          {t("columns.date")}
                        </th>
                        <th className="px-6 py-3 text-start text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                          {t("columns.client")}
                        </th>
                        <th className="px-6 py-3 text-start text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                          {t("columns.project")}
                        </th>
                        <th className="px-6 py-3 text-start text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                          {t("columns.description")}
                        </th>
                        <th className="px-6 py-3 text-start text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                          {t("columns.duration")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.entries.map((entry, index) => (
                        <tr key={entry.id} className={`hover:bg-surface transition-colors ${index % 2 === 0 ? '' : 'even:bg-surface/50'}`}>
                          <td className="px-6 py-4 text-sm">{formatDate(entry.date)}</td>
                          <td className="px-6 py-4 text-sm">
                            <bdi>{entry.clientName}</bdi>
                          </td>
                          <td className="px-6 py-4 text-sm">
                            <bdi>{entry.projectName}</bdi>
                          </td>
                          <td className="px-6 py-4 text-sm">
                            <bdi>{entry.description}</bdi>
                            {entry.notes && (
                              <span className="ms-1 text-xs text-muted-foreground">(<bdi>{entry.notes}</bdi>)</span>
                            )}
                            {entry.rateLabel && (
                              <span className="ms-2 text-xs text-muted-foreground">· <bdi>{entry.rateLabel}</bdi></span>
                            )}
                            {entry.billingKind === "item" && entry.itemRef != null && (
                              <span className="ms-1 text-xs text-muted-foreground font-mono tabular-nums">· {t("units.ref", { ref: entry.itemRef })}</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm font-mono font-semibold">
                            {entry.billingKind === "item"
                              ? (entry.unit
                                  ? t("units.itemsWithUnit", { count: entry.quantity ?? 0, unit: entry.unit })
                                  : t("units.items", { count: entry.quantity ?? 0 }))
                              : formatDuration(entry.duration)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* No Data Message */}
            {reportData.entries.length === 0 && (!reportData.fixedCharges || reportData.fixedCharges.length === 0) && (
              <div className="bg-card border rounded-[var(--radius-card)] p-12 text-center">
                <p className="text-muted-foreground text-lg mb-4">
                  {t("report.noEntries")}
                </p>
                <div className="flex gap-3 justify-center">
                  <Link
                    href="/entries"
                    className="rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
                  >
                    {t("report.logTimeNow")}
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}

        {/* No Report Generated Yet */}
        {!reportData && !reportLoading && (
          <div className="bg-card border rounded-[var(--radius-card)] p-12 text-center">
            <p className="text-muted-foreground text-lg mb-4">
              {t("report.noReportYet")}
            </p>
          </div>
        )}
      {/* Save Preset Dialog */}
      <Dialog open={showSavePresetDialog} onOpenChange={(open) => { if (!open) { setShowSavePresetDialog(false); setPresetName(""); } }}>
        <DialogContent className="p-0">
          <div className="border-b p-6">
            <DialogHeader>
              <DialogTitle className="font-mono text-2xl font-bold tabular-nums">{t("preset.saveTitle")}</DialogTitle>
              <DialogDescription>
                {t("preset.saveDescription")}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">{t("preset.nameLabel")}</label>
              <input
                type="text"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                placeholder={t("preset.namePlaceholder")}
                className="w-full px-3 py-2 border rounded-[var(--radius)] bg-background"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && presetName.trim()) {
                    handleSavePreset();
                  }
                }}
              />
            </div>

            <div className="bg-muted/50 rounded-[var(--radius)] p-4 space-y-2 text-sm">
              <p className="font-medium">{t("preset.filterSettings")}</p>
              <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                <div>{t("preset.startDateLabel")}</div>
                <div className="text-end">{filters.startDate || t("preset.notSelected")}</div>
                <div>{t("preset.endDateLabel")}</div>
                <div className="text-end">{filters.endDate || t("preset.notSelected")}</div>
                <div>{t("preset.clientLabel")}</div>
                <div className="text-end">
                  {filters.clientId
                    ? clients.find((c) => c.id === filters.clientId)?.name || t("preset.notSelected")
                    : t("filters.allClients")}
                </div>
                <div>{t("preset.projectLabel")}</div>
                <div className="text-end">
                  {filters.projectId
                    ? projects.find((p) => p.id === filters.projectId)?.name || t("preset.notSelected")
                    : t("filters.allProjects")}
                </div>
              </div>
            </div>
          </div>

          <div className="border-t p-6 flex gap-3">
            <button
              onClick={handleSavePreset}
              disabled={!presetName.trim()}
              className="flex-1 px-6 py-2 bg-primary text-primary-foreground rounded-full hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t("actions.save")}
            </button>
            <DialogClose asChild>
              <button
                className="px-6 py-2 border border-border rounded-full hover:bg-accent transition-colors"
              >
                {t("actions.cancel")}
              </button>
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>

      {/* Load Preset Dialog */}
      <Dialog open={showLoadPresetDialog} onOpenChange={(open) => { if (!open) setShowLoadPresetDialog(false); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto p-0">
          <div className="sticky top-0 bg-card border-b p-6 z-10">
            <DialogHeader>
              <DialogTitle className="font-mono text-2xl font-bold tabular-nums">{t("preset.loadTitle")}</DialogTitle>
              <DialogDescription>
                {t("preset.loadDescription")}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="p-6">
            {presets.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>{t("preset.noneSaved")}</p>
                <p className="text-sm mt-2">{t("preset.noneSavedHint")}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {presets.map((preset) => (
                  <div
                    key={preset.id}
                    className="border rounded-[var(--radius-card)] p-4 hover:border-primary/50 hover:transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg mb-2"><bdi>{preset.name}</bdi></h3>
                        <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                          <div>{t("preset.startDateLabel")}</div>
                          <div className="text-end">{preset.startDate || t("preset.notSelected")}</div>
                          <div>{t("preset.endDateLabel")}</div>
                          <div className="text-end">{preset.endDate || t("preset.notSelected")}</div>
                          <div>{t("preset.clientLabel")}</div>
                          <div className="text-end">
                            {preset.clientId
                              ? clients.find((c) => c.id === preset.clientId)?.name || t("preset.notSelected")
                              : t("filters.allClients")}
                          </div>
                          <div>{t("preset.projectLabel")}</div>
                          <div className="text-end">
                            {preset.projectId
                              ? projects.find((p) => p.id === preset.projectId)?.name || t("preset.notSelected")
                              : t("filters.allProjects")}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 me-4">
                        <button
                          onClick={() => handleLoadPreset(preset)}
                          className="px-4 py-2 bg-primary text-primary-foreground rounded-full hover:bg-primary/90 transition-colors text-sm"
                        >
                          {t("preset.loadAction")}
                        </button>
                        <button
                          onClick={() => handleDeletePreset(preset.id)}
                          className="px-4 py-2 bg-destructive text-destructive-foreground rounded-full hover:bg-destructive/90 transition-colors text-sm"
                        >
                          {t("preset.deleteAction")}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="sticky bottom-0 bg-card border-t p-6">
            <DialogClose asChild>
              <button
                className="w-full px-6 py-2 border border-border rounded-full hover:bg-accent transition-colors"
              >
                {t("actions.close")}
              </button>
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
