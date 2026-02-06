"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface User {
  id: string;
  email: string;
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
}

interface ClientSummary {
  clientId: string;
  clientName: string;
  totalMinutes: number;
  totalHours: number;
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
  entries: ReportEntry[];
}

interface ReportData {
  entries: ReportEntry[];
  summary: ReportSummary;
  byClient: ClientSummary[];
  byProject: ProjectSummary[];
}

export default function ReportsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [clients, setClients] = useState<Client[]>([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
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
              <div className="flex gap-2">
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
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                      <div>
                        <p className="font-medium">{client.clientName}</p>
                        <p className="text-sm text-muted-foreground">
                          {client.entries.length} רשומות
                        </p>
                      </div>
                      <p className="text-lg font-semibold">
                        {formatDuration(client.totalMinutes)}
                      </p>
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
    </div>
  );
}
