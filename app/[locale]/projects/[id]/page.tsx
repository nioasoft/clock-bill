"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useRouter } from "@/src/i18n/navigation";
import { Link } from "@/src/i18n/navigation";
import { AppLayout } from "@/components/app-layout";
import { PageContainer } from "@/components/page-container";
import { Breadcrumb } from "@/components/breadcrumb";
import { validateRequired, validateDateRange } from "@/lib/validation";
import { useValidationMessage } from "@/lib/validation-messages";
import { resolveRounding, ROUNDING_MODES, type RoundingMode } from "@/lib/rounding";
import { messageForError } from "@/lib/api-error";
import { useTranslations, useLocale } from "next-intl";
import { SimpleSelect } from "@/components/ui/simple-select";

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
  billingRounding: string | null;
  clientBillingRounding: string | null;
  notes: string | null;
  createdAt: string;
  totalHours?: number;
  totalAmount?: number;
}

export default function ProjectDetailsPage() {
  const t = useTranslations("Projects");
  const tRoot = useTranslations();
  const tRounding = useTranslations("Rounding");
  const resolveValidation = useValidationMessage();
  const intlLocale = useLocale() === "en" ? "en-US" : "he-IL";
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [projectLoading, setProjectLoading] = useState(true);
  const [projectStats, setProjectStats] = useState<{
    totalHours: number;
    entryCount: number;
  } | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [recentEntries, setRecentEntries] = useState<{
    id: string;
    description: string;
    date: string;
    duration: number;
  }[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(true);
  const [profileRounding, setProfileRounding] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    status: "active",
    startDate: "",
    endDate: "",
    fixedMonthlyEnabled: false,
    fixedMonthlyFee: "",
    fixedMonthlyStartDate: "",
    fixedMonthlyEndDate: "",
    billingRounding: "" as "" | RoundingMode,
    notes: "",
  });
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // The edit form / confirm dialogs render in the actions footer at the bottom.
  // Scroll them into view when opened so the trigger feels connected to the result.
  const actionsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (showEditForm || showDeleteConfirm || showArchiveConfirm) {
      actionsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [showEditForm, showDeleteConfirm, showArchiveConfirm]);

  // Field validation errors
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    startDate?: string;
    endDate?: string;
    fixedMonthlyFee?: string;
    fixedMonthlyStartDate?: string;
    fixedMonthlyEndDate?: string;
  }>({});

  useEffect(() => {
    const fetchProject = async () => {
      if (!projectId) return;

      try {
        setProjectLoading(true);
        const response = await fetch(`/api/projects/${projectId}`);
        const data = await response.json();

        if (data.success && data.project) {
          setProject(data.project);
          // Initialize form data with project data
          setFormData({
            name: data.project.name,
            status: data.project.status,
            startDate: data.project.startDate || "",
            endDate: data.project.endDate || "",
            fixedMonthlyEnabled: data.project.fixedMonthlyEnabled ?? false,
            fixedMonthlyFee: data.project.fixedMonthlyFee?.toString() || "",
            fixedMonthlyStartDate: data.project.fixedMonthlyStartDate || "",
            fixedMonthlyEndDate: data.project.fixedMonthlyEndDate || "",
            billingRounding: (data.project.billingRounding ?? "") as "" | RoundingMode,
            notes: data.project.notes || "",
          });
        } else {
          // Project not found, redirect to projects list
          router.push("/projects");
        }
      } catch (error) {
        console.error("Error fetching project:", error);
        router.push("/projects");
      } finally {
        setProjectLoading(false);
      }
    };

    fetchProject();
  }, [projectId, router]);

  useEffect(() => {
    const fetchProjectStats = async () => {
      if (!projectId) return;

      try {
        setStatsLoading(true);
        const response = await fetch(`/api/projects/${projectId}/stats`);
        const data = await response.json();

        if (data.success && data.stats) {
          setProjectStats({
            totalHours: data.stats.totalHours,
            entryCount: data.stats.entryCount,
          });
        }
      } catch (error) {
        console.error("Error fetching project stats:", error);
      } finally {
        setStatsLoading(false);
      }
    };

    fetchProjectStats();
  }, [projectId]);

  useEffect(() => {
    const fetchProjectEntries = async () => {
      if (!projectId) return;
      try {
        setEntriesLoading(true);
        const response = await fetch(`/api/entries?projectId=${projectId}`);
        const data = await response.json();
        if (data.success) {
          setRecentEntries((data.entries || []).slice(0, 5));
        }
      } catch (error) {
        console.error("Error fetching project entries:", error);
      } finally {
        setEntriesLoading(false);
      }
    };
    fetchProjectEntries();
  }, [projectId]);

  useEffect(() => {
    let active = true;
    fetch("/api/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (active && data?.profile) {
          setProfileRounding(data.profile.defaultBillingRounding ?? null);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setFieldErrors({});

    // Validate form fields
    const errors: typeof fieldErrors = {};

    // Name is required
    const nameValidation = validateRequired(formData.name, "projectName");
    if (!nameValidation.isValid) {
      errors.name = resolveValidation(nameValidation.code);
    }

    // Validate date fields (optional but must be valid if provided)
    if (formData.startDate || formData.endDate) {
      const dateRangeValidation = validateDateRange(formData.startDate, formData.endDate, false);
      if (!dateRangeValidation.isValid) {
        errors.startDate = resolveValidation(dateRangeValidation.code);
        errors.endDate = resolveValidation(dateRangeValidation.code);
      }
    }

    if (formData.fixedMonthlyEnabled) {
      const fee = parseFloat(formData.fixedMonthlyFee);
      if (!formData.fixedMonthlyFee || Number.isNaN(fee) || fee <= 0) {
        errors.fixedMonthlyFee = t("errors.monthlyFeePositive");
      }

      if (formData.fixedMonthlyStartDate && formData.fixedMonthlyEndDate) {
        const fixedDateValidation = validateDateRange(
          formData.fixedMonthlyStartDate,
          formData.fixedMonthlyEndDate,
          false
        );
        if (!fixedDateValidation.isValid) {
          errors.fixedMonthlyStartDate = resolveValidation(fixedDateValidation.code);
          errors.fixedMonthlyEndDate = resolveValidation(fixedDateValidation.code);
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
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formData.name,
          status: formData.status,
          startDate: formData.startDate || null,
          endDate: formData.endDate || null,
          fixedMonthlyEnabled: formData.fixedMonthlyEnabled,
          fixedMonthlyFee: formData.fixedMonthlyEnabled ? parseFloat(formData.fixedMonthlyFee) : null,
          fixedMonthlyStartDate: formData.fixedMonthlyEnabled ? (formData.fixedMonthlyStartDate || null) : null,
          fixedMonthlyEndDate: formData.fixedMonthlyEnabled ? (formData.fixedMonthlyEndDate || null) : null,
          billingRounding: formData.billingRounding === "" ? null : formData.billingRounding,
          notes: formData.notes || null,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Update the project in state
        setProject(data.project);
        setShowEditForm(false);
        setFieldErrors({});
      } else {
        setFormError(data.error_code ? messageForError(data, tRoot) : t("errors.updateFailed"));
      }
    } catch (error) {
      console.error("Error updating project:", error);
      setFormError(t("errors.updateFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setFormError("");
    setSubmitting(true);

    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (data.success) {
        // Redirect to projects list
        router.push("/projects");
      } else {
        setFormError(data.error_code ? messageForError(data, tRoot) : t("errors.deleteFailed"));
        setShowDeleteConfirm(false);
      }
    } catch (error) {
      console.error("Error deleting project:", error);
      setFormError(t("errors.deleteFailed"));
      setShowDeleteConfirm(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchive = async () => {
    if (!project) return;

    setFormError("");
    setSubmitting(true);

    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: "archived",
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Redirect to projects list
        router.push("/projects");
      } else {
        setFormError(data.error_code ? messageForError(data, tRoot) : t("errors.archiveFailed"));
        setShowArchiveConfirm(false);
      }
    } catch (error) {
      console.error("Error archiving project:", error);
      setFormError(t("errors.archiveFailed"));
      setShowArchiveConfirm(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnarchive = async () => {
    if (!project) return;

    setFormError("");
    setSubmitting(true);

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
        // Update the project in state
        setProject(data.project);
      } else {
        setFormError(data.error_code ? messageForError(data, tRoot) : t("errors.restoreFailed"));
      }
    } catch (error) {
      console.error("Error unarchiving project:", error);
      setFormError(t("errors.restoreFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDuplicate = async () => {
    if (!project) return;

    setFormError("");
    setDuplicating(true);

    try {
      const response = await fetch(`/api/projects/${projectId}/duplicate`, {
        method: "POST",
      });

      const data = await response.json();

      if (data.success) {
        // Redirect to the duplicated project
        router.push(`/projects/${data.project.id}`);
      } else {
        setFormError(data.error_code ? messageForError(data, tRoot) : t("errors.duplicateFailed"));
      }
    } catch (error) {
      console.error("Error duplicating project:", error);
      setFormError(t("errors.duplicateFailed"));
    } finally {
      setDuplicating(false);
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "active":
        return t("status.active");
      case "completed":
        return t("status.completed");
      case "paused":
        return t("status.paused");
      case "archived":
        return t("status.archived");
      default:
        return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-success/10 text-success";
      case "completed":
        return "bg-secondary-light text-secondary";
      case "paused":
        return "bg-accent text-accent-foreground";
      default:
        return "bg-muted text-foreground";
    }
  };

  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}:${mins.toString().padStart(2, "0")}`;
  };

  if (projectLoading) {
    return (
      <AppLayout>
        <div className="min-h-[50vh] flex items-center justify-center">
          <div className="text-muted-foreground">{t("detail.loading")}</div>
        </div>
      </AppLayout>
    );
  }

  if (!project) {
    return (
      <AppLayout>
        <div className="min-h-[50vh] flex items-center justify-center">
          <div className="text-muted-foreground">{t("detail.notFound")}</div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageContainer>
          <div className="mb-4">
            <Breadcrumb
              items={[
                { label: t("breadcrumb.clients"), href: "/clients" },
                { label: project.clientName, href: `/clients/${project.clientId}` },
                { label: project.name },
              ]}
            />
          </div>
          {formError && !showEditForm && !showDeleteConfirm && !showArchiveConfirm && (
            <div className="mb-4 rounded-[var(--radius-card)] bg-destructive/10 p-4 text-sm text-destructive">
              {formError}
            </div>
          )}
          <div className="mb-6 flex flex-col gap-4 rounded-[var(--radius-card)] border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <h1 className="font-display text-2xl font-bold tracking-tight text-foreground truncate">{project.name}</h1>
                <span className={`inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${getStatusColor(project.status)}`}>
                  {getStatusLabel(project.status)}
                </span>
              </div>
              <Link
                href={`/clients/${project.clientId}`}
                className="mt-1 inline-block text-sm text-muted-foreground hover:text-foreground"
              >
                {project.clientName}
              </Link>
            </div>
          </div>
        <div ref={actionsRef} className="scroll-mt-20" />
        {/* Delete Confirmation Dialog */}
        {showDeleteConfirm && (
          <div className="mb-8 rounded-[var(--radius-card)] bg-card p-6 border border-destructive/30">
            <h2 className="text-xl font-semibold text-destructive mb-4">{t("delete.title")}</h2>
            <p className="text-muted-foreground mb-4">
              {t("delete.body", { name: project.name })}
            </p>
            {formError && (
              <div className="rounded-[var(--radius-card)] bg-destructive/10 p-4 text-sm text-destructive mb-4">
                {formError}
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setFormError("");
                }}
                className="rounded-[var(--radius-card)] border border-border px-4 py-2 text-muted-foreground hover:bg-muted"
                disabled={submitting}
              >
                {t("cancel")}
              </button>
              <button
                onClick={handleDelete}
                disabled={submitting}
                className="rounded-[var(--radius-card)] bg-destructive px-4 py-2 text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
              >
                {submitting ? t("delete.deleting") : t("delete.confirm")}
              </button>
            </div>
          </div>
        )}

        {/* Archive Confirmation Dialog */}
        {showArchiveConfirm && (
          <div className="mb-8 rounded-[var(--radius-card)] bg-card p-6 border border-border">
            <h2 className="text-xl font-semibold text-foreground mb-4">{t("archive.title")}</h2>
            <p className="text-muted-foreground mb-4">
              {t("archive.body", { name: project.name })}
            </p>
            {formError && (
              <div className="rounded-[var(--radius-card)] bg-destructive/10 p-4 text-sm text-destructive mb-4">
                {formError}
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowArchiveConfirm(false);
                  setFormError("");
                }}
                className="rounded-[var(--radius-card)] border border-border px-4 py-2 text-muted-foreground hover:bg-muted"
                disabled={submitting}
              >
                {t("cancel")}
              </button>
              <button
                onClick={handleArchive}
                disabled={submitting}
                className="rounded-[var(--radius-card)] bg-muted px-4 py-2 text-foreground hover:bg-muted/80 disabled:opacity-50"
              >
                {submitting ? t("archive.archiving") : t("archive.confirm")}
              </button>
            </div>
          </div>
        )}

        {/* Edit Form */}
        {showEditForm && (
          <div className="mb-8 mx-auto max-w-2xl rounded-[var(--radius-card)] bg-card border border-border p-5">
            <h2 className="font-display text-lg font-semibold text-foreground mb-4">{t("editForm.title")}</h2>
            <form onSubmit={handleUpdate} className="space-y-4">
              {formError && (
                <div className="rounded-[var(--radius-card)] bg-destructive/10 p-4 text-sm text-destructive">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-muted-foreground">
                    {t("editForm.nameLabel")}
                  </label>
                  <input
                    type="text"
                    id="name"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="mt-1 block w-full rounded-[var(--radius-card)] border border-border px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary"
                    disabled={submitting}
                  />
                </div>

                <div>
                  <label htmlFor="clientName" className="block text-sm font-medium text-muted-foreground">
                    {t("editForm.clientLabel")}
                  </label>
                  <input
                    type="text"
                    id="clientName"
                    value={project.clientName}
                    disabled
                    className="mt-1 block w-full rounded-[var(--radius-card)] border border-border bg-muted px-3 py-2 text-muted-foreground"
                  />
                </div>

                <div>
                  <label htmlFor="status" className="block text-sm font-medium text-muted-foreground">
                    {t("editForm.statusLabel")}
                  </label>
                  <SimpleSelect
                    id="status"
                    value={formData.status}
                    onChange={(v) => setFormData({ ...formData, status: v })}
                    className="mt-1"
                    disabled={submitting}
                    options={[
                      { value: "active", label: t("status.active") },
                      { value: "paused", label: t("status.paused") },
                      { value: "completed", label: t("status.completed") },
                    ]}
                  />
                </div>

                <div>
                  <label htmlFor="startDate" className="block text-sm font-medium text-muted-foreground">
                    {t("editForm.startDateLabel")}
                  </label>
                  <input
                    type="date"
                    id="startDate"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="mt-1 block w-full rounded-[var(--radius-card)] border border-border px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary"
                    disabled={submitting}
                  />
                  {fieldErrors.startDate && <p className="mt-1 text-xs text-destructive">{fieldErrors.startDate}</p>}
                </div>

                <div>
                  <label htmlFor="endDate" className="block text-sm font-medium text-muted-foreground">
                    {t("editForm.endDateLabel")}
                  </label>
                  <input
                    type="date"
                    id="endDate"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="mt-1 block w-full rounded-[var(--radius-card)] border border-border px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary"
                    disabled={submitting}
                  />
                  {fieldErrors.endDate && <p className="mt-1 text-xs text-destructive">{fieldErrors.endDate}</p>}
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="billingRounding" className="block text-sm font-medium text-muted-foreground">
                    {t("editForm.roundingLabel")}
                  </label>
                  <SimpleSelect
                    id="billingRounding"
                    value={formData.billingRounding}
                    onChange={(v) => setFormData({ ...formData, billingRounding: v as "" | RoundingMode })}
                    className="mt-1 sm:max-w-[calc(50%-0.5rem)]"
                    disabled={submitting}
                    options={[
                      {
                        value: "",
                        label: t("editForm.roundingInherit", { value: tRounding(resolveRounding(null, project.clientBillingRounding, profileRounding)) }),
                      },
                      ...ROUNDING_MODES.map((m) => ({ value: m, label: tRounding(m) })),
                    ]}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("editForm.roundingHint")}
                  </p>
                </div>

                <div className="sm:col-span-2">
                  <div className="rounded-[var(--radius-card)] border border-border p-4">
                    <label className="flex items-center gap-2 text-sm font-medium text-foreground">
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
                        className="h-4 w-4 rounded border-border"
                        disabled={submitting}
                      />
                      {t("editForm.fixedMonthlyLabel")}
                    </label>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("editForm.fixedMonthlyHint")}
                    </p>

                    {formData.fixedMonthlyEnabled && (
                      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <div>
                          <label htmlFor="fixedMonthlyFee" className="block text-sm font-medium text-foreground">
                            {t("editForm.monthlyFeeLabel")}
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
                            className={`mt-1 block w-full rounded-[var(--radius-card)] border px-3 py-2 shadow-sm ${
                              fieldErrors.fixedMonthlyFee ? "border-destructive" : "border-border"
                            }`}
                            disabled={submitting}
                          />
                          {fieldErrors.fixedMonthlyFee && <p className="mt-1 text-xs text-destructive">{fieldErrors.fixedMonthlyFee}</p>}
                        </div>

                        <div>
                          <label htmlFor="fixedMonthlyStartDate" className="block text-sm font-medium text-foreground">
                            {t("editForm.validFromLabel")}
                          </label>
                          <input
                            type="date"
                            id="fixedMonthlyStartDate"
                            value={formData.fixedMonthlyStartDate}
                            onChange={(e) => {
                              setFormData({ ...formData, fixedMonthlyStartDate: e.target.value });
                              setFieldErrors({ ...fieldErrors, fixedMonthlyStartDate: undefined });
                            }}
                            className={`mt-1 block w-full rounded-[var(--radius-card)] border px-3 py-2 shadow-sm ${
                              fieldErrors.fixedMonthlyStartDate ? "border-destructive" : "border-border"
                            }`}
                            disabled={submitting}
                          />
                          {fieldErrors.fixedMonthlyStartDate && <p className="mt-1 text-xs text-destructive">{fieldErrors.fixedMonthlyStartDate}</p>}
                        </div>

                        <div>
                          <label htmlFor="fixedMonthlyEndDate" className="block text-sm font-medium text-foreground">
                            {t("editForm.validToLabel")}
                          </label>
                          <input
                            type="date"
                            id="fixedMonthlyEndDate"
                            value={formData.fixedMonthlyEndDate}
                            onChange={(e) => {
                              setFormData({ ...formData, fixedMonthlyEndDate: e.target.value });
                              setFieldErrors({ ...fieldErrors, fixedMonthlyEndDate: undefined });
                            }}
                            className={`mt-1 block w-full rounded-[var(--radius-card)] border px-3 py-2 shadow-sm ${
                              fieldErrors.fixedMonthlyEndDate ? "border-destructive" : "border-border"
                            }`}
                            disabled={submitting}
                          />
                          {fieldErrors.fixedMonthlyEndDate && <p className="mt-1 text-xs text-destructive">{fieldErrors.fixedMonthlyEndDate}</p>}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="notes" className="block text-sm font-medium text-muted-foreground">
                    {t("editForm.notesLabel")}
                  </label>
                  <textarea
                    id="notes"
                    rows={3}
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="mt-1 block w-full rounded-[var(--radius-card)] border border-border px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary"
                    disabled={submitting}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditForm(false);
                    setFormError("");
                    // Reset form to current project data
                    setFormData({
                      name: project.name,
                      status: project.status,
                      startDate: project.startDate || "",
                      endDate: project.endDate || "",
                      fixedMonthlyEnabled: project.fixedMonthlyEnabled ?? false,
                      fixedMonthlyFee: project.fixedMonthlyFee?.toString() || "",
                      fixedMonthlyStartDate: project.fixedMonthlyStartDate || "",
                      fixedMonthlyEndDate: project.fixedMonthlyEndDate || "",
                      billingRounding: (project.billingRounding ?? "") as "" | RoundingMode,
                      notes: project.notes || "",
                    });
                  }}
                  className="rounded-[var(--radius-card)] border border-border px-4 py-2 text-muted-foreground hover:bg-muted"
                  disabled={submitting}
                >
                  {t("cancel")}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-[var(--radius-card)] bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {submitting ? t("editForm.saving") : t("editForm.saveChanges")}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Summary stat tiles */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-[var(--radius-card)] border border-border bg-card p-4">
            <dt className="text-xs font-medium text-muted-foreground">{t("stats.totalHours")}</dt>
            <dd className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-foreground">
              {statsLoading ? "…" : projectStats?.totalHours?.toFixed(1) || "0.0"}
            </dd>
          </div>
          <div className="rounded-[var(--radius-card)] border border-border bg-card p-4">
            <dt className="text-xs font-medium text-muted-foreground">{t("stats.entryCount")}</dt>
            <dd className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-foreground">
              {statsLoading ? "…" : projectStats?.entryCount || 0}
            </dd>
          </div>
          <div className="rounded-[var(--radius-card)] border border-border bg-card p-4">
            <dt className="text-xs font-medium text-muted-foreground">{t("stats.fixedMonthly")}</dt>
            <dd className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-foreground">
              {project.fixedMonthlyEnabled && project.fixedMonthlyFee
                ? project.fixedMonthlyFee.toFixed(0)
                : "—"}
            </dd>
          </div>
          <div className="rounded-[var(--radius-card)] border border-border bg-card p-4">
            <dt className="text-xs font-medium text-muted-foreground">{t("stats.rounding")}</dt>
            <dd className="mt-1.5 text-sm font-semibold text-foreground">
              {tRounding(resolveRounding(project.billingRounding, project.clientBillingRounding, profileRounding))}
            </dd>
          </div>
        </div>

        {/* Project Details Card */}
        <div className="mt-6 rounded-[var(--radius-card)] bg-card border border-border">
          <div className="border-b border-border px-5 py-3.5">
            <h2 className="font-display text-base font-semibold text-foreground">{t("details.title")}</h2>
          </div>
          <div className="px-5 py-4">
            <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
              <div className="flex items-center justify-between gap-4 sm:block">
                <dt className="text-sm text-muted-foreground sm:mb-1">{t("details.client")}</dt>
                <dd className="text-sm text-foreground">
                  <Link href={`/clients/${project.clientId}`} className="hover:text-primary">{project.clientName}</Link>
                </dd>
              </div>

              <div className="flex items-center justify-between gap-4 sm:block">
                <dt className="text-sm text-muted-foreground sm:mb-1">{t("details.startDate")}</dt>
                <dd className="text-sm text-foreground tabular-nums">
                  {project.startDate ? new Date(project.startDate).toLocaleDateString(intlLocale) : "-"}
                </dd>
              </div>

              <div className="flex items-center justify-between gap-4 sm:block">
                <dt className="text-sm text-muted-foreground sm:mb-1">{t("details.endDate")}</dt>
                <dd className="text-sm text-foreground tabular-nums">
                  {project.endDate ? new Date(project.endDate).toLocaleDateString(intlLocale) : "-"}
                </dd>
              </div>

              <div className="flex items-center justify-between gap-4 sm:block">
                <dt className="text-sm text-muted-foreground sm:mb-1">{t("details.fixedValidity")}</dt>
                <dd className="text-sm text-foreground tabular-nums">
                  {(project.fixedMonthlyStartDate || project.fixedMonthlyEndDate)
                    ? t("details.validityRange", {
                        from: project.fixedMonthlyStartDate ? new Date(project.fixedMonthlyStartDate).toLocaleDateString(intlLocale) : "-",
                        to: project.fixedMonthlyEndDate ? new Date(project.fixedMonthlyEndDate).toLocaleDateString(intlLocale) : t("details.noEnd"),
                      })
                    : t("details.unlimited")}
                </dd>
              </div>

              {project.notes && (
                <div className="sm:col-span-2">
                  <dt className="text-sm text-muted-foreground mb-1">{t("details.notes")}</dt>
                  <dd className="text-sm text-foreground whitespace-pre-wrap">{project.notes}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>

        {/* Tasks moved to the global Kanban board */}
        <div className="mt-6 rounded-[var(--radius-card)] bg-card border border-border">
          <div className="border-b border-border px-5 py-3.5">
            <h2 className="font-display text-lg font-semibold text-foreground">{t("tasks.title")}</h2>
          </div>
          <div className="px-6 py-4">
            <p className="text-sm text-muted-foreground">
              {t.rich("tasks.movedNotice", {
                link: (chunks) => (
                  <Link href="/tasks" className="text-primary hover:underline mx-1">
                    {chunks}
                  </Link>
                ),
              })}
            </p>
          </div>
        </div>

        {/* Recent Entries */}
        <div className="mt-6 rounded-[var(--radius-card)] bg-card border border-border">
          <div className="border-b border-border px-5 py-3.5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold text-foreground">{t("entries.title")}</h2>
              <div className="flex gap-3">
                <Link
                  href={`/entries?projectId=${projectId}`}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  {t("entries.viewAll")}
                </Link>
              </div>
            </div>
          </div>
          <div className="px-6 py-4">
            {entriesLoading ? (
              <p className="text-sm text-muted-foreground">{t("entries.loading")}</p>
            ) : recentEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("entries.empty")}</p>
            ) : (
              <ul className="divide-y divide-border">
                {recentEntries.map((entry) => (
                  <li key={entry.id} className="py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">{entry.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(entry.date).toLocaleDateString(intlLocale)}
                      </p>
                    </div>
                    <span className="font-mono text-sm tabular-nums text-foreground">
                      {formatDuration(entry.duration)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Actions — kept at the bottom, away from accidental clicks */}
        <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-border pt-5">
          {project.status !== "archived" ? (
            <>
              <button
                onClick={() => setShowEditForm(!showEditForm)}
                className="rounded-[var(--radius)] border border-border px-3.5 py-2 text-sm text-foreground hover:bg-muted"
              >
                {t("actions.edit")}
              </button>
              <button
                onClick={handleDuplicate}
                disabled={duplicating}
                className="rounded-[var(--radius)] border border-border px-3.5 py-2 text-sm text-foreground hover:bg-muted disabled:opacity-50"
              >
                {duplicating ? t("actions.duplicating") : t("actions.duplicate")}
              </button>
              <button
                onClick={() => setShowArchiveConfirm(true)}
                className="rounded-[var(--radius)] border border-border px-3.5 py-2 text-sm text-muted-foreground hover:bg-muted"
              >
                {t("actions.archive")}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="rounded-[var(--radius)] px-3.5 py-2 text-sm text-destructive hover:bg-destructive/10"
              >
                {t("actions.delete")}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleDuplicate}
                disabled={duplicating}
                className="rounded-[var(--radius)] border border-border px-3.5 py-2 text-sm text-foreground hover:bg-muted disabled:opacity-50"
              >
                {duplicating ? t("actions.duplicating") : t("actions.duplicate")}
              </button>
              <button
                onClick={() => handleUnarchive()}
                className="rounded-[var(--radius)] bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                disabled={submitting}
              >
                {submitting ? t("actions.restoring") : t("actions.restoreProject")}
              </button>
            </>
          )}
        </div>
      </PageContainer>
    </AppLayout>
  );
}
