"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { showSuccessToast, showErrorToast } from "@/lib/toast";

interface User {
  id: string;
  email: string;
}

interface UserProfile {
  businessName: string | null;
  logoUrl: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  taxId: string | null;
  defaultCurrency: string;
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
  totalAmounts: Record<string, number>;
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

const PDF_TEMPLATES: { value: PdfTemplate; label: string; description: string }[] = [
  { value: "modern", label: "מודרני", description: "עיצוב נקי ומינימליסטי" },
  { value: "classic", label: "קלאסי", description: "עיצוב מסורתי ומכובד" },
  { value: "bold", label: "בולט", description: "עיצוב עם כותרות גדולות ובולטות" },
  { value: "elegant", label: "אלגנטי", description: "עיצוב עדין ויוקרתי" },
  { value: "nature", label: "טבע", description: "עיצוב בגווני ירוק וטבעי" },
  { value: "ocean", label: "אוקיינוס", description: "עיצוב בגווני כחול" },
];

export default function ReportsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [clients, setClients] = useState<Client[]>([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<PdfTemplate>("modern");
  const [showExportDialog, setShowExportDialog] = useState(false);
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
  });
  const [error, setError] = useState("");

  useEffect(() => {
    // Fetch current session
    const fetchUser = async () => {
      try {
        const response = await fetch("/api/auth/session");
        const data = await response.json();

        if (data.success && data.user) {
          setUser(data.user);
        } else {
          // No session, redirect to login
          router.push("/login");
        }
      } catch (error) {
        console.error("Error fetching user:", error);
        router.push("/login");
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [router]);

  useEffect(() => {
    // Fetch user profile when user is loaded
    const fetchUserProfile = async () => {
      if (!user) return;

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
          });
        }
      } catch (error) {
        console.error("Error fetching user profile:", error);
      }
    };

    fetchUserProfile();
  }, [user]);

  useEffect(() => {
    // Fetch clients when user is loaded
    const fetchClients = async () => {
      if (!user) return;

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
  }, [user]);

  useEffect(() => {
    // Fetch projects when user is loaded
    const fetchProjects = async () => {
      if (!user) return;

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
  }, [user]);

  useEffect(() => {
    // Fetch presets when user is loaded
    const fetchPresets = async () => {
      if (!user) return;

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
  }, [user]);

  // Check for URL parameters on mount (for shared links)
  useEffect(() => {
    if (!user) return;

    const params = new URLSearchParams(window.location.search);
    const clientId = params.get("clientId");
    const projectId = params.get("projectId");
    const startDate = params.get("startDate");
    const endDate = params.get("endDate");

    // If any filter parameters exist in URL, update filters and generate report
    if (clientId || projectId || startDate || endDate) {
      setFilters({
        clientId: clientId || "",
        projectId: projectId || "",
        startDate: startDate || new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          .toISOString()
          .split("T")[0],
        endDate: endDate || new Date().toISOString().split("T")[0],
      });

      // Auto-generate report after a short delay to ensure filters are set
      setTimeout(() => {
        generateReport();
      }, 100);
    }
  }, [user]);

  const generateReport = async () => {
    if (!user) return;

    setReportLoading(true);
    setError("");

    try {
      // Build query parameters
      const params = new URLSearchParams();
      if (filters.clientId) params.append("clientId", filters.clientId);
      if (filters.projectId) params.append("projectId", filters.projectId);
      if (filters.startDate) params.append("startDate", filters.startDate);
      if (filters.endDate) params.append("endDate", filters.endDate);

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
    if (!user || !presetName.trim()) {
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

  const handleExportPdf = () => {
    setShowExportDialog(true);
  };

  const confirmExportPdf = (template: PdfTemplate) => {
    setSelectedTemplate(template);
    setShowExportDialog(false);

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
      const baseStyles = `
        @media print {
          body > *:not(#pdf-content) { display: none !important; }
          #pdf-content { display: block !important; direction: rtl !important; }
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
            .pdf-header { background: #2563EB !important; color: white !important; border-radius: 12px; }
            .pdf-section { background: #f8fafc !important; border-radius: 12px; }
            .pdf-table thead { background: #f1f5f9 !important; }
            .pdf-table th { color: #475569; font-weight: 600; }
          }
        `,
        classic: `
          ${baseStyles}
          @media print {
            .pdf-header { border-bottom: 3px solid #1a1a1a; padding-bottom: 1.5rem; }
            .pdf-business-name { color: #1a1a1a; font-weight: 700; font-family: Georgia, serif; }
            .pdf-section { border: 1px solid #ddd; }
            .pdf-section-title { background: #f5f5f5; padding: 0.75rem 1rem; border-bottom: 1px solid #ddd; font-weight: 700; }
            .pdf-table th { font-family: Georgia, serif; text-transform: uppercase; font-size: 11px; }
          }
        `,
        bold: `
          ${baseStyles}
          @media print {
            .pdf-header { background: #E85D04 !important; color: white !important; padding: 2.5rem 2rem; }
            .pdf-business-name { font-size: 32px; font-weight: 900; text-transform: uppercase; }
            .pdf-section { border-left: 6px solid #E85D04; box-shadow: 0 2px 8px rgba(232, 93, 4, 0.1); }
            .pdf-table thead { background: #E85D04 !important; color: white !important; }
            .pdf-table th { color: white; font-weight: 700; text-transform: uppercase; }
          }
        `,
        elegant: `
          ${baseStyles}
          @media print {
            .pdf-header { background: #2d3748 !important; color: #e2e8f0; padding: 2rem; }
            .pdf-section { border: 1px solid #e2e8f0; }
            .pdf-section-title { color: #4a5568; padding: 1rem 1.5rem; background: #f7fafc; border-bottom: 1px solid #e2e8f0; }
            .pdf-table th { color: #4a5568; font-weight: 600; font-size: 12px; letter-spacing: 0.5px; }
          }
        `,
        nature: `
          ${baseStyles}
          @media print {
            .pdf-header { background: #059669 !important; color: white !important; border-radius: 16px; }
            .pdf-section { background: linear-gradient(to bottom, #ECFDF5 0%, #D1FAE5 100%); border-radius: 16px; border: 1px solid #A7F3D0; }
            .pdf-table thead { background: #059669 !important; color: white !important; }
            .pdf-table th { color: white; font-weight: 600; }
            .pdf-table tbody tr:nth-child(even) td { background: #F0FDFA !important; }
          }
        `,
        ocean: `
          ${baseStyles}
          @media print {
            .pdf-header { background: linear-gradient(135deg, #0891B2 0%, #0E7490 100%) !important; color: white !important; border-radius: 12px; }
            .pdf-section { background: white; border-radius: 12px; border: 1px solid #CFFAFE; }
            .pdf-section-title { color: #0E7490; padding-bottom: 0.75rem; border-bottom: 2px solid #0891B2; }
            .pdf-table thead { background: #0891B2 !important; color: white !important; }
            .pdf-table th { color: white; font-weight: 600; }
            .pdf-table tbody tr:nth-child(even) { background: #ECFEFF !important; }
          }
        `
      };

      return templateStyles[t] || templateStyles.modern;
    };

    styleEl.innerHTML = getTemplateStyles(template);

    // Trigger browser print (which allows "Save as PDF")
    setTimeout(() => {
      window.print();
      // Clean up styles after print
      setTimeout(() => {
        if (styleEl && styleEl.parentNode) {
          styleEl.parentNode.removeChild(styleEl);
        }
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">טוען...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">דוחות</h1>
            <Link
              href="/"
              className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              חזרה לדשבורד
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Filters Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">פילטרים</h2>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {showFilters ? "הסתר" : "הצג"}
            </button>
          </div>

          {showFilters && (
            <div className="bg-card border rounded-lg p-6 space-y-4">
              {/* Date Range */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">תאריך התחלה</label>
                  <input
                    type="date"
                    value={filters.startDate}
                    onChange={(e) =>
                      setFilters({ ...filters, startDate: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-md bg-background"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">תאריך סיום</label>
                  <input
                    type="date"
                    value={filters.endDate}
                    onChange={(e) =>
                      setFilters({ ...filters, endDate: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-md bg-background"
                  />
                </div>
              </div>

              {/* Client Filter */}
              <div>
                <label className="block text-sm font-medium mb-2">לקוח</label>
                <select
                  value={filters.clientId}
                  onChange={(e) => handleClientChange(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md bg-background"
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
              <div>
                <label className="block text-sm font-medium mb-2">פרויקט</label>
                <select
                  value={filters.projectId}
                  onChange={(e) =>
                    setFilters({ ...filters, projectId: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-md bg-background"
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

              {/* Generate Button */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setShowLoadPresetDialog(true)}
                  disabled={presetsLoading || presets.length === 0}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title={presets.length === 0 ? "אין פריסטים שמורים" : "טען פריסט"}
                >
                  📂 טען פריסט
                </button>
                <button
                  onClick={() => setShowSavePresetDialog(true)}
                  className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
                  title="שמור פריסט"
                >
                  💾 שמור פריסט
                </button>
                <button
                  onClick={generateReport}
                  disabled={reportLoading}
                  className="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                    })
                  }
                  className="px-6 py-2 border border-border rounded-md hover:bg-accent transition-colors"
                >
                  נקה פילטרים
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive rounded-md">
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
                className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors shadow-md"
                title="העתק קישור לדוח"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                שתף דוח
              </button>
              <button
                onClick={handleExportExcel}
                className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-md"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                יצא ל-Excel
              </button>
              <button
                onClick={handleExportPdf}
                className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors shadow-md"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                יצא ל-PDF
              </button>
            </div>

            {/* PDF Content (for printing) - hidden on screen, visible in print */}
            <div id="pdf-content" className="print-only" dir="rtl">
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
                    <div className="pdf-summary-value" style={{ fontSize: "24px", fontWeight: "bold", color: "#2563EB" }}>
                      {reportData.summary.totalHours.toFixed(1)}
                    </div>
                  </div>
                  <div className="pdf-summary-card" style={{ padding: "1rem", backgroundColor: "#f8fafc", borderRadius: "8px" }}>
                    <div className="pdf-summary-label" style={{ fontSize: "12px", color: "#64748b", marginBottom: "0.25rem" }}>סה״כ רשומות</div>
                    <div className="pdf-summary-value" style={{ fontSize: "24px", fontWeight: "bold", color: "#2563EB" }}>
                      {reportData.summary.totalEntries}
                    </div>
                  </div>
                  {Object.keys(reportData.summary.totalAmounts).length > 0 && (
                    <div className="pdf-summary-card" style={{ padding: "1rem", backgroundColor: "#f8fafc", borderRadius: "8px", gridColumn: "span 2" }}>
                      <div className="pdf-summary-label" style={{ fontSize: "12px", color: "#64748b", marginBottom: "0.25rem" }}>סה״כ סכום</div>
                      <div className="pdf-summary-value" style={{ fontSize: "24px", fontWeight: "bold", color: "#2563EB" }}>
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
                        <div style={{ textAlign: "left" }}>
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

              {/* By Date Summary in PDF */}
              {reportData.byDate && reportData.byDate.length > 0 && (
                <div className="pdf-section" style={{ marginBottom: "1.5rem", padding: "1.5rem" }}>
                  <h2 className="pdf-section-title" style={{ fontSize: "18px", fontWeight: "bold", marginBottom: "1rem" }}>סיכום לפי תאריך (יומי)</h2>
                  <table className="pdf-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead style={{ backgroundColor: "#f1f5f9" }}>
                      <tr>
                        <th style={{ padding: "0.75rem 1rem", textAlign: "right", fontWeight: "600", fontSize: "13px", color: "#475569" }}>תאריך</th>
                        <th style={{ padding: "0.75rem 1rem", textAlign: "right", fontWeight: "600", fontSize: "13px", color: "#475569" }}>משך</th>
                        <th style={{ padding: "0.75rem 1rem", textAlign: "right", fontWeight: "600", fontSize: "13px", color: "#475569" }}>רשומות</th>
                        <th style={{ padding: "0.75rem 1rem", textAlign: "right", fontWeight: "600", fontSize: "13px", color: "#475569" }}>סכום</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.byDate.map((dateSummary, index) => (
                        <tr key={dateSummary.date} style={{ borderBottom: "1px solid #f1f5f9", backgroundColor: index % 2 === 0 ? "transparent" : "#f8fafc" }}>
                          <td style={{ padding: "0.75rem 1rem", textAlign: "right", fontSize: "13px" }}>{dateSummary.date}</td>
                          <td style={{ padding: "0.75rem 1rem", textAlign: "right", fontSize: "13px", fontWeight: "500" }}>{formatDuration(dateSummary.totalMinutes)}</td>
                          <td style={{ padding: "0.75rem 1rem", textAlign: "right", fontSize: "13px" }}>{dateSummary.entryCount}</td>
                          <td style={{ padding: "0.75rem 1rem", textAlign: "right", fontSize: "13px" }}>
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
                        <th style={{ padding: "0.75rem 1rem", textAlign: "right", fontWeight: "600", fontSize: "13px", color: "#475569" }}>תאריך</th>
                        <th style={{ padding: "0.75rem 1rem", textAlign: "right", fontWeight: "600", fontSize: "13px", color: "#475569" }}>לקוח</th>
                        <th style={{ padding: "0.75rem 1rem", textAlign: "right", fontWeight: "600", fontSize: "13px", color: "#475569" }}>פרויקט</th>
                        <th style={{ padding: "0.75rem 1rem", textAlign: "right", fontWeight: "600", fontSize: "13px", color: "#475569" }}>תיאור</th>
                        <th style={{ padding: "0.75rem 1rem", textAlign: "right", fontWeight: "600", fontSize: "13px", color: "#475569" }}>משך</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.entries.map((entry, index) => (
                        <tr key={entry.id} style={{ borderBottom: "1px solid #f1f5f9", backgroundColor: index % 2 === 0 ? "transparent" : "#f8fafc" }}>
                          <td style={{ padding: "0.75rem 1rem", textAlign: "right", fontSize: "13px" }}>{entry.date}</td>
                          <td style={{ padding: "0.75rem 1rem", textAlign: "right", fontSize: "13px" }}>{entry.clientName}</td>
                          <td style={{ padding: "0.75rem 1rem", textAlign: "right", fontSize: "13px" }}>{entry.projectName}</td>
                          <td style={{ padding: "0.75rem 1rem", textAlign: "right", fontSize: "13px" }}>{entry.description}</td>
                          <td style={{ padding: "0.75rem 1rem", textAlign: "right", fontSize: "13px", fontWeight: "500" }}>{formatDuration(entry.duration)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-card border rounded-lg p-6">
                <h3 className="text-sm font-medium text-muted-foreground mb-2">
                  סה״כ שעות
                </h3>
                <p className="text-3xl font-bold">
                  {reportData.summary.totalHours.toFixed(1)} שע׳
                </p>
              </div>
              <div className="bg-card border rounded-lg p-6">
                <h3 className="text-sm font-medium text-muted-foreground mb-2">
                  סה״כ רשומות
                </h3>
                <p className="text-3xl font-bold">
                  {reportData.summary.totalEntries}
                </p>
              </div>
              <div className="bg-card border rounded-lg p-6">
                <h3 className="text-sm font-medium text-muted-foreground mb-2">
                  סה״כ סכום
                </h3>
                {Object.keys(reportData.summary.totalAmounts).length > 0 ? (
                  <div className="space-y-1">
                    {Object.entries(reportData.summary.totalAmounts).map(
                      ([currency, amount]) => (
                        <p
                          key={currency}
                          className="text-2xl font-bold"
                        >
                          {formatCurrency(amount, currency)}
                        </p>
                      )
                    )}
                  </div>
                ) : (
                  <p className="text-lg text-muted-foreground">לא זמין</p>
                )}
              </div>
              <div className="bg-card border rounded-lg p-6">
                <h3 className="text-sm font-medium text-muted-foreground mb-2">
                  תקופה
                </h3>
                <p className="text-lg font-semibold">
                  {filters.startDate} עד {filters.endDate}
                </p>
              </div>
            </div>

            {/* By Client Summary */}
            {reportData.byClient.length > 0 && (
              <div className="bg-card border rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-4">סיכום לפי לקוח</h3>
                <div className="space-y-3">
                  {reportData.byClient.map((client) => (
                    <div
                      key={client.clientId}
                      className="flex items-center justify-between p-3 bg-accent rounded-md"
                    >
                      <div className="flex-1">
                        <p className="font-medium">{client.clientName}</p>
                        <p className="text-sm text-muted-foreground">
                          {client.entries.length} רשומות
                        </p>
                      </div>
                      <div className="text-left">
                        <p className="text-lg font-semibold">
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
              <div className="bg-card border rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-4">סיכום לפי פרויקט</h3>
                <div className="space-y-3">
                  {reportData.byProject.map((project) => (
                    <div
                      key={project.projectId}
                      className="flex items-center justify-between p-3 bg-accent rounded-md"
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
                      <div className="text-left">
                        <p className="text-lg font-semibold">
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

            {/* By Date Summary (Daily Breakdown) */}
            {reportData.byDate && reportData.byDate.length > 0 && (
              <div className="bg-card border rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-4">סיכום לפי תאריך (יומי)</h3>
                <div className="space-y-2">
                  {reportData.byDate.map((dateSummary) => (
                    <div
                      key={dateSummary.date}
                      className="flex items-center justify-between p-3 bg-accent rounded-md"
                    >
                      <div className="flex-1">
                        <p className="font-medium">{dateSummary.date}</p>
                        <p className="text-sm text-muted-foreground">
                          {dateSummary.entryCount} רשומות
                        </p>
                      </div>
                      <div className="text-left">
                        <p className="text-lg font-semibold">
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
              <div className="bg-card border rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-4">סיכום לפי שבוע</h3>
                <div className="space-y-2">
                  {reportData.byWeek.map((weekSummary) => (
                    <div
                      key={weekSummary.weekStart}
                      className="flex items-center justify-between p-3 bg-accent rounded-md"
                    >
                      <div className="flex-1">
                        <p className="font-medium">
                          {weekSummary.weekStart} עד {weekSummary.weekEnd}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {weekSummary.entryCount} רשומות
                        </p>
                      </div>
                      <div className="text-left">
                        <p className="text-lg font-semibold">
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
              <div className="bg-card border rounded-lg overflow-hidden">
                <div className="p-6 border-b">
                  <h3 className="text-lg font-semibold">רשומות מפורטות</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-accent">
                      <tr>
                        <th className="px-6 py-3 text-right text-sm font-medium">
                          תאריך
                        </th>
                        <th className="px-6 py-3 text-right text-sm font-medium">
                          לקוח
                        </th>
                        <th className="px-6 py-3 text-right text-sm font-medium">
                          פרויקט
                        </th>
                        <th className="px-6 py-3 text-right text-sm font-medium">
                          תיאור
                        </th>
                        <th className="px-6 py-3 text-right text-sm font-medium">
                          משך
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {reportData.entries.map((entry) => (
                        <tr key={entry.id} className="hover:bg-accent/50">
                          <td className="px-6 py-4 text-sm">{entry.date}</td>
                          <td className="px-6 py-4 text-sm">
                            {entry.clientName}
                          </td>
                          <td className="px-6 py-4 text-sm">
                            {entry.projectName}
                          </td>
                          <td className="px-6 py-4 text-sm">
                            {entry.description}
                          </td>
                          <td className="px-6 py-4 text-sm font-medium">
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
            {reportData.entries.length === 0 && (
              <div className="bg-card border rounded-lg p-12 text-center">
                <p className="text-muted-foreground text-lg">
                  לא נמצאו רשומות בטווח התאריכים הנבחר
                </p>
              </div>
            )}
          </div>
        )}

        {/* No Report Generated Yet */}
        {!reportData && !reportLoading && (
          <div className="bg-card border rounded-lg p-12 text-center">
            <p className="text-muted-foreground text-lg mb-4">
              בחר פילטרים ולחץ על &quot;צור דוח&quot; להצגת הדוח
            </p>
          </div>
        )}
      </main>

      {/* Template Selection Dialog */}
      {showExportDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-card border-b p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">בחר תבנית PDF</h2>
                <button
                  onClick={() => setShowExportDialog(false)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="text-muted-foreground mt-2">
                בחר את העיצוב המועדף עליך לדוח ה-PDF
              </p>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              {PDF_TEMPLATES.map((template) => (
                <button
                  key={template.value}
                  onClick={() => confirmExportPdf(template.value)}
                  className={`
                    border-2 rounded-lg p-6 text-right transition-all hover:shadow-lg
                    ${
                      selectedTemplate === template.value
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }
                  `}
                >
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-lg font-semibold">{template.label}</h3>
                    <div
                      className={`
                      w-6 h-6 rounded-full border-2 flex items-center justify-center
                      ${
                        selectedTemplate === template.value
                          ? "border-primary bg-primary"
                          : "border-muted-foreground"
                      }
                    `}
                    >
                      {selectedTemplate === template.value && (
                        <svg className="w-4 h-4 text-primary-foreground" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">{template.description}</p>
                  {/* Preview box with template style */}
                  <div
                    className={`
                    mt-4 p-3 rounded border text-sm
                    pdf-preview-${template.value}
                  `}
                  >
                    <div className="font-semibold">תצוגה מקדימה</div>
                    <div className="text-xs mt-1 opacity-70">הטקסט הזה יוצג בסגנון הנבחר</div>
                  </div>
                </button>
              ))}
            </div>

            <div className="sticky bottom-0 bg-card border-t p-6">
              <p className="text-sm text-muted-foreground text-center">
                לחץ על התבנית הרצויה לפתיחת חלון הדפסה - בחר &quot;שמור כ-PDF&quot; כדי להוריד את הדוח
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Save Preset Dialog */}
      {showSavePresetDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-lg shadow-xl max-w-md w-full">
            <div className="border-b p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">שמור פריסט</h2>
                <button
                  onClick={() => {
                    setShowSavePresetDialog(false);
                    setPresetName("");
                  }}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="text-muted-foreground mt-2">
                שמור את הגדרות הפילטרים הנוכחיות כפריסט
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">שם הפריסט</label>
                <input
                  type="text"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  placeholder="לדוגמה: דוח חודשי - לקוח הייטק"
                  className="w-full px-3 py-2 border rounded-md bg-background"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && presetName.trim()) {
                      handleSavePreset();
                    }
                  }}
                />
              </div>

              <div className="bg-muted/50 rounded-md p-4 space-y-2 text-sm">
                <p className="font-medium">הגדרות הפילטר:</p>
                <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                  <div>תאריך התחלה:</div>
                  <div className="text-left">{filters.startDate || "לא נבחר"}</div>
                  <div>תאריך סיום:</div>
                  <div className="text-left">{filters.endDate || "לא נבחר"}</div>
                  <div>לקוח:</div>
                  <div className="text-left">
                    {filters.clientId
                      ? clients.find((c) => c.id === filters.clientId)?.name || "לא נבחר"
                      : "כל הלקוחות"}
                  </div>
                  <div>פרויקט:</div>
                  <div className="text-left">
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
                className="flex-1 px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                שמור
              </button>
              <button
                onClick={() => {
                  setShowSavePresetDialog(false);
                  setPresetName("");
                }}
                className="px-6 py-2 border border-border rounded-md hover:bg-accent transition-colors"
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Load Preset Dialog */}
      {showLoadPresetDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-card border-b p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">טען פריסט</h2>
                <button
                  onClick={() => setShowLoadPresetDialog(false)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="text-muted-foreground mt-2">
                בחר פריסט שמור לטעינה
              </p>
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
                      className="border rounded-lg p-4 hover:border-primary/50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg mb-2">{preset.name}</h3>
                          <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                            <div>תאריך התחלה:</div>
                            <div className="text-left">{preset.startDate || "לא נבחר"}</div>
                            <div>תאריך סיום:</div>
                            <div className="text-left">{preset.endDate || "לא נבחר"}</div>
                            <div>לקוח:</div>
                            <div className="text-left">
                              {preset.clientId
                                ? clients.find((c) => c.id === preset.clientId)?.name || "לא נבחר"
                                : "כל הלקוחות"}
                            </div>
                            <div>פרויקט:</div>
                            <div className="text-left">
                              {preset.projectId
                                ? projects.find((p) => p.id === preset.projectId)?.name || "לא נבחר"
                                : "כל הפרויקטים"}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2 mr-4">
                          <button
                            onClick={() => handleLoadPreset(preset)}
                            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-sm"
                          >
                            טען
                          </button>
                          <button
                            onClick={() => handleDeletePreset(preset.id)}
                            className="px-4 py-2 bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 transition-colors text-sm"
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
              <button
                onClick={() => setShowLoadPresetDialog(false)}
                className="w-full px-6 py-2 border border-border rounded-md hover:bg-accent transition-colors"
              >
                סגור
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
