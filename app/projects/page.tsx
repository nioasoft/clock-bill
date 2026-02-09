"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AppLayout } from "@/components/app-layout";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { FolderOpen } from "lucide-react";
import { validateRequired, validateDateRange } from "@/lib/validation";

interface Client {
  id: string;
  name: string;
  isActive: boolean;
}

interface Project {
  id: string;
  name: string;
  clientId: string;
  clientName: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  notes: string | null;
  createdAt: string;
}

export default function ProjectsPage() {
  return (
    <Suspense>
      <ProjectsPageContent />
    </Suspense>
  );
}

function ProjectsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"active" | "archived">("active");
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    clientId: "",
    name: "",
    status: "active",
    startDate: "",
    endDate: "",
    notes: "",
  });
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Field validation errors
  const [fieldErrors, setFieldErrors] = useState<{
    clientId?: string;
    name?: string;
    startDate?: string;
    endDate?: string;
  }>({});

  // Auto-open create form via URL params
  useEffect(() => {
    if (searchParams.get("create") === "true") {
      setShowForm(true);
      const clientId = searchParams.get("clientId");
      if (clientId) {
        setFormData((prev) => ({ ...prev, clientId }));
      }
    }
  }, [searchParams]);

  useEffect(() => {
    const fetchClients = async () => {
      try {
        const response = await fetch("/api/clients");
        const data = await response.json();

        if (data.success) {
          setClients(data.clients.filter((c: Client) => c.isActive && true));
        }
      } catch (error) {
        console.error("Error fetching clients:", error);
      }
    };

    fetchClients();
  }, []);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        setProjectsLoading(true);
        const url = statusFilter === "archived"
          ? "/api/projects?status=archived"
          : "/api/projects?status=active";
        const response = await fetch(url);
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
  }, [statusFilter]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setFieldErrors({});

    // Validate form fields
    const errors: typeof fieldErrors = {};

    // Client is required
    if (!formData.clientId) {
      errors.clientId = "נא לבחור לקוח";
    }

    // Name is required
    const nameValidation = validateRequired(formData.name, "שם הפרויקט");
    if (!nameValidation.isValid) {
      errors.name = nameValidation.error;
    }

    // Validate date fields (optional but must be valid if provided)
    if (formData.startDate || formData.endDate) {
      const dateRangeValidation = validateDateRange(formData.startDate, formData.endDate, false);
      if (!dateRangeValidation.isValid) {
        errors.startDate = dateRangeValidation.error;
        errors.endDate = dateRangeValidation.error;
      }
    }

    // If there are errors, display them and don't submit
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          clientId: formData.clientId,
          name: formData.name,
          status: formData.status,
          startDate: formData.startDate || undefined,
          endDate: formData.endDate || undefined,
          notes: formData.notes || undefined,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Add the new project to the list
        setProjects([data.project, ...projects]);
        // Reset form and close
        setFormData({
          clientId: "",
          name: "",
          status: "active",
          startDate: "",
          endDate: "",
          notes: "",
        });
        setShowForm(false);
      } else {
        setFormError(data.message || "שגיאה ביצירת הפרויקט");
      }
    } catch (error) {
      console.error("Error saving project:", error);
      setFormError("שגיאה ביצירת הפרויקט");
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "active":
        return "פעיל";
      case "completed":
        return "הושלם";
      case "paused":
        return "מושהה";
      case "archived":
        return "בארכיון";
      default:
        return status;
    }
  };

  const handleRestore = async (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent navigating to project details

    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: "active",
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Remove the restored project from the list
        setProjects(projects.filter((p) => p.id !== projectId));
      } else {
        alert(data.message || "שגיאה בשחזור הפרויקט");
      }
    } catch (error) {
      console.error("Error restoring project:", error);
      alert("שגיאה בשחזור הפרויקט");
    }
  };

  return (
    <AppLayout>
      <PageContainer>
        <PageHeader title="פרויקטים">
          {statusFilter === "active" && (
            <button
              onClick={() => setShowForm(!showForm)}
              className="rounded-[14px] bg-primary px-4 py-2 text-white hover:bg-primary/90"
            >
              {showForm ? "ביטול" : "+ פרויקט חדש"}
            </button>
          )}
        </PageHeader>

        {/* Status Filter Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setStatusFilter("active")}
            className={`rounded-full px-5 py-1.5 text-sm font-medium transition-colors ${
              statusFilter === "active"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            פעילים
          </button>
          <button
            onClick={() => setStatusFilter("archived")}
            className={`rounded-full px-5 py-1.5 text-sm font-medium transition-colors ${
              statusFilter === "archived"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            ארכיון
          </button>
        </div>
        {/* Add Project Form */}
        {showForm && (
          <div className="mb-8 rounded-[14px] bg-surface p-6 shadow motion-safe:animate-scale-in">
            <h2 className="text-xl font-semibold text-foreground mb-4">הוסף פרויקט חדש</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              {formError && (
                <div className="rounded-[14px] bg-destructive/10 p-4 text-sm text-destructive">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="clientId" className="block text-sm font-medium text-foreground">
                    לקוח *
                  </label>
                  <select
                    id="clientId"
                    required
                    value={formData.clientId}
                    onChange={(e) => {
                      setFormData({ ...formData, clientId: e.target.value });
                      setFieldErrors({ ...fieldErrors, clientId: undefined });
                    }}
                    className={`mt-1 block w-full rounded-[var(--radius)] border bg-card px-3 py-2.5 shadow-sm focus:outline-none focus:ring-primary disabled:opacity-50 ${
                      fieldErrors.clientId
                        ? "border-destructive/30 focus:border-destructive focus:ring-destructive/20"
                        : "border-border focus:border-primary"
                    }`}
                    disabled={submitting}
                  >
                    <option value="">בחר לקוח</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.name}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.clientId && <p className="mt-1 text-sm text-destructive">{fieldErrors.clientId}</p>}
                  {clients.length === 0 && (
                    <Link
                      href="/clients?create=true"
                      className="mt-1 inline-block text-xs text-primary hover:text-primary/90"
                    >
                      + צור לקוח חדש
                    </Link>
                  )}
                </div>

                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-foreground">
                    שם הפרויקט *
                  </label>
                  <input
                    type="text"
                    id="name"
                    required
                    value={formData.name}
                    onChange={(e) => {
                      setFormData({ ...formData, name: e.target.value });
                      setFieldErrors({ ...fieldErrors, name: undefined });
                    }}
                    className={`mt-1 block w-full rounded-[var(--radius)] border bg-card px-3 py-2.5 shadow-sm focus:outline-none focus:ring-primary disabled:opacity-50 ${
                      fieldErrors.name
                        ? "border-destructive/30 focus:border-destructive focus:ring-destructive/20"
                        : "border-border focus:border-primary"
                    }`}
                    disabled={submitting}
                  />
                  {fieldErrors.name && <p className="mt-1 text-sm text-destructive">{fieldErrors.name}</p>}
                </div>

                <div>
                  <label htmlFor="status" className="block text-sm font-medium text-foreground">
                    סטטוס
                  </label>
                  <select
                    id="status"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="mt-1 block w-full rounded-[var(--radius)] border border-border bg-card px-3 py-2.5 shadow-sm focus:border-primary focus:outline-none focus:ring-primary"
                    disabled={submitting}
                  >
                    <option value="active">פעיל</option>
                    <option value="paused">מושהה</option>
                    <option value="completed">הושלם</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="startDate" className="block text-sm font-medium text-foreground">
                    תאריך התחלה
                  </label>
                  <input
                    type="date"
                    id="startDate"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className={`mt-1 block w-full rounded-[var(--radius)] border bg-card px-3 py-2.5 shadow-sm focus:border-primary focus:outline-none focus:ring-primary ${fieldErrors.startDate ? "border-destructive" : "border-border"}`}
                    disabled={submitting}
                  />
                  {fieldErrors.startDate && (
                    <p className="mt-1 text-xs text-destructive">{fieldErrors.startDate}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="endDate" className="block text-sm font-medium text-foreground">
                    תאריך סיום
                  </label>
                  <input
                    type="date"
                    id="endDate"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className={`mt-1 block w-full rounded-[var(--radius)] border bg-card px-3 py-2.5 shadow-sm focus:border-primary focus:outline-none focus:ring-primary ${fieldErrors.endDate ? "border-destructive" : "border-border"}`}
                    disabled={submitting}
                  />
                  {fieldErrors.endDate && (
                    <p className="mt-1 text-xs text-destructive">{fieldErrors.endDate}</p>
                  )}
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="notes" className="block text-sm font-medium text-foreground">
                    הערות
                  </label>
                  <textarea
                    id="notes"
                    rows={3}
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="mt-1 block w-full rounded-[var(--radius)] border border-border bg-card px-3 py-2.5 shadow-sm focus:border-primary focus:outline-none focus:ring-primary"
                    disabled={submitting}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setFormData({
                      clientId: "",
                      name: "",
                      status: "active",
                      startDate: "",
                      endDate: "",
                      notes: "",
                    });
                  }}
                  className="rounded-[14px] border border-border px-4 py-2 text-foreground hover:bg-muted"
                  disabled={submitting}
                >
                  ביטול
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-[14px] bg-primary px-4 py-2 text-white hover:bg-primary/90 disabled:opacity-50"
                >
                  {submitting ? "שומר..." : "שמור"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Projects List */}
        <div className="rounded-[14px] bg-card shadow">
          {projectsLoading ? (
            <div className="p-8 text-center text-muted-foreground">טוען פרויקטים...</div>
          ) : projects.length === 0 ? (
            <EmptyState
              icon={FolderOpen}
              message={statusFilter === "archived" ? "אין פרויקטים בארכיון" : "אין פרויקטים עדיין"}
              description={
                statusFilter === "archived"
                  ? "פרויקטים שארכבת יופיעו כאן"
                  : clients.length === 0
                  ? "צור לקוח תחילה ואז תוכל ליצור פרויקטים"
                  : "צור פרויקט ראשון כדי להתחיל לעקוב אחר זמן העבודה שלך"
              }
              actionLabel={statusFilter === "archived" ? undefined : "צור פרויקט"}
              onAction={statusFilter === "archived" ? undefined : () => setShowForm(true)}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border">
                <thead className="bg-surface">
                  <tr>
                    <th className="px-6 py-3 text-start text-xs uppercase tracking-wider font-semibold text-foreground">
                      שם
                    </th>
                    <th className="px-6 py-3 text-start text-xs uppercase tracking-wider font-semibold text-foreground">
                      לקוח
                    </th>
                    <th className="px-6 py-3 text-start text-xs uppercase tracking-wider font-semibold text-foreground">
                      סטטוס
                    </th>
                    <th className="px-6 py-3 text-start text-xs uppercase tracking-wider font-semibold text-foreground">
                      תאריכים
                    </th>
                    {statusFilter === "archived" && (
                      <th className="px-6 py-3 text-start text-xs uppercase tracking-wider font-semibold text-foreground">
                        פעולות
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-card">
                  {projects.map((project) => (
                    <tr
                      key={project.id}
                      className="even:bg-surface/50 hover:bg-surface"
                    >
                      <td
                        className="whitespace-nowrap px-6 py-4 cursor-pointer"
                        onClick={() => router.push(`/projects/${project.id}`)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') router.push(`/projects/${project.id}`); }}
                      >
                        <div className="text-sm font-medium text-primary hover:text-primary/90">{project.name}</div>
                      </td>
                      <td
                        className="whitespace-nowrap px-6 py-4 cursor-pointer"
                        onClick={() => router.push(`/projects/${project.id}`)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') router.push(`/projects/${project.id}`); }}
                      >
                        <div className="text-sm text-foreground">{project.clientName}</div>
                      </td>
                      <td
                        className="whitespace-nowrap px-6 py-4 cursor-pointer"
                        onClick={() => router.push(`/projects/${project.id}`)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') router.push(`/projects/${project.id}`); }}
                      >
                        {project.status === "active" ? (
                          <span className="inline-flex rounded-full bg-success/10 text-success px-3 py-0.5 text-xs font-semibold">
                            {getStatusLabel(project.status)}
                          </span>
                        ) : project.status === "completed" ? (
                          <span className="inline-flex rounded-full bg-secondary/10 text-secondary px-3 py-0.5 text-xs font-semibold">
                            {getStatusLabel(project.status)}
                          </span>
                        ) : project.status === "paused" ? (
                          <span className="inline-flex rounded-full bg-amber-500/10 text-amber-700 px-3 py-0.5 text-xs font-semibold">
                            {getStatusLabel(project.status)}
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-muted text-muted-foreground px-3 py-0.5 text-xs font-semibold">
                            {getStatusLabel(project.status)}
                          </span>
                        )}
                      </td>
                      <td
                        className="px-6 py-4 cursor-pointer"
                        onClick={() => router.push(`/projects/${project.id}`)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') router.push(`/projects/${project.id}`); }}
                      >
                        <div className="text-sm text-muted-foreground">
                          {project.startDate ? new Date(project.startDate).toLocaleDateString("he-IL") : "-"}
                          {" - "}
                          {project.endDate ? new Date(project.endDate).toLocaleDateString("he-IL") : "ללא תאריך סיום"}
                        </div>
                      </td>
                      {statusFilter === "archived" && (
                        <td className="whitespace-nowrap px-6 py-4">
                          <button
                            onClick={(e) => handleRestore(project.id, e)}
                            className="text-sm font-medium text-success hover:text-success/90"
                          >
                            שחזר
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </PageContainer>
    </AppLayout>
  );
}
