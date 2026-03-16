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
          /* Hide everything, then reveal #pdf-content and its ancestor chain */
          body * { visibility: hidden !important; }
          #pdf-content, #pdf-content * { visibility: visible !important; }
          #pdf-content { position: absolute !important; left: 0; top: 0; width: 100%; display: block !important; direction: rtl !important; }
          @page { size: A4; margin: 15mm; }
          body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .pdf-header { padding: 2rem; margin-bottom: 2rem; }
          .pdf-section { margin-bottom: 1.5rem; padding: 1.5rem; }
          .pdf-table { width: 100%; border-collapse: collapse; }
          .pdf-table th, .pdf-table td { padding: 0.75rem 1rem; text-align: right; }
          .pdf-summary-card { padding: 1rem; margin-bottom: 0.5rem; }
        }
      `;

      const templateStyles: Record<PdfTemplate, string> = {
        modern: `
          ${baseStyles}
          @media print {
            .pdf-header { background: ${primaryColor} !important; color: white !important; border-radius: 12px; }
            .pdf-section { background: #f8fafc !important; border-radius: 12px; }
            .pdf-table thead { background: #f1f5f9 !important; }
            .pdf-table th { color: #475569; font-weight: 600; }
            .pdf-summary-value { color: ${primaryColor} !important; }
          }
        `,
        classic: `
          ${baseStyles}
          @media print {
            .pdf-header { border-bottom: 3px solid ${primaryColor}; padding-bottom: 1.5rem; }
            .pdf-business-name { color: ${primaryColor}; font-weight: 700; font-family: Georgia, serif; }
            .pdf-section { border: 1px solid #ddd; }
            .pdf-section-title { background: #f5f5f5; padding: 0.75rem 1rem; border-bottom: 1px solid ${accentColor}; font-weight: 700; }
            .pdf-table th { font-family: Georgia, serif; text-transform: uppercase; font-size: 11px; }
          }
        `,
        bold: `
          ${baseStyles}
          @media print {
            .pdf-header { background: ${primaryColor} !important; color: white !important; padding: 2.5rem 2rem; }
            .pdf-business-name { font-size: 32px; font-weight: 900; text-transform: uppercase; }
            .pdf-section { border-left: 6px solid ${accentColor}; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1); }
            .pdf-table thead { background: ${primaryColor} !important; color: white !important; }
            .pdf-table th { color: white; font-weight: 700; text-transform: uppercase; }
          }
        `,
        elegant: `
          ${baseStyles}
          @media print {
            .pdf-header { background: ${primaryColor} !important; color: #e2e8f0; padding: 2rem; }
            .pdf-section { border: 1px solid #e2e8f0; }
            .pdf-section-title { color: ${primaryColor}; padding: 1rem 1.5rem; background: #f7fafc; border-bottom: 1px solid ${accentColor}; }
            .pdf-table th { color: ${primaryColor}; font-weight: 600; font-size: 12px; letter-spacing: 0.5px; }
          }
        `,
        nature: `
          ${baseStyles}
          @media print {
            .pdf-header { background: ${accentColor} !important; color: white !important; border-radius: 16px; }
            .pdf-section { background: linear-gradient(to bottom, #ECFDF5 0%, #D1FAE5 100%); border-radius: 16px; border: 1px solid #A7F3D0; }
            .pdf-table thead { background: ${accentColor} !important; color: white !important; }
            .pdf-table th { color: white; font-weight: 600; }
            .pdf-table tbody tr:nth-child(even) td { background: #F0FDFA !important; }
          }
        `,
        ocean: `
          ${baseStyles}
          @media print {
            .pdf-header { background: linear-gradient(135deg, ${primaryColor} 0%, ${accentColor} 100%) !important; color: white !important; border-radius: 12px; }
            .pdf-section { background: white; border-radius: 12px; border: 1px solid #CFFAFE; }
            .pdf-section-title { color: ${accentColor}; padding-bottom: 0.75rem; border-bottom: 2px solid ${primaryColor}; }
            .pdf-table thead { background: ${primaryColor} !important; color: white !important; }
            .pdf-table th { color: white; font-weight: 600; }
            .pdf-table tbody tr:nth-child(even) { background: #ECFEFF !important; }
          }
        `
      };

      return templateStyles[t] || templateStyles.modern;
    };

    styleEl.innerHTML = getTemplateStyles(template);

    // Set generation date on body element for @page margin boxes
    const generatedDate = new Date().toLocaleDateString('he-IL');
    document.body.setAttribute('data-generated-date', generatedDate);

    // Trigger browser print (which allows "Save as PDF")
    setTimeout(() => {
      window.print();
      // Clean up styles, restore title, and remove data attribute after print
      setTimeout(() => {
        if (styleEl && styleEl.parentNode) {
          styleEl.parentNode.removeChild(styleEl);
        }
        document.title = originalTitle;
        document.body.removeAttribute('data-generated-date');
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

            {/* PDF Content (for printing) - hidden on screen, visible in print */}
            <div id="pdf-content" className="print-only" dir="rtl" data-generated-date={new Date().toLocaleDateString('he-IL')}>
              <div className="pdf-header" style={{ marginBottom: "1rem" }}>
                {userProfile?.logoUrl && (
                  <img
                    src={userProfile.logoUrl}
                    alt="Logo"
                    className="pdf-logo"
                    style={{ maxHeight: "60px", marginBottom: "15px" }}
                  />
                )}
                <h1 className="pdf-business-name" style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "0.5rem" }}>
                  {userProfile?.businessName || "דוח שעות עבודה"}
                </h1>
                <p className="pdf-subtitle" style={{ fontSize: "14px", opacity: 0.8, marginBottom: "0.75rem" }}>
                  {filters.startDate} עד {filters.endDate}
                </p>

                {/* Business Contact Details */}
                <div style={{ fontSize: "13px", opacity: 0.9, marginTop: "1rem" }}>
                  {userProfile?.address && (
                    <div style={{ marginBottom: "0.25rem" }}>
                      📍 {userProfile.address}
                    </div>
                  )}
                  {userProfile?.phone && (
                    <div style={{ marginBottom: "0.25rem" }}>
                      📞 {userProfile.phone}
                    </div>
                  )}
                  {userProfile?.email && (
                    <div style={{ marginBottom: "0.25rem" }}>
                      ✉️ {userProfile.email}
                    </div>
                  )}
                  {userProfile?.taxId && (
                    <div style={{ marginBottom: "0.25rem" }}>
                      🆔 עוסק: {userProfile.taxId}
                    </div>
                  )}
                </div>
              </div>

              {/* Summary Section */}
              <div className="pdf-section" style={{ marginBottom: "1.5rem", padding: "1.5rem" }}>
                <h2 className="pdf-section-title" style={{ fontSize: "18px", fontWeight: "bold", marginBottom: "1rem" }}>סיכום כללי</h2>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem" }}>
                  <div className="pdf-summary-card" style={{ padding: "1rem", backgroundColor: "#f8fafc", borderRadius: "8px" }}>
                    <div className="pdf-summary-label" style={{ fontSize: "12px", color: "#64748b", marginBottom: "0.25rem" }}>סה״כ שעות</div>
                    <div className="pdf-summary-value" style={{ fontSize: "24px", fontWeight: "bold", color: userProfile?.pdfPrimaryColor || "#A8622D" }}>
                      {reportData.summary.totalHours.toFixed(1)}
                    </div>
                  </div>
                  <div className="pdf-summary-card" style={{ padding: "1rem", backgroundColor: "#f8fafc", borderRadius: "8px" }}>
                    <div className="pdf-summary-label" style={{ fontSize: "12px", color: "#64748b", marginBottom: "0.25rem" }}>סה״כ רשומות</div>
                    <div className="pdf-summary-value" style={{ fontSize: "24px", fontWeight: "bold", color: userProfile?.pdfPrimaryColor || "#A8622D" }}>
                      {reportData.summary.totalEntries}
                    </div>
                  </div>
                  {Object.keys(reportData.summary.fixedAmounts || {}).length > 0 && (
                    <div className="pdf-summary-card" style={{ padding: "1rem", backgroundColor: "#f8fafc", borderRadius: "8px" }}>
                      <div className="pdf-summary-label" style={{ fontSize: "12px", color: "#64748b", marginBottom: "0.25rem" }}>חיובים קבועים</div>
                      <div className="pdf-summary-value" style={{ fontSize: "24px", fontWeight: "bold", color: userProfile?.pdfPrimaryColor || "#A8622D" }}>
                        {Object.entries(reportData.summary.fixedAmounts).map(
                          ([currency, amount]) => formatCurrency(amount, currency)
                        ).join(" + ")}
                      </div>
                    </div>
                  )}
                  {Object.keys(reportData.summary.totalAmounts).length > 0 && (
                    <div className="pdf-summary-card" style={{ padding: "1rem", backgroundColor: "#f8fafc", borderRadius: "8px", gridColumn: "span 2" }}>
                      <div className="pdf-summary-label" style={{ fontSize: "12px", color: "#64748b", marginBottom: "0.25rem" }}>סה״כ סכום</div>
                      <div className="pdf-summary-value" style={{ fontSize: "24px", fontWeight: "bold", color: userProfile?.pdfPrimaryColor || "#A8622D" }}>
                        {Object.entries(reportData.summary.totalAmounts).map(
                          ([currency, amount]) => formatCurrency(amount, currency)
                        ).join(" + ")}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* By Client Section */}
              {reportData.byClient.length > 0 && (
                <div className="pdf-section" style={{ marginBottom: "1.5rem", padding: "1.5rem" }}>
                  <h2 className="pdf-section-title" style={{ fontSize: "18px", fontWeight: "bold", marginBottom: "1rem" }}>סיכום לפי לקוח</h2>
                  {reportData.byClient.map((client) => (
                    <div key={client.clientId} className="pdf-summary-card" style={{ padding: "1rem", backgroundColor: "#f8fafc", borderRadius: "8px", marginBottom: "0.75rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: "600", fontSize: "18px", marginBottom: "0.25rem" }}>{client.clientName}</div>
                          {/* Client Contact Details */}
                          {(client.clientContactName || client.clientEmail || client.clientPhone || client.clientAddress) && (
                            <div style={{ fontSize: "12px", opacity: 0.8, marginBottom: "0.5rem" }}>
                              {client.clientContactName && (
                                <div style={{ marginBottom: "0.15rem" }}>👤 איש קשר: {client.clientContactName}</div>
                              )}
                              {client.clientEmail && (
                                <div style={{ marginBottom: "0.15rem" }}>✉️ {client.clientEmail}</div>
                              )}
                              {client.clientPhone && (
                                <div style={{ marginBottom: "0.15rem" }}>📞 {client.clientPhone}</div>
                              )}
                              {client.clientAddress && (
                                <div style={{ marginBottom: "0.15rem" }}>📍 {client.clientAddress}</div>
                              )}
                            </div>
                          )}
                          <div style={{ fontSize: "14px", opacity: 0.7 }}>
                            {client.entries.length} רשומות
                          </div>
                        </div>
                        <div style={{ textAlign: "end" }}>
                          <div style={{ fontWeight: "600", fontSize: "20px" }}>
                            {formatDuration(client.totalMinutes)}
                          </div>
                          {Object.keys(client.totalAmounts).length > 0 && (
                            <div style={{ fontSize: "14px", opacity: 0.7 }}>
                              {Object.entries(client.totalAmounts)
                                .map(([currency, amount]) =>
                                  formatCurrency(amount, currency)
                                )
                                .join(" + ")}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {reportData.fixedCharges && reportData.fixedCharges.length > 0 && (
                <div className="pdf-section" style={{ marginBottom: "1.5rem", padding: "1.5rem" }}>
                  <h2 className="pdf-section-title" style={{ fontSize: "18px", fontWeight: "bold", marginBottom: "1rem" }}>
                    חיובים קבועים
                  </h2>
                  <table className="pdf-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead style={{ backgroundColor: "#f1f5f9" }}>
                      <tr>
                        <th style={{ padding: "0.75rem 1rem", textAlign: "start", fontWeight: "600", fontSize: "13px", color: "#475569" }}>חודש</th>
                        <th style={{ padding: "0.75rem 1rem", textAlign: "start", fontWeight: "600", fontSize: "13px", color: "#475569" }}>לקוח</th>
                        <th style={{ padding: "0.75rem 1rem", textAlign: "start", fontWeight: "600", fontSize: "13px", color: "#475569" }}>פרויקט</th>
                        <th style={{ padding: "0.75rem 1rem", textAlign: "start", fontWeight: "600", fontSize: "13px", color: "#475569" }}>סכום</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.fixedCharges.map((line, index) => (
                        <tr key={`${line.projectId}-${line.month}-${index}`} style={{ borderBottom: "1px solid #f1f5f9", backgroundColor: index % 2 === 0 ? "transparent" : "#f8fafc" }}>
                          <td style={{ padding: "0.75rem 1rem", textAlign: "start", fontSize: "13px" }}>{line.month}</td>
                          <td style={{ padding: "0.75rem 1rem", textAlign: "start", fontSize: "13px" }}>{line.clientName}</td>
                          <td style={{ padding: "0.75rem 1rem", textAlign: "start", fontSize: "13px" }}>{line.projectName}</td>
                          <td style={{ padding: "0.75rem 1rem", textAlign: "start", fontSize: "13px", fontWeight: "500" }}>
                            {formatCurrency(line.amount, line.currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* By Date Summary in PDF */}
              {reportData.byDate && reportData.byDate.length > 0 && (
                <div className="pdf-section" style={{ marginBottom: "1.5rem", padding: "1.5rem" }}>
                  <h2 className="pdf-section-title" style={{ fontSize: "18px", fontWeight: "bold", marginBottom: "1rem" }}>סיכום לפי תאריך (יומי)</h2>
                  <table className="pdf-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead style={{ backgroundColor: "#f1f5f9" }}>
                      <tr>
                        <th style={{ padding: "0.75rem 1rem", textAlign: "start", fontWeight: "600", fontSize: "13px", color: "#475569" }}>תאריך</th>
                        <th style={{ padding: "0.75rem 1rem", textAlign: "start", fontWeight: "600", fontSize: "13px", color: "#475569" }}>משך</th>
                        <th style={{ padding: "0.75rem 1rem", textAlign: "start", fontWeight: "600", fontSize: "13px", color: "#475569" }}>רשומות</th>
                        <th style={{ padding: "0.75rem 1rem", textAlign: "start", fontWeight: "600", fontSize: "13px", color: "#475569" }}>סכום</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.byDate.map((dateSummary, index) => (
                        <tr key={dateSummary.date} style={{ borderBottom: "1px solid #f1f5f9", backgroundColor: index % 2 === 0 ? "transparent" : "#f8fafc" }}>
                          <td style={{ padding: "0.75rem 1rem", textAlign: "start", fontSize: "13px" }}>{new Date(dateSummary.date).toLocaleDateString('he-IL')}</td>
                          <td style={{ padding: "0.75rem 1rem", textAlign: "start", fontSize: "13px", fontWeight: "500" }}>{formatDuration(dateSummary.totalMinutes)}</td>
                          <td style={{ padding: "0.75rem 1rem", textAlign: "start", fontSize: "13px" }}>{dateSummary.entryCount}</td>
                          <td style={{ padding: "0.75rem 1rem", textAlign: "start", fontSize: "13px" }}>
                            {Object.keys(dateSummary.totalAmounts).length > 0
                              ? Object.entries(dateSummary.totalAmounts)
                                  .map(([currency, amount]) => formatCurrency(amount, currency))
                                  .join(" + ")
                              : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Detailed Entries Table */}
              {reportData.entries.length > 0 && (
                <div className="pdf-section" style={{ marginBottom: "1.5rem", padding: "1.5rem" }}>
                  <h2 className="pdf-section-title" style={{ fontSize: "18px", fontWeight: "bold", marginBottom: "1rem" }}>רשומות מפורטות</h2>
                  <table className="pdf-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead style={{ backgroundColor: "#f1f5f9" }}>
                      <tr>
                        <th style={{ padding: "0.75rem 1rem", textAlign: "start", fontWeight: "600", fontSize: "13px", color: "#475569" }}>תאריך</th>
                        <th style={{ padding: "0.75rem 1rem", textAlign: "start", fontWeight: "600", fontSize: "13px", color: "#475569" }}>לקוח</th>
                        <th style={{ padding: "0.75rem 1rem", textAlign: "start", fontWeight: "600", fontSize: "13px", color: "#475569" }}>פרויקט</th>
                        <th style={{ padding: "0.75rem 1rem", textAlign: "start", fontWeight: "600", fontSize: "13px", color: "#475569" }}>תיאור</th>
                        <th style={{ padding: "0.75rem 1rem", textAlign: "start", fontWeight: "600", fontSize: "13px", color: "#475569" }}>משך</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.entries.map((entry, index) => (
                        <tr key={entry.id} style={{ borderBottom: "1px solid #f1f5f9", backgroundColor: index % 2 === 0 ? "transparent" : "#f8fafc" }}>
                          <td style={{ padding: "0.75rem 1rem", textAlign: "start", fontSize: "13px" }}>{new Date(entry.date).toLocaleDateString('he-IL')}</td>
                          <td style={{ padding: "0.75rem 1rem", textAlign: "start", fontSize: "13px" }}>{entry.clientName}</td>
                          <td style={{ padding: "0.75rem 1rem", textAlign: "start", fontSize: "13px" }}>{entry.projectName}</td>
                          <td style={{ padding: "0.75rem 1rem", textAlign: "start", fontSize: "13px" }}>{entry.description}</td>
                          <td style={{ padding: "0.75rem 1rem", textAlign: "start", fontSize: "13px", fontWeight: "500" }}>{formatDuration(entry.duration)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* PDF Footer with generation date and page numbers */}
              <div className="pdf-footer" style={{ marginTop: "2rem", paddingTop: "1rem", borderTop: "1px solid #e2e8f0", textAlign: "center", fontSize: "11px", color: "#64748b" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>נוצר בתאריך: {new Date().toLocaleDateString('he-IL')}</div>
                  <div>עמוד <span className="page-number">1</span></div>
                </div>
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
                    className="rounded-full bg-primary px-4 py-2 text-sm text-white hover:bg-primary/90"
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
