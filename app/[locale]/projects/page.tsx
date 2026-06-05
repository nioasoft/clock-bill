"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/src/i18n/navigation";
import { Link } from "@/src/i18n/navigation";
import { AppLayout } from "@/components/app-layout";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { FolderOpen } from "lucide-react";
import { validateRequired, validateDateRange } from "@/lib/validation";
import { fieldClass } from "@/lib/form-styles";
import { ROUNDING_LABELS } from "@/lib/rounding";

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
  fixedMonthlyEnabled: boolean;
  fixedMonthlyFee: number | null;
  fixedMonthlyStartDate: string | null;
  fixedMonthlyEndDate: string | null;
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
    fixedMonthlyEnabled: false,
    fixedMonthlyFee: "",
    fixedMonthlyStartDate: "",
    fixedMonthlyEndDate: "",
    billingRounding: "" as "" | "none" | "hour_up" | "half_hour_up",
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
    fixedMonthlyFee?: string;
    fixedMonthlyStartDate?: string;
    fixedMonthlyEndDate?: string;
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

    if (formData.fixedMonthlyEnabled) {
      const fee = parseFloat(formData.fixedMonthlyFee);
      if (!formData.fixedMonthlyFee || Number.isNaN(fee) || fee <= 0) {
        errors.fixedMonthlyFee = "יש להזין סכום חודשי גדול מ-0";
      }

      if (formData.fixedMonthlyStartDate && formData.fixedMonthlyEndDate) {
        const fixedDateValidation = validateDateRange(
          formData.fixedMonthlyStartDate,
          formData.fixedMonthlyEndDate,
          false
        );
        if (!fixedDateValidation.isValid) {
          errors.fixedMonthlyStartDate = fixedDateValidation.error;
          errors.fixedMonthlyEndDate = fixedDateValidation.error;
        }
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
          fixedMonthlyEnabled: formData.fixedMonthlyEnabled,
          fixedMonthlyFee: formData.fixedMonthlyEnabled ? parseFloat(formData.fixedMonthlyFee) : undefined,
          fixedMonthlyStartDate: formData.fixedMonthlyEnabled ? (formData.fixedMonthlyStartDate || undefined) : undefined,
          fixedMonthlyEndDate: formData.fixedMonthlyEnabled ? (formData.fixedMonthlyEndDate || undefined) : undefined,
          billingRounding: formData.billingRounding === "" ? null : formData.billingRounding,
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
          fixedMonthlyEnabled: false,
          fixedMonthlyFee: "",
          fixedMonthlyStartDate: "",
          fixedMonthlyEndDate: "",
          billingRounding: "" as "" | "none" | "hour_up" | "half_hour_up",
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
              className="rounded-[var(--radius-card)] bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
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
          <div className="mb-8 mx-auto max-w-2xl rounded-[var(--radius-card)] border border-border bg-card p-6 motion-safe:animate-scale-in">
            <div className="mb-5">
              <h2 className="font-display text-lg font-semibold text-foreground">פרויקט חדש</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">שייך את הפרויקט ללקוח והגדר את מודל החיוב</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {formError && (
                <div className="rounded-[var(--radius)] border border-destructive/30 bg-destructive/10 p-3.5 text-sm text-destructive">
                  {formError}
                </div>
              )}

              {/* Section — details */}
              <fieldset className="space-y-4">
                <legend className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  פרטי הפרויקט
                </legend>
                <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="clientId" className="mb-1.5 block text-sm font-medium text-foreground">
                      לקוח <span className="text-primary">*</span>
                    </label>
                    <select
                      id="clientId"
                      required
                      value={formData.clientId}
                      onChange={(e) => {
                        setFormData({ ...formData, clientId: e.target.value });
                        setFieldErrors({ ...fieldErrors, clientId: undefined });
                      }}
                      className={fieldClass(!!fieldErrors.clientId)}
                      disabled={submitting}
                    >
                      <option value="">בחר לקוח</option>
                      {clients.map((client) => (
                        <option key={client.id} value={client.id}>
                          {client.name}
                        </option>
                      ))}
                    </select>
                    {fieldErrors.clientId && <p className="mt-1.5 text-xs text-destructive">{fieldErrors.clientId}</p>}
                    {clients.length === 0 && (
                      <Link
                        href="/clients?create=true"
                        className="mt-1.5 inline-block text-xs text-primary hover:text-primary/90"
                      >
                        + צור לקוח חדש
                      </Link>
                    )}
                  </div>

                  <div>
                    <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-foreground">
                      שם הפרויקט <span className="text-primary">*</span>
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
                      className={fieldClass(!!fieldErrors.name)}
                      disabled={submitting}
                      placeholder="לדוגמה: עיצוב אתר"
                    />
                    {fieldErrors.name && <p className="mt-1.5 text-xs text-destructive">{fieldErrors.name}</p>}
                  </div>

                  <div>
                    <label htmlFor="status" className="mb-1.5 block text-sm font-medium text-foreground">
                      סטטוס
                    </label>
                    <select
                      id="status"
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className={fieldClass(false)}
                      disabled={submitting}
                    >
                      <option value="active">פעיל</option>
                      <option value="paused">מושהה</option>
                      <option value="completed">הושלם</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="startDate" className="mb-1.5 block text-sm font-medium text-foreground">
                        תאריך התחלה
                      </label>
                      <input
                        type="date"
                        id="startDate"
                        value={formData.startDate}
                        onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                        className={fieldClass(!!fieldErrors.startDate)}
                        disabled={submitting}
                      />
                      {fieldErrors.startDate && (
                        <p className="mt-1.5 text-xs text-destructive">{fieldErrors.startDate}</p>
                      )}
                    </div>
                    <div>
                      <label htmlFor="endDate" className="mb-1.5 block text-sm font-medium text-foreground">
                        תאריך סיום
                      </label>
                      <input
                        type="date"
                        id="endDate"
                        value={formData.endDate}
                        onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                        className={fieldClass(!!fieldErrors.endDate)}
                        disabled={submitting}
                      />
                      {fieldErrors.endDate && (
                        <p className="mt-1.5 text-xs text-destructive">{fieldErrors.endDate}</p>
                      )}
                    </div>
                  </div>
                </div>
              </fieldset>

              {/* Section — fixed monthly billing */}
              <fieldset className="space-y-4">
                <legend className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  חיוב קבוע
                </legend>
                <label className="flex cursor-pointer items-center justify-between gap-4 rounded-[var(--radius)] border border-border bg-background px-4 py-3">
                  <div>
                    <div className="text-sm font-medium text-foreground">חיוב קבוע חודשי</div>
                    <div className="text-xs text-muted-foreground">מתווסף לחיוב לפי שעות בדוחות</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.fixedMonthlyEnabled}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        fixedMonthlyEnabled: e.target.checked,
                        ...(e.target.checked ? {} : {
                          fixedMonthlyFee: "",
                          fixedMonthlyStartDate: "",
                          fixedMonthlyEndDate: "",
                        }),
                      })
                    }
                    className="h-4 w-4 shrink-0 rounded border-border accent-primary"
                    disabled={submitting}
                  />
                </label>

                {formData.fixedMonthlyEnabled && (
                  <div className="grid grid-cols-1 gap-x-4 gap-y-4 rounded-[var(--radius)] border border-border bg-background/50 p-4 sm:grid-cols-3">
                    <div>
                      <label htmlFor="fixedMonthlyFee" className="mb-1.5 block text-sm font-medium text-foreground">
                        סכום חודשי <span className="text-primary">*</span>
                      </label>
                      <input
                        type="number"
                        id="fixedMonthlyFee"
                        min="0"
                        step="0.01"
                        value={formData.fixedMonthlyFee}
                        onChange={(e) => {
                          setFormData({ ...formData, fixedMonthlyFee: e.target.value });
                          setFieldErrors({ ...fieldErrors, fixedMonthlyFee: undefined });
                        }}
                        className={`${fieldClass(!!fieldErrors.fixedMonthlyFee)} font-mono`}
                        disabled={submitting}
                        placeholder="0.00"
                      />
                      {fieldErrors.fixedMonthlyFee && <p className="mt-1.5 text-xs text-destructive">{fieldErrors.fixedMonthlyFee}</p>}
                    </div>

                    <div>
                      <label htmlFor="fixedMonthlyStartDate" className="mb-1.5 block text-sm font-medium text-foreground">
                        תוקף מ-
                      </label>
                      <input
                        type="date"
                        id="fixedMonthlyStartDate"
                        value={formData.fixedMonthlyStartDate}
                        onChange={(e) => setFormData({ ...formData, fixedMonthlyStartDate: e.target.value })}
                        className={fieldClass(!!fieldErrors.fixedMonthlyStartDate)}
                        disabled={submitting}
                      />
                      {fieldErrors.fixedMonthlyStartDate && <p className="mt-1.5 text-xs text-destructive">{fieldErrors.fixedMonthlyStartDate}</p>}
                    </div>

                    <div>
                      <label htmlFor="fixedMonthlyEndDate" className="mb-1.5 block text-sm font-medium text-foreground">
                        תוקף עד
                      </label>
                      <input
                        type="date"
                        id="fixedMonthlyEndDate"
                        value={formData.fixedMonthlyEndDate}
                        onChange={(e) => setFormData({ ...formData, fixedMonthlyEndDate: e.target.value })}
                        className={fieldClass(!!fieldErrors.fixedMonthlyEndDate)}
                        disabled={submitting}
                      />
                      {fieldErrors.fixedMonthlyEndDate && <p className="mt-1.5 text-xs text-destructive">{fieldErrors.fixedMonthlyEndDate}</p>}
                    </div>
                  </div>
                )}
              </fieldset>

              {/* Section — billing rounding */}
              <fieldset className="space-y-2">
                <legend className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  עיגול זמן לחיוב
                </legend>
                <select
                  id="billingRounding"
                  value={formData.billingRounding}
                  onChange={(e) => setFormData({ ...formData, billingRounding: e.target.value as typeof formData.billingRounding })}
                  className={fieldClass(false)}
                  disabled={submitting}
                >
                  <option value="">ירושה מהלקוח</option>
                  <option value="none">{ROUNDING_LABELS.none}</option>
                  <option value="hour_up">{ROUNDING_LABELS.hour_up}</option>
                  <option value="half_hour_up">{ROUNDING_LABELS.half_hour_up}</option>
                </select>
                <p className="text-xs text-muted-foreground">חל על תעריפים שעתיים בלבד.</p>
              </fieldset>

              {/* Section — notes */}
              <fieldset className="space-y-4">
                <legend className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  הערות
                </legend>
                <textarea
                  id="notes"
                  rows={3}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className={`${fieldClass(false)} resize-y`}
                  disabled={submitting}
                  placeholder="מידע נוסף על הפרויקט (אופציונלי)"
                />
              </fieldset>

              <div className="flex justify-end gap-3 border-t border-border pt-5">
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
                      fixedMonthlyEnabled: false,
                      fixedMonthlyFee: "",
                      fixedMonthlyStartDate: "",
                      fixedMonthlyEndDate: "",
                      billingRounding: "" as "" | "none" | "hour_up" | "half_hour_up",
                      notes: "",
                    });
                  }}
                  className="rounded-[var(--radius)] border border-border px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                  disabled={submitting}
                >
                  ביטול
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-[var(--radius)] bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                >
                  {submitting ? "שומר..." : "שמור פרויקט"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Projects List */}
        <div className="rounded-[var(--radius-card)] bg-card shadow">
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
            <>
            <div className="hidden md:block overflow-x-auto">
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

            <div className="md:hidden divide-y divide-border">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className="cursor-pointer p-4"
                  onClick={() => router.push(`/projects/${project.id}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") router.push(`/projects/${project.id}`); }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm font-semibold text-primary">{project.name}</div>
                    {project.status === "active" ? (
                      <span className="inline-flex shrink-0 rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-semibold text-success">{getStatusLabel(project.status)}</span>
                    ) : project.status === "completed" ? (
                      <span className="inline-flex shrink-0 rounded-full bg-secondary/10 px-2.5 py-0.5 text-xs font-semibold text-secondary">{getStatusLabel(project.status)}</span>
                    ) : project.status === "paused" ? (
                      <span className="inline-flex shrink-0 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-700">{getStatusLabel(project.status)}</span>
                    ) : (
                      <span className="inline-flex shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">{getStatusLabel(project.status)}</span>
                    )}
                  </div>

                  <div className="mt-1 text-sm text-muted-foreground">{project.clientName}</div>

                  <div className="mt-1 text-xs text-muted-foreground">
                    {project.startDate ? new Date(project.startDate).toLocaleDateString("he-IL") : "-"}
                    {" - "}
                    {project.endDate ? new Date(project.endDate).toLocaleDateString("he-IL") : "ללא תאריך סיום"}
                  </div>

                  {statusFilter === "archived" && (
                    <div className="mt-3">
                      <button
                        onClick={(e) => handleRestore(project.id, e)}
                        className="min-h-[44px] rounded-[var(--radius)] border border-border px-4 py-2 text-sm font-medium text-success transition-colors hover:bg-surface"
                      >
                        שחזר
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            </>
          )}
        </div>
      </PageContainer>
    </AppLayout>
  );
}
