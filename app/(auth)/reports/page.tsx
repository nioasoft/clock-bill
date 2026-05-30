"use client";

import { useEffect, useState } from "react";
import { AppLayout } from "@/components/app-layout";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { showSuccessToast, showErrorToast } from "@/lib/toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";

interface UserProfile {
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

interface Project {
  id: string;
  name: string;
  clientId: string;
  clientName: string;
}

interface Client {
  id: string;
  name: string;
}

interface ReportEntry {
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

interface ReportData {
  entries: ReportEntry[];
  fixedCharges: FixedChargeEntry[];
  summary: ReportSummary;
  byClient: ClientSummary[];
  byProject: ProjectSummary[];
  byDate?: DateSummary[];
  byWeek?: WeekSummary[];
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


export default function ReportsPage() {
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
  const [displayCurrency, setDisplayCurrency] = useState<string>("original");
  const [currencyRates, setCurrencyRates] = useState<Record<string, Record<string, number>>>({});

  useEffect(() => {
    const fetchUserProfile = async () => {

      try {
        const response = await fetch("/api/profile");
        const data = await response.json();

        if (data.success && data.profile) {
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
      } catch (error) {
        console.error("Error fetching user profile:", error);
      }
    };

    fetchUserProfile();
  }, []);

  useEffect(() => {
    const fetchClients = async () => {

      try {
        setClientsLoading(true);
        const response = await fetch("/api/clients");
        const data = await response.json();

        if (data.success) {
          setClients(data.clients || []);
        }
      } catch (error) {
        console.error("Error fetching clients:", error);
      } finally {
        setClientsLoading(false);
      }
    };

    fetchClients();
  }, []);

  useEffect(() => {
    const fetchProjects = async () => {

      try {
        setProjectsLoading(true);
        const response = await fetch("/api/projects");
        const data = await response.json();

        if (data.success) {
          setProjects(data.projects || []);
        }
      } catch (error) {
        console.error("Error fetching projects:", error);
      } finally {
        setProjectsLoading(false);
      }
    };

    fetchProjects();
  }, []);

  useEffect(() => {
    const fetchPresets = async () => {

      try {
        setPresetsLoading(true);
        const response = await fetch("/api/reports/presets");
        const data = await response.json();

        if (data.success) {
          setPresets(data.presets || []);
        }
      } catch (error) {
        console.error("Error fetching presets:", error);
      } finally {
        setPresetsLoading(false);
      }
    };

    fetchPresets();
  }, []);

  useEffect(() => {
    const fetchCurrencyRates = async () => {

      try {
        const response = await fetch("/api/currency-rates");
        const data = await response.json();

        if (data.success && data.rates) {
          // Build a nested map: rates[fromCurrency][toCurrency] = rate
          const ratesMap: Record<string, Record<string, number>> = {};
          data.rates.forEach((rate: { fromCurrency: string; toCurrency: string; rate: number }) => {
            if (!ratesMap[rate.fromCurrency]) {
              ratesMap[rate.fromCurrency] = {};
            }
            ratesMap[rate.fromCurrency][rate.toCurrency] = rate.rate;
          });
          setCurrencyRates(ratesMap);
        }
      } catch (error) {
        console.error("Error fetching currency rates:", error);
      }
    };

    fetchCurrencyRates();
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
        setError(data.message || "שגיאה ביצירת הדוח");
      }
    } catch (error) {
      console.error("Error generating report:", error);
      setError("שגיאה ביצירת הדוח");
    } finally {
      setReportLoading(false);
    }
  };

  const handleSavePreset = async () => {
    if (!presetName.trim()) {
      showErrorToast("נא להזין שם לפריסט");
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
        showSuccessToast("הפריסט נשמר בהצלחה");
        setPresetName("");
        setShowSavePresetDialog(false);

        // Refresh presets list
        const presetsResponse = await fetch("/api/reports/presets");
        const presetsData = await presetsResponse.json();
        if (presetsData.success) {
          setPresets(presetsData.presets || []);
        }
      } else {
        showErrorToast(data.message || "שגיאה בשמירת הפריסט");
      }
    } catch (error) {
      console.error("Error saving preset:", error);
      showErrorToast("שגיאה בשמירת הפריסט");
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
    showSuccessToast("הפריסט נטען בהצלחה");
  };

  const handleDeletePreset = async (presetId: string) => {
    try {
      const response = await fetch(`/api/reports/presets/${presetId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (data.success) {
        showSuccessToast("הפריסט נמחק בהצלחה");

        // Refresh presets list
        const presetsResponse = await fetch("/api/reports/presets");
        const presetsData = await presetsResponse.json();
        if (presetsData.success) {
          setPresets(presetsData.presets || []);
        }
      } else {
        showErrorToast(data.message || "שגיאה במחיקת הפריסט");
      }
    } catch (error) {
      console.error("Error deleting preset:", error);
      showErrorToast("שגיאה במחיקת הפריסט");
    }
  };

  const handleClientChange = (clientId: string) => {
    setFilters({ ...filters, clientId, projectId: "" }); // Reset project when client changes
  };

  const getFilteredProjects = () => {
    if (!filters.clientId) return projects;
    return projects.filter((p) => p.clientId === filters.clientId);
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins} דק׳`;
    if (mins === 0) return `${hours} שע׳`;
    return `${hours} שע׳ ${mins} דק׳`;
  };

  const formatCurrency = (amount: number, currency: string) => {
    const symbols: Record<string, string> = {
      ILS: "₪",
      USD: "$",
      USDT: "₮",
      BTC: "₿",
      ETH: "Ξ",
    };
    return `${symbols[currency] || currency}${amount.toFixed(2)}`;
  };

  // Convert amount from one currency to another using stored rates
  const convertCurrency = (amount: number, fromCurrency: string, toCurrency: string): number => {
    if (fromCurrency === toCurrency) return amount;
    if (!currencyRates[fromCurrency] || !currencyRates[fromCurrency][toCurrency]) {
      console.warn(`No rate found for ${fromCurrency} -> ${toCurrency}`);
      return amount; // Return original if no conversion rate available
    }
    return amount * currencyRates[fromCurrency][toCurrency];
  };

  // Convert totalAmounts object to target currency
  const convertAmounts = (amounts: Record<string, number>, targetCurrency: string): number => {
    if (targetCurrency === "original") {
      // Return sum of all amounts (mixed currencies)
      return Object.values(amounts).reduce((sum, amount) => sum + amount, 0);
    }

    return Object.entries(amounts).reduce((sum, [currency, amount]) => {
      return sum + convertCurrency(amount, currency, targetCurrency);
    }, 0);
  };

  const handleExportPdf = () => {
    const template = (userProfile?.preferredPdfTemplate || "modern") as PdfTemplate;
    confirmExportPdf(template);
  };

  const confirmExportPdf = (template: PdfTemplate) => {
    // Set document title for PDF filename (date + client name)
    const originalTitle = document.title;
    const clientName = filters.clientId
      ? clients.find((c) => c.id === filters.clientId)?.name || "all-clients"
      : "all-clients";
    const dateRange = `${filters.startDate}_to_${filters.endDate}`;
    // Sanitize filename: remove spaces, use Hebrew-friendly format
    const pdfFilename = `report_${dateRange}_${clientName}`;
    document.title = pdfFilename;

    // Inject print styles dynamically
    const styleId = 'pdf-print-styles';
    let styleEl = document.getElementById(styleId) as HTMLStyleElement;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }

    // Define print styles for the selected template
    const getTemplateStyles = (t: PdfTemplate) => {
      // Get custom colors from user profile, with fallback defaults
      const primaryColor = userProfile?.pdfPrimaryColor || '#A8622D';
      const accentColor = userProfile?.pdfAccentColor || '#347B52';

      const baseStyles = `
        @media print {
          body > *:not(#pdf-content) { display: none !important; }
          #pdf-content {
            display: block !important;
            direction: rtl !important;
            font-family: -apple-system, 'Segoe UI', Arial, sans-serif;
            font-size: 13px;
            color: #1a1a1a;
            line-height: 1.5;
          }
          @page { size: A4; margin: 18mm 15mm; }
          body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .pdf-header { margin-bottom: 1.5rem; }
          .pdf-section { margin-bottom: 1.25rem; }
          .pdf-table { width: 100%; border-collapse: collapse; }
          .pdf-table th { padding: 8px 10px; text-align: right; font-size: 11px; font-weight: 600; }
          .pdf-table td { padding: 7px 10px; text-align: right; font-size: 12px; }
          .pdf-table tfoot td { font-weight: 600; }
          .pdf-section-title { font-size: 14px; font-weight: 700; margin: 0; }
        }
      `;

      const templateStyles: Record<PdfTemplate, string> = {
        modern: `
          ${baseStyles}
          @media print {
            .pdf-header { border-bottom: 3px solid ${primaryColor}; padding-bottom: 1.25rem; }
            .pdf-business-name { color: ${primaryColor}; font-size: 20px; }
            .pdf-section-title { color: ${primaryColor}; border-bottom: 1px solid #e5e5e5; padding-bottom: 6px; margin-bottom: 8px; }
            .pdf-table th { background: #f5f5f0 !important; color: #555; text-transform: uppercase; letter-spacing: 0.3px; border-bottom: 2px solid ${primaryColor}; }
            .pdf-table td { border-bottom: 1px solid #eee; }
            .pdf-table tfoot td { border-top: 2px solid ${primaryColor}; background: #faf9f7 !important; }
          }
        `,
        classic: `
          ${baseStyles}
          @media print {
            .pdf-header { border-bottom: 1px solid #333; padding-bottom: 1.25rem; }
            .pdf-business-name { font-size: 22px; font-weight: 700; font-family: Georgia, 'Times New Roman', serif; }
            .pdf-section-title { font-family: Georgia, serif; border-bottom: 1px double #999; padding-bottom: 4px; margin-bottom: 8px; }
            .pdf-table th { background: #f8f8f8 !important; color: #333; border-bottom: 2px solid #333; font-family: Georgia, serif; }
            .pdf-table td { border-bottom: 1px solid #ddd; }
            .pdf-table tfoot td { border-top: 2px solid #333; }
          }
        `,
        bold: `
          ${baseStyles}
          @media print {
            .pdf-header { border-right: 5px solid ${primaryColor}; padding-right: 1rem; padding-bottom: 1rem; }
            .pdf-business-name { font-size: 24px; font-weight: 900; color: ${primaryColor}; }
            .pdf-section-title { color: #1a1a1a; background: #f0ebe4 !important; padding: 6px 10px; margin-bottom: 0; }
            .pdf-table th { background: ${primaryColor} !important; color: white !important; text-transform: uppercase; letter-spacing: 0.5px; }
            .pdf-table td { border-bottom: 1px solid #e8e4de; }
            .pdf-table tfoot td { background: #f0ebe4 !important; border-top: 3px solid ${primaryColor}; }
          }
        `,
        elegant: `
          ${baseStyles}
          @media print {
            .pdf-header { border-bottom: 1px solid #d4c5b0; padding-bottom: 1.25rem; }
            .pdf-business-name { font-size: 20px; font-weight: 400; letter-spacing: 1px; color: #4a3728; }
            .pdf-section-title { color: #4a3728; font-weight: 400; letter-spacing: 0.5px; border-bottom: 1px solid #e8dfd4; padding-bottom: 4px; margin-bottom: 8px; }
            .pdf-table th { color: #8a7560; font-weight: 400; text-transform: uppercase; letter-spacing: 0.8px; font-size: 10px; border-bottom: 1px solid #d4c5b0; }
            .pdf-table td { border-bottom: 1px solid #f0ebe4; }
            .pdf-table tfoot td { border-top: 1px solid #d4c5b0; }
          }
        `,
        nature: `
          ${baseStyles}
          @media print {
            .pdf-header { border-bottom: 3px solid ${accentColor}; padding-bottom: 1.25rem; }
            .pdf-business-name { color: ${accentColor}; font-size: 20px; }
            .pdf-section-title { color: ${accentColor}; border-bottom: 1px solid #c8e6d5; padding-bottom: 6px; margin-bottom: 8px; }
            .pdf-table th { background: #eef7f1 !important; color: #2d5a3e; border-bottom: 2px solid ${accentColor}; }
            .pdf-table td { border-bottom: 1px solid #e8f4ec; }
            .pdf-table tbody tr:nth-child(even) td { background: #f7fbf9 !important; }
            .pdf-table tfoot td { border-top: 2px solid ${accentColor}; background: #eef7f1 !important; }
          }
        `,
        ocean: `
          ${baseStyles}
          @media print {
            .pdf-header { border-bottom: 3px solid #2563EB; padding-bottom: 1.25rem; }
            .pdf-business-name { color: #1e40af; font-size: 20px; }
            .pdf-section-title { color: #1e40af; border-bottom: 1px solid #dbeafe; padding-bottom: 6px; margin-bottom: 8px; }
            .pdf-table th { background: #eff6ff !important; color: #1e40af; border-bottom: 2px solid #2563EB; }
            .pdf-table td { border-bottom: 1px solid #e8f0fe; }
            .pdf-table tbody tr:nth-child(even) td { background: #f8fbff !important; }
            .pdf-table tfoot td { border-top: 2px solid #2563EB; background: #eff6ff !important; }
          }
        `
      };

      return templateStyles[t] || templateStyles.modern;
    };

    styleEl.textContent = getTemplateStyles(template);

    // Clone #pdf-content and append directly to body so print CSS works reliably
    // (the original is nested deep in the React tree and gets hidden by ancestor rules)
    const pdfContent = document.getElementById('pdf-content');
    if (!pdfContent) return;

    const printContainer = pdfContent.cloneNode(true) as HTMLElement;
    printContainer.id = 'pdf-print-container';
    printContainer.setAttribute('dir', 'rtl');
    printContainer.style.display = 'none';
    document.body.appendChild(printContainer);

    // Update print styles to target the body-level clone
    styleEl.textContent = (styleEl.textContent || '')
      .replace(/#pdf-content/g, '#pdf-print-container');

    // Trigger browser print (which allows "Save as PDF")
    setTimeout(() => {
      printContainer.style.display = 'block';
      window.print();
      // Clean up after print
      setTimeout(() => {
        printContainer.remove();
        if (styleEl && styleEl.parentNode) {
          styleEl.parentNode.removeChild(styleEl);
        }
        document.title = originalTitle;
      }, 1000);
    }, 100);
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

      // Fetch Excel file from API
      const response = await fetch(`/api/reports/excel?${params.toString()}`);

      if (!response.ok) {
        throw new Error("שגיאה ביצירת קובץ Excel");
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
      showSuccessToast("קובץ Excel יוצא בהצלחה");
    } catch (error) {
      console.error("Error exporting Excel:", error);
      showErrorToast("שגיאה ביציאת קובץ Excel");
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
      showSuccessToast("קישור לדוח הועתק ללוח");

      // Optional: Auto-generate report when shared link is opened
      // This will be handled by useEffect that reads URL params on mount
    } catch (error) {
      console.error("Error copying link:", error);
      showErrorToast("שגיאה בהעתקת הקישור");
    }
  };

  return (
    <AppLayout>
      <PageContainer>
        <PageHeader title="דוחות" />
        {/* Filters Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-bold text-lg">פילטרים</h2>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="min-h-[44px] min-w-[44px] px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded-[0.625rem] transition-colors"
            >
              {showFilters ? "הסתר" : "הצג"}
            </button>
          </div>

          {showFilters && (
            <div className="bg-surface border border-border/50 rounded-[0.875rem] p-6 space-y-4 shadow-sm">
              {/* Date Range */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-card rounded-[0.625rem] p-4 border border-border/30">
                  <label className="block text-sm font-medium mb-2">תאריך התחלה</label>
                  <input
                    type="date"
                    value={filters.startDate}
                    onChange={(e) =>
                      setFilters({ ...filters, startDate: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-[0.625rem] bg-background"
                  />
                </div>
                <div className="bg-card rounded-[0.625rem] p-4 border border-border/30">
                  <label className="block text-sm font-medium mb-2">תאריך סיום</label>
                  <input
                    type="date"
                    value={filters.endDate}
                    onChange={(e) =>
                      setFilters({ ...filters, endDate: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-[0.625rem] bg-background"
                  />
                </div>
              </div>

              {/* Client Filter */}
              <div className="bg-card rounded-[0.625rem] p-4 border border-border/30">
                <label className="block text-sm font-medium mb-2">לקוח</label>
                <select
                  value={filters.clientId}
                  onChange={(e) => handleClientChange(e.target.value)}
                  className="w-full px-3 py-2 border rounded-[0.625rem] bg-background"
                  disabled={clientsLoading}
                >
                  <option value="">כל הלקוחות</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Project Filter */}
              <div className="bg-card rounded-[0.625rem] p-4 border border-border/30">
                <label className="block text-sm font-medium mb-2">פרויקט</label>
                <select
                  value={filters.projectId}
                  onChange={(e) =>
                    setFilters({ ...filters, projectId: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-[0.625rem] bg-background"
                  disabled={projectsLoading || !filters.clientId}
                >
                  <option value="">כל הפרויקטים</option>
                  {getFilteredProjects().map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Display Currency Filter */}
              <div className="bg-card rounded-[0.625rem] p-4 border border-border/30">
                <label className="flex items-center gap-2 text-sm font-medium mb-2">
                  <input
                    type="checkbox"
                    checked={filters.includeFixedCharges}
                    onChange={(e) =>
                      setFilters({ ...filters, includeFixedCharges: e.target.checked })
                    }
                    className="h-4 w-4 rounded border-border"
                  />
                  לכלול חיובים קבועים
                </label>
                <p className="text-xs text-muted-foreground">
                  מוסיף לדוח רכיבי חיוב חודשי קבועים ברמת פרויקט.
                </p>
              </div>

              <div className="bg-card rounded-[0.625rem] p-4 border border-border/30">
                <label className="flex items-center gap-2 text-sm font-medium mb-2">
                  <input
                    type="checkbox"
                    checked={showWorkTimes}
                    onChange={(e) => setShowWorkTimes(e.target.checked)}
                    className="h-4 w-4 rounded border-border"
                  />
                  הצג שעות עבודה (ממתי עד מתי)
                </label>
                <p className="text-xs text-muted-foreground">
                  מוסיף לדוח את שעת ההתחלה והסיום של כל רשומת עבודה.
                </p>
              </div>

              <div className="bg-card rounded-[0.625rem] p-4 border border-border/30">
                <label className="block text-sm font-medium mb-2">הצג סכומים במטבע</label>
                <select
                  value={displayCurrency}
                  onChange={(e) => setDisplayCurrency(e.target.value)}
                  className="w-full px-3 py-2 border rounded-[0.625rem] bg-background"
                >
                  <option value="original">מטבע מקורי (מרובה)</option>
                  <option value="ILS">₪ - שקל ישראלי (ILS)</option>
                  <option value="USD">$ - דולר אמריקני (USD)</option>
                  <option value="USDT">₮ - טתר (USDT)</option>
                  <option value="BTC">₿ - ביטקוין (BTC)</option>
                  <option value="ETH">Ξ - אתריום (ETH)</option>
                </select>
                {displayCurrency !== "original" && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {!Object.keys(currencyRates).length ? "⚠️ לא הוגדרו שערי חליפין" : "✓ שערי חליפין זמינים"}
                  </p>
                )}
              </div>

              {/* Generate Button */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setShowLoadPresetDialog(true)}
                  disabled={presetsLoading || presets.length === 0}
                  className="px-4 py-2 bg-secondary text-white rounded-full hover:bg-secondary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title={presets.length === 0 ? "אין פריסטים שמורים" : "טען פריסט"}
                >
                  📂 טען פריסט
                </button>
                <button
                  onClick={() => setShowSavePresetDialog(true)}
                  className="px-4 py-2 bg-accent text-white rounded-full hover:bg-accent/90 transition-colors"
                  title="שמור פריסט"
                >
                  💾 שמור פריסט
                </button>
                <button
                  onClick={generateReport}
                  disabled={reportLoading}
                  className="px-6 py-2 bg-primary text-primary-foreground rounded-full hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {reportLoading ? "יוצר דוח..." : "צור דוח"}
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
                  className="px-6 py-2 border border-border rounded-full hover:bg-accent transition-colors"
                >
                  נקה פילטרים
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive rounded-[0.875rem]">
            <p className="text-destructive">{error}</p>
          </div>
        )}

        {/* Report Results */}
        {reportData && !reportLoading && (
          <div className="space-y-6">
            {/* Export Buttons */}
            <div className="flex justify-end gap-3 no-print">
              <button
                onClick={handleShareReport}
                className="flex items-center gap-2 px-6 py-3 bg-accent text-white rounded-full hover:bg-accent/90 transition-colors shadow-md"
                title="העתק קישור לדוח"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                שתף דוח
              </button>
              <button
                onClick={handleExportExcel}
                className="flex items-center gap-2 px-6 py-3 bg-secondary text-secondary-foreground rounded-full hover:bg-secondary/80 transition-colors shadow-md"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                יצא ל-Excel
              </button>
              <button
                onClick={handleExportPdf}
                className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-full hover:bg-primary/90 transition-colors shadow-md"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                יצא ל-PDF
              </button>
            </div>

            {/* PDF Content (for printing) - hidden on screen, cloned to body before print */}
            <div id="pdf-content" className="print-only" dir="rtl">
              {/* ── Header: Business → Client ── */}
              <div className="pdf-header" style={{ marginBottom: "2rem", paddingBottom: "1.5rem", borderBottom: "2px solid #e2e8f0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  {/* Business info (right side in RTL) */}
                  <div style={{ flex: 1 }}>
                    {userProfile?.logoUrl && (
                      <img src={userProfile.logoUrl} alt="Logo" style={{ maxHeight: "50px", marginBottom: "10px" }} />
                    )}
                    <h1 className="pdf-business-name" style={{ fontSize: "22px", fontWeight: "bold", marginBottom: "0.25rem" }}>
                      {userProfile?.businessName || "דוח שעות עבודה"}
                    </h1>
                    <div style={{ fontSize: "12px", color: "#64748b", lineHeight: 1.6 }}>
                      {userProfile?.taxId && <div>ע.מ / ח.פ: {userProfile.taxId}</div>}
                      {userProfile?.address && <div>{userProfile.address}</div>}
                      {userProfile?.phone && <div>{userProfile.phone}</div>}
                      {userProfile?.email && <div>{userProfile.email}</div>}
                    </div>
                  </div>
                  {/* Report title + date range (left side in RTL) */}
                  <div style={{ textAlign: "start" }}>
                    <h2 style={{ fontSize: "26px", fontWeight: "bold", marginBottom: "0.5rem" }}>דוח עבודה</h2>
                    <div style={{ fontSize: "13px", color: "#64748b" }}>
                      <div>מתאריך: {new Date(filters.startDate).toLocaleDateString('he-IL')}</div>
                      <div>עד תאריך: {new Date(filters.endDate).toLocaleDateString('he-IL')}</div>
                      <div style={{ marginTop: "0.5rem" }}>תאריך הפקה: {new Date().toLocaleDateString('he-IL')}</div>
                    </div>
                  </div>
                </div>

                {/* Client details (if filtered to specific client) */}
                {reportData.byClient.length === 1 && (
                  <div style={{ marginTop: "1.5rem", padding: "1rem", backgroundColor: "#f8fafc", borderRadius: "8px" }}>
                    <div style={{ fontSize: "11px", color: "#94a3b8", marginBottom: "0.25rem", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.5px" }}>עבור</div>
                    <div style={{ fontWeight: "600", fontSize: "16px" }}>{reportData.byClient[0].clientName}</div>
                    <div style={{ fontSize: "12px", color: "#64748b", lineHeight: 1.6 }}>
                      {reportData.byClient[0].clientContactName && <span>{reportData.byClient[0].clientContactName} &middot; </span>}
                      {reportData.byClient[0].clientEmail && <span>{reportData.byClient[0].clientEmail} &middot; </span>}
                      {reportData.byClient[0].clientPhone && <span>{reportData.byClient[0].clientPhone}</span>}
                      {reportData.byClient[0].clientAddress && <div>{reportData.byClient[0].clientAddress}</div>}
                    </div>
                  </div>
                )}
              </div>

              {/* ── Per-project work breakdown ── */}
              {reportData.byProject.map((project) => (
                <div key={project.projectId} className="pdf-section" style={{ marginBottom: "1.5rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.75rem", borderBottom: "1px solid #e2e8f0", paddingBottom: "0.5rem" }}>
                    <h2 className="pdf-section-title" style={{ fontSize: "16px", fontWeight: "bold", margin: 0 }}>
                      {project.projectName}
                      {reportData.byClient.length > 1 && (
                        <span style={{ fontWeight: "normal", fontSize: "13px", color: "#64748b" }}> — {project.clientName}</span>
                      )}
                    </h2>
                    <div style={{ fontSize: "13px", color: "#64748b" }}>
                      {project.hourlyRate ? `${formatCurrency(project.hourlyRate, project.currency)}/שעה` : ""}
                    </div>
                  </div>

                  <table className="pdf-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ backgroundColor: "#f8fafc" }}>
                        <th style={{ padding: "0.5rem 0.75rem", textAlign: "start", fontWeight: "600", fontSize: "11px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>תאריך</th>
                        {showWorkTimes && (
                          <th style={{ padding: "0.5rem 0.75rem", textAlign: "start", fontWeight: "600", fontSize: "11px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>שעות</th>
                        )}
                        <th style={{ padding: "0.5rem 0.75rem", textAlign: "start", fontWeight: "600", fontSize: "11px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>תיאור עבודה</th>
                        <th style={{ padding: "0.5rem 0.75rem", textAlign: "start", fontWeight: "600", fontSize: "11px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>משך</th>
                        <th style={{ padding: "0.5rem 0.75rem", textAlign: "start", fontWeight: "600", fontSize: "11px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>סכום</th>
                      </tr>
                    </thead>
                    <tbody>
                      {project.entries.map((entry) => (
                        <tr key={entry.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "0.5rem 0.75rem", fontSize: "12px", whiteSpace: "nowrap" }}>{new Date(entry.date).toLocaleDateString('he-IL')}</td>
                          {showWorkTimes && (
                            <td style={{ padding: "0.5rem 0.75rem", fontSize: "12px", whiteSpace: "nowrap" }}>
                              {entry.startTime && entry.endTime
                                ? `${new Date(entry.startTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })} - ${new Date(entry.endTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`
                                : entry.startTime
                                  ? `${new Date(entry.startTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })} -`
                                  : "-"}
                            </td>
                          )}
                          <td style={{ padding: "0.5rem 0.75rem", fontSize: "12px" }}>{entry.description}{entry.notes ? ` (${entry.notes})` : ""}</td>
                          <td style={{ padding: "0.5rem 0.75rem", fontSize: "12px", whiteSpace: "nowrap" }}>{formatDuration(entry.duration)}</td>
                          <td style={{ padding: "0.5rem 0.75rem", fontSize: "12px", whiteSpace: "nowrap" }}>
                            {entry.isBillable && entry.hourlyRate
                              ? formatCurrency((entry.duration / 60) * entry.hourlyRate, entry.currency)
                              : entry.isBillable ? "-" : "לא לחיוב"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ borderTop: "2px solid #e2e8f0", fontWeight: "600" }}>
                        <td style={{ padding: "0.5rem 0.75rem", fontSize: "12px" }}></td>
                        {showWorkTimes && <td style={{ padding: "0.5rem 0.75rem", fontSize: "12px" }}></td>}
                        <td style={{ padding: "0.5rem 0.75rem", fontSize: "12px" }}>סה״כ {project.projectName}</td>
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
                    חיובים קבועים
                  </h2>
                  <table className="pdf-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ backgroundColor: "#f8fafc" }}>
                        <th style={{ padding: "0.5rem 0.75rem", textAlign: "start", fontWeight: "600", fontSize: "11px", color: "#64748b" }}>חודש</th>
                        <th style={{ padding: "0.5rem 0.75rem", textAlign: "start", fontWeight: "600", fontSize: "11px", color: "#64748b" }}>פרויקט</th>
                        <th style={{ padding: "0.5rem 0.75rem", textAlign: "start", fontWeight: "600", fontSize: "11px", color: "#64748b" }}>סכום</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.fixedCharges.map((line, i) => (
                        <tr key={`${line.projectId}-${line.month}-${i}`} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "0.5rem 0.75rem", fontSize: "12px" }}>{line.month}</td>
                          <td style={{ padding: "0.5rem 0.75rem", fontSize: "12px" }}>{line.projectName}</td>
                          <td style={{ padding: "0.5rem 0.75rem", fontSize: "12px", fontWeight: "500" }}>{formatCurrency(line.amount, line.currency)}</td>
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
                    <div style={{ fontSize: "13px", color: "#64748b" }}>סה״כ שעות</div>
                    <div style={{ fontSize: "20px", fontWeight: "bold" }}>{reportData.summary.totalHours.toFixed(1)} שע׳</div>
                  </div>
                  {Object.keys(reportData.summary.totalAmounts).length > 0 && (
                    <div style={{ textAlign: "start" }}>
                      <div style={{ fontSize: "13px", color: "#64748b" }}>סה״כ לתשלום</div>
                      <div style={{ fontSize: "24px", fontWeight: "bold" }}>
                        {Object.entries(reportData.summary.totalAmounts).map(
                          ([currency, amount]) => formatCurrency(amount, currency)
                        ).join(" + ")}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Footer ── */}
              <div style={{ marginTop: "2rem", paddingTop: "1rem", borderTop: "1px solid #e2e8f0", fontSize: "11px", color: "#94a3b8", textAlign: "center" }}>
                {userProfile?.businessName || "מוניט"} &middot; נוצר בתאריך {new Date().toLocaleDateString('he-IL')}
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="bg-card border border-border/50 rounded-[0.875rem] p-6 border-s-4 border-s-accent shadow-sm">
                <h3 className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
                  סה״כ שעות
                </h3>
                <p className="font-mono text-2xl font-bold tabular-nums">
                  {reportData.summary.totalHours.toFixed(1)} שע׳
                </p>
              </div>
              <div className="bg-card border border-border/50 rounded-[0.875rem] p-6 border-s-4 border-s-secondary shadow-sm">
                <h3 className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
                  סה״כ רשומות
                </h3>
                <p className="font-mono text-2xl font-bold tabular-nums">
                  {reportData.summary.totalEntries}
                </p>
              </div>
              <div className="bg-card border border-border/50 rounded-[0.875rem] p-6 border-s-4 border-s-primary shadow-sm">
                <h3 className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
                  סה״כ סכום {displayCurrency !== "original" && `(${displayCurrency})`}
                </h3>
                {Object.keys(reportData.summary.totalAmounts).length > 0 ? (
                  displayCurrency === "original" ? (
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
                    <p className="font-mono text-2xl font-bold tabular-nums">
                      {formatCurrency(
                        convertAmounts(reportData.summary.totalAmounts, displayCurrency),
                        displayCurrency
                      )}
                    </p>
                  )
                ) : (
                  <p className="text-lg text-muted-foreground">לא זמין</p>
                )}
              </div>
              <div className="bg-card border border-border/50 rounded-[0.875rem] p-6 border-s-4 border-s-accent shadow-sm">
                <h3 className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
                  חיובים קבועים {displayCurrency !== "original" && `(${displayCurrency})`}
                </h3>
                {Object.keys(reportData.summary.fixedAmounts || {}).length > 0 ? (
                  displayCurrency === "original" ? (
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
                    <p className="font-mono text-2xl font-bold tabular-nums">
                      {formatCurrency(
                        convertAmounts(reportData.summary.fixedAmounts, displayCurrency),
                        displayCurrency
                      )}
                    </p>
                  )
                ) : (
                  <p className="text-lg text-muted-foreground">0.00</p>
                )}
              </div>
              <div className="bg-card border border-border/50 rounded-[0.875rem] p-6 border-s-4 border-s-success shadow-sm">
                <h3 className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
                  תקופה
                </h3>
                <p className="text-lg font-semibold">
                  {filters.startDate} עד {filters.endDate}
                </p>
              </div>
            </div>

            {/* By Client Summary */}
            {reportData.byClient.length > 0 && (
              <div className="bg-card border border-border/50 rounded-[0.875rem] p-6 shadow-sm">
                <h3 className="font-display text-lg font-bold mb-4">סיכום לפי לקוח</h3>
                <div className="space-y-3">
                  {reportData.byClient.map((client) => (
                    <div
                      key={client.clientId}
                      className="flex items-center justify-between p-3 bg-surface/50 hover:bg-surface rounded-[0.625rem] border border-border/30 transition-colors"
                    >
                      <div className="flex-1">
                        <p className="font-medium">{client.clientName}</p>
                        <p className="text-sm text-muted-foreground">
                          {client.entries.length} רשומות
                        </p>
                      </div>
                      <div className="text-end">
                        <p className="font-mono text-lg font-semibold">
                          {formatDuration(client.totalMinutes)}
                        </p>
                        {Object.keys(client.totalAmounts).length > 0 && (
                          <p className="text-sm text-muted-foreground">
                            {displayCurrency === "original"
                              ? Object.entries(client.totalAmounts)
                                  .map(([currency, amount]) =>
                                    formatCurrency(amount, currency)
                                  )
                                  .join(" + ")
                              : formatCurrency(
                                  convertAmounts(client.totalAmounts, displayCurrency),
                                  displayCurrency
                                )}
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
              <div className="bg-card border border-border/50 rounded-[0.875rem] p-6 shadow-sm">
                <h3 className="font-display text-lg font-bold mb-4">סיכום לפי פרויקט</h3>
                <div className="space-y-3">
                  {reportData.byProject.map((project) => (
                    <div
                      key={project.projectId}
                      className="flex items-center justify-between p-3 bg-surface/50 hover:bg-surface rounded-[0.625rem] border border-border/30 transition-colors"
                    >
                      <div className="flex-1">
                        <p className="font-medium">{project.projectName}</p>
                        <p className="text-sm text-muted-foreground">
                          {project.clientName} • {project.pricingModel}
                        </p>
                        {project.hourlyRate && (
                          <p className="text-sm text-muted-foreground">
                            {formatCurrency(project.hourlyRate, project.currency)} /
                            שעה
                          </p>
                        )}
                      </div>
                      <div className="text-end">
                        <p className="font-mono text-lg font-semibold">
                          {formatDuration(project.totalMinutes)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {project.entries.length} רשומות
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

            {reportData.fixedCharges && reportData.fixedCharges.length > 0 && (
              <div className="bg-card border border-border/50 rounded-[0.875rem] p-6 shadow-sm">
                <h3 className="font-display text-lg font-bold mb-4">חיובים קבועים</h3>
                <div className="space-y-3">
                  {reportData.fixedCharges.map((line, index) => (
                    <div
                      key={`${line.projectId}-${line.month}-${index}`}
                      className="flex items-center justify-between p-3 bg-surface/50 hover:bg-surface rounded-[0.625rem] border border-border/30 transition-colors"
                    >
                      <div className="flex-1">
                        <p className="font-medium">{line.projectName}</p>
                        <p className="text-sm text-muted-foreground">
                          {line.clientName} • {line.month}
                        </p>
                      </div>
                      <div className="text-end">
                        <p className="font-mono text-lg font-semibold">
                          {formatCurrency(line.amount, line.currency)}
                        </p>
                        <p className="text-sm text-muted-foreground">חיוב חודשי קבוע</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* By Date Summary (Daily Breakdown) */}
            {reportData.byDate && reportData.byDate.length > 0 && (
              <div className="bg-card border border-border/50 rounded-[0.875rem] p-6 shadow-sm">
                <h3 className="font-display text-lg font-bold mb-4">סיכום לפי תאריך (יומי)</h3>
                <div className="space-y-2">
                  {reportData.byDate.map((dateSummary) => (
                    <div
                      key={dateSummary.date}
                      className="flex items-center justify-between p-3 bg-surface/50 hover:bg-surface rounded-[0.625rem] border border-border/30 transition-colors"
                    >
                      <div className="flex-1">
                        <p className="font-medium">{new Date(dateSummary.date).toLocaleDateString('he-IL')}</p>
                        <p className="text-sm text-muted-foreground">
                          {dateSummary.entryCount} רשומות
                        </p>
                      </div>
                      <div className="text-end">
                        <p className="font-mono text-lg font-semibold">
                          {formatDuration(dateSummary.totalMinutes)}
                        </p>
                        {Object.keys(dateSummary.totalAmounts).length > 0 && (
                          <p className="text-sm text-muted-foreground">
                            {displayCurrency === "original"
                              ? Object.entries(dateSummary.totalAmounts)
                                  .map(([currency, amount]) =>
                                    formatCurrency(amount, currency)
                                  )
                                  .join(" + ")
                              : formatCurrency(
                                  convertAmounts(dateSummary.totalAmounts, displayCurrency),
                                  displayCurrency
                                )}
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
              <div className="bg-card border border-border/50 rounded-[0.875rem] p-6 shadow-sm">
                <h3 className="font-display text-lg font-bold mb-4">סיכום לפי שבוע</h3>
                <div className="space-y-2">
                  {reportData.byWeek.map((weekSummary) => (
                    <div
                      key={weekSummary.weekStart}
                      className="flex items-center justify-between p-3 bg-surface/50 hover:bg-surface rounded-[0.625rem] border border-border/30 transition-colors"
                    >
                      <div className="flex-1">
                        <p className="font-medium">
                          {weekSummary.weekStart} עד {weekSummary.weekEnd}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {weekSummary.entryCount} רשומות
                        </p>
                      </div>
                      <div className="text-end">
                        <p className="font-mono text-lg font-semibold">
                          {formatDuration(weekSummary.totalMinutes)}
                        </p>
                        {Object.keys(weekSummary.totalAmounts).length > 0 && (
                          <p className="text-sm text-muted-foreground">
                            {displayCurrency === "original"
                              ? Object.entries(weekSummary.totalAmounts)
                                  .map(([currency, amount]) =>
                                    formatCurrency(amount, currency)
                                  )
                                  .join(" + ")
                              : formatCurrency(
                                  convertAmounts(weekSummary.totalAmounts, displayCurrency),
                                  displayCurrency
                                )}
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
              <div className="bg-card border border-border/50 rounded-[0.875rem] overflow-hidden shadow-sm">
                <div className="p-6 border-b border-border">
                  <h3 className="font-display text-lg font-bold">רשומות מפורטות</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-surface">
                      <tr>
                        <th className="px-6 py-3 text-start text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                          תאריך
                        </th>
                        <th className="px-6 py-3 text-start text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                          לקוח
                        </th>
                        <th className="px-6 py-3 text-start text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                          פרויקט
                        </th>
                        <th className="px-6 py-3 text-start text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                          תיאור
                        </th>
                        <th className="px-6 py-3 text-start text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                          משך
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.entries.map((entry, index) => (
                        <tr key={entry.id} className={`hover:bg-surface transition-colors ${index % 2 === 0 ? '' : 'even:bg-surface/50'}`}>
                          <td className="px-6 py-4 text-sm">{new Date(entry.date).toLocaleDateString('he-IL')}</td>
                          <td className="px-6 py-4 text-sm">
                            {entry.clientName}
                          </td>
                          <td className="px-6 py-4 text-sm">
                            {entry.projectName}
                          </td>
                          <td className="px-6 py-4 text-sm">
                            {entry.description}
                          </td>
                          <td className="px-6 py-4 text-sm font-mono font-semibold">
                            {formatDuration(entry.duration)}
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
              <div className="bg-card border rounded-[0.875rem] p-12 text-center">
                <p className="text-muted-foreground text-lg mb-4">
                  לא נמצאו רשומות לתקופה שנבחרה
                </p>
                <div className="flex gap-3 justify-center">
                  <a
                    href="/entries"
                    className="rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
                  >
                    רשום זמן עכשיו
                  </a>
                </div>
              </div>
            )}
          </div>
        )}

        {/* No Report Generated Yet */}
        {!reportData && !reportLoading && (
          <div className="bg-card border rounded-[0.875rem] p-12 text-center">
            <p className="text-muted-foreground text-lg mb-4">
              בחר פילטרים ולחץ על &quot;צור דוח&quot; להצגת הדוח
            </p>
          </div>
        )}
      </PageContainer>

      {/* Save Preset Dialog */}
      <Dialog open={showSavePresetDialog} onOpenChange={(open) => { if (!open) { setShowSavePresetDialog(false); setPresetName(""); } }}>
        <DialogContent className="p-0">
          <div className="border-b p-6">
            <DialogHeader>
              <DialogTitle className="font-mono text-2xl font-bold tabular-nums">שמור פריסט</DialogTitle>
              <DialogDescription>
                שמור את הגדרות הפילטרים הנוכחיות כפריסט
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">שם הפריסט</label>
              <input
                type="text"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                placeholder="לדוגמה: דוח חודשי - לקוח הייטק"
                className="w-full px-3 py-2 border rounded-[0.625rem] bg-background"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && presetName.trim()) {
                    handleSavePreset();
                  }
                }}
              />
            </div>

            <div className="bg-muted/50 rounded-[0.625rem] p-4 space-y-2 text-sm">
              <p className="font-medium">הגדרות הפילטר:</p>
              <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                <div>תאריך התחלה:</div>
                <div className="text-end">{filters.startDate || "לא נבחר"}</div>
                <div>תאריך סיום:</div>
                <div className="text-end">{filters.endDate || "לא נבחר"}</div>
                <div>לקוח:</div>
                <div className="text-end">
                  {filters.clientId
                    ? clients.find((c) => c.id === filters.clientId)?.name || "לא נבחר"
                    : "כל הלקוחות"}
                </div>
                <div>פרויקט:</div>
                <div className="text-end">
                  {filters.projectId
                    ? projects.find((p) => p.id === filters.projectId)?.name || "לא נבחר"
                    : "כל הפרויקטים"}
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
              שמור
            </button>
            <DialogClose asChild>
              <button
                className="px-6 py-2 border border-border rounded-full hover:bg-accent transition-colors"
              >
                ביטול
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
              <DialogTitle className="font-mono text-2xl font-bold tabular-nums">טען פריסט</DialogTitle>
              <DialogDescription>
                בחר פריסט שמור לטעינה
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="p-6">
            {presets.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>לא נמצאו פריסטים שמורים</p>
                <p className="text-sm mt-2">שמור פריסט כדי שיופיע כאן</p>
              </div>
            ) : (
              <div className="space-y-3">
                {presets.map((preset) => (
                  <div
                    key={preset.id}
                    className="border rounded-[0.875rem] p-4 hover:border-primary/50 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg mb-2">{preset.name}</h3>
                        <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                          <div>תאריך התחלה:</div>
                          <div className="text-end">{preset.startDate || "לא נבחר"}</div>
                          <div>תאריך סיום:</div>
                          <div className="text-end">{preset.endDate || "לא נבחר"}</div>
                          <div>לקוח:</div>
                          <div className="text-end">
                            {preset.clientId
                              ? clients.find((c) => c.id === preset.clientId)?.name || "לא נבחר"
                              : "כל הלקוחות"}
                          </div>
                          <div>פרויקט:</div>
                          <div className="text-end">
                            {preset.projectId
                              ? projects.find((p) => p.id === preset.projectId)?.name || "לא נבחר"
                              : "כל הפרויקטים"}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 me-4">
                        <button
                          onClick={() => handleLoadPreset(preset)}
                          className="px-4 py-2 bg-primary text-primary-foreground rounded-full hover:bg-primary/90 transition-colors text-sm"
                        >
                          טען
                        </button>
                        <button
                          onClick={() => handleDeletePreset(preset.id)}
                          className="px-4 py-2 bg-destructive text-destructive-foreground rounded-full hover:bg-destructive/90 transition-colors text-sm"
                        >
                          מחק
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
                סגור
              </button>
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
