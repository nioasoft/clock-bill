"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { AppLayout } from "@/components/app-layout";
import { PageContainer } from "@/components/page-container";
import { Breadcrumb } from "@/components/breadcrumb";
import { validateRequired, validateDateRange } from "@/lib/validation";

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
  totalHours?: number;
  totalAmount?: number;
}

export default function ProjectDetailsPage() {
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

  // Tasks state
  interface Task {
    id: string;
    projectId: string;
    name: string;
    description: string | null;
    status: string;
    createdAt: string;
    updatedAt: string;
  }
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [newTaskName, setNewTaskName] = useState("");
  const [creatingTask, setCreatingTask] = useState(false);
  const [formData, setFormData] = useState({
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
    name?: string;
    startDate?: string;
    endDate?: string;
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

  // Fetch tasks
  useEffect(() => {
    const fetchTasks = async () => {
      if (!projectId) return;
      try {
        setTasksLoading(true);
        const response = await fetch(`/api/projects/${projectId}/tasks`);
        const data = await response.json();
        if (data.success) {
          setTasks(data.tasks || []);
        }
      } catch (error) {
        console.error("Error fetching tasks:", error);
      } finally {
        setTasksLoading(false);
      }
    };
    fetchTasks();
  }, [projectId]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskName.trim()) return;
    setCreatingTask(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newTaskName.trim() }),
      });
      const data = await response.json();
      if (data.success) {
        setTasks([data.task, ...tasks]);
        setNewTaskName("");
      }
    } catch (error) {
      console.error("Error creating task:", error);
    } finally {
      setCreatingTask(false);
    }
  };

  const handleToggleTaskStatus = async (task: Task) => {
    const nextStatus = task.status === "todo" ? "in_progress" : task.status === "in_progress" ? "done" : "todo";
    try {
      const response = await fetch(`/api/projects/${projectId}/tasks/${task.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await response.json();
      if (data.success) {
        setTasks(tasks.map((t) => (t.id === task.id ? data.task : t)));
      }
    } catch (error) {
      console.error("Error updating task:", error);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/tasks/${taskId}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (data.success) {
        setTasks(tasks.filter((t) => t.id !== taskId));
      }
    } catch (error) {
      console.error("Error deleting task:", error);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setFieldErrors({});

    // Validate form fields
    const errors: typeof fieldErrors = {};

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
        setFormError(data.message || "שגיאה בעדכון הפרויקט");
      }
    } catch (error) {
      console.error("Error updating project:", error);
      setFormError("שגיאה בעדכון הפרויקט");
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
        setFormError(data.message || "שגיאה במחיקת הפרויקט");
        setShowDeleteConfirm(false);
      }
    } catch (error) {
      console.error("Error deleting project:", error);
      setFormError("שגיאה במחיקת הפרויקט");
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
        setFormError(data.message || "שגיאה בארכוב הפרויקט");
        setShowArchiveConfirm(false);
      }
    } catch (error) {
      console.error("Error archiving project:", error);
      setFormError("שגיאה בארכוב הפרויקט");
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
        setFormError(data.message || "שגיאה בשחזור הפרויקט");
      }
    } catch (error) {
      console.error("Error unarchiving project:", error);
      setFormError("שגיאה בשחזור הפרויקט");
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
        setFormError(data.message || "שגיאה בשכפול הפרויקט");
      }
    } catch (error) {
      console.error("Error duplicating project:", error);
      setFormError("שגיאה בשכפול הפרויקט");
    } finally {
      setDuplicating(false);
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
        return "bg-accent text-foreground";
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
          <div className="text-muted-foreground">טוען פרויקט...</div>
        </div>
      </AppLayout>
    );
  }

  if (!project) {
    return (
      <AppLayout>
        <div className="min-h-[50vh] flex items-center justify-center">
          <div className="text-muted-foreground">הפרויקט לא נמצא</div>
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
                { label: "פרויקטים", href: "/projects" },
                { label: project.name },
              ]}
            />
          </div>
          {formError && !showEditForm && !showDeleteConfirm && !showArchiveConfirm && (
            <div className="mb-4 rounded-[14px] bg-destructive/10 p-4 text-sm text-destructive">
              {formError}
            </div>
          )}
          <div className="flex justify-between items-center mb-6">
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">{project.name}</h1>
            <div className="flex gap-2">
              {project.status !== "archived" && (
                <>
                  <button
                    onClick={() => setShowEditForm(!showEditForm)}
                    className="rounded-[14px] border border-border px-4 py-2 text-muted-foreground hover:bg-muted"
                  >
                    ערוך
                  </button>
                  <button
                    onClick={handleDuplicate}
                    disabled={duplicating}
                    className="rounded-[14px] border border-secondary bg-secondary-light px-4 py-2 text-secondary hover:bg-secondary-light disabled:opacity-50"
                  >
                    {duplicating ? "מעתיק..." : "שכפל"}
                  </button>
                  <button
                    onClick={() => setShowArchiveConfirm(true)}
                    className="rounded-[14px] bg-foreground/70 px-4 py-2 text-white hover:bg-foreground/80"
                  >
                    ארכב
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="rounded-[14px] bg-destructive px-4 py-2 text-white hover:bg-destructive/90"
                  >
                    מחק
                  </button>
                </>
              )}
              {project.status === "archived" && (
                <>
                  <button
                    onClick={handleDuplicate}
                    disabled={duplicating}
                    className="rounded-[14px] border border-secondary bg-secondary-light px-4 py-2 text-secondary hover:bg-secondary-light disabled:opacity-50"
                  >
                    {duplicating ? "מעתיק..." : "שכפל"}
                  </button>
                  <button
                    onClick={() => handleUnarchive()}
                    className="rounded-[14px] bg-success px-4 py-2 text-white hover:bg-success/90"
                    disabled={submitting}
                  >
                    {submitting ? "משחזר..." : "שחזר פרויקט"}
                  </button>
                </>
              )}
            </div>
          </div>
        {/* Delete Confirmation Dialog */}
        {showDeleteConfirm && (
          <div className="mb-8 rounded-[14px] bg-card p-6 shadow border-2 border-destructive/30">
            <h2 className="text-xl font-semibold text-destructive mb-4">מחיקת פרויקט</h2>
            <p className="text-muted-foreground mb-4">
              האם למחוק את הפרויקט &quot;{project.name}&quot;? פעולה זו אינה הפיכה.
            </p>
            {formError && (
              <div className="rounded-[14px] bg-destructive/10 p-4 text-sm text-destructive mb-4">
                {formError}
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setFormError("");
                }}
                className="rounded-[14px] border border-border px-4 py-2 text-muted-foreground hover:bg-muted"
                disabled={submitting}
              >
                ביטול
              </button>
              <button
                onClick={handleDelete}
                disabled={submitting}
                className="rounded-[14px] bg-destructive px-4 py-2 text-white hover:bg-destructive/90 disabled:opacity-50"
              >
                {submitting ? "מוחק..." : "מחק פרויקט"}
              </button>
            </div>
          </div>
        )}

        {/* Archive Confirmation Dialog */}
        {showArchiveConfirm && (
          <div className="mb-8 rounded-[14px] bg-card p-6 shadow border-2 border-border/50">
            <h2 className="text-xl font-semibold text-foreground mb-4">ארכוב פרויקט</h2>
            <p className="text-muted-foreground mb-4">
              האם לארכב את הפרויקט &quot;{project.name}&quot;? הפרויקט יוסתר מרשימת הפרויקטים אך ניתן יהיה לשחזר אותו.
            </p>
            {formError && (
              <div className="rounded-[14px] bg-destructive/10 p-4 text-sm text-destructive mb-4">
                {formError}
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowArchiveConfirm(false);
                  setFormError("");
                }}
                className="rounded-[14px] border border-border px-4 py-2 text-muted-foreground hover:bg-muted"
                disabled={submitting}
              >
                ביטול
              </button>
              <button
                onClick={handleArchive}
                disabled={submitting}
                className="rounded-[14px] bg-foreground/70 px-4 py-2 text-white hover:bg-foreground/80 disabled:opacity-50"
              >
                {submitting ? "מארכב..." : "ארכב פרויקט"}
              </button>
            </div>
          </div>
        )}

        {/* Edit Form */}
        {showEditForm && (
          <div className="mb-8 rounded-[14px] bg-card border border-border/50 p-6 shadow-sm">
            <h2 className="font-display text-lg font-semibold text-foreground mb-4">ערוך פרויקט</h2>
            <form onSubmit={handleUpdate} className="space-y-4">
              {formError && (
                <div className="rounded-[14px] bg-destructive/10 p-4 text-sm text-destructive">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-muted-foreground">
                    שם הפרויקט *
                  </label>
                  <input
                    type="text"
                    id="name"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="mt-1 block w-full rounded-[14px] border border-border px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary"
                    disabled={submitting}
                  />
                </div>

                <div>
                  <label htmlFor="clientName" className="block text-sm font-medium text-muted-foreground">
                    לקוח
                  </label>
                  <input
                    type="text"
                    id="clientName"
                    value={project.clientName}
                    disabled
                    className="mt-1 block w-full rounded-[14px] border border-border bg-muted px-3 py-2 text-muted-foreground"
                  />
                </div>

                <div>
                  <label htmlFor="status" className="block text-sm font-medium text-muted-foreground">
                    סטטוס
                  </label>
                  <select
                    id="status"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="mt-1 block w-full rounded-[14px] border border-border px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary"
                    disabled={submitting}
                  >
                    <option value="active">פעיל</option>
                    <option value="paused">מושהה</option>
                    <option value="completed">הושלם</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="startDate" className="block text-sm font-medium text-muted-foreground">
                    תאריך התחלה
                  </label>
                  <input
                    type="date"
                    id="startDate"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="mt-1 block w-full rounded-[14px] border border-border px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary"
                    disabled={submitting}
                  />
                </div>

                <div>
                  <label htmlFor="endDate" className="block text-sm font-medium text-muted-foreground">
                    תאריך סיום
                  </label>
                  <input
                    type="date"
                    id="endDate"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="mt-1 block w-full rounded-[14px] border border-border px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary"
                    disabled={submitting}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="notes" className="block text-sm font-medium text-muted-foreground">
                    הערות
                  </label>
                  <textarea
                    id="notes"
                    rows={3}
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="mt-1 block w-full rounded-[14px] border border-border px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary"
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
                      notes: project.notes || "",
                    });
                  }}
                  className="rounded-[14px] border border-border px-4 py-2 text-muted-foreground hover:bg-muted"
                  disabled={submitting}
                >
                  ביטול
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-[14px] bg-primary px-4 py-2 text-white hover:bg-primary/90 disabled:opacity-50"
                >
                  {submitting ? "שומר..." : "שמור שינויים"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Project Details Card */}
        <div className="rounded-[14px] bg-card border border-border/50 shadow-sm">
          <div className="border-b border-border px-6 py-4">
            <h2 className="font-display text-lg font-semibold text-foreground">פרטי פרויקט</h2>
          </div>
          <div className="px-6 py-4">
            <dl className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-muted-foreground">שם הפרויקט</dt>
                <dd className="mt-1 text-sm text-foreground">{project.name}</dd>
              </div>

              <div>
                <dt className="text-sm font-medium text-muted-foreground">לקוח</dt>
                <dd className="mt-1 text-sm text-foreground">{project.clientName}</dd>
              </div>

              <div>
                <dt className="text-sm font-medium text-muted-foreground">סטטוס</dt>
                <dd className="mt-1">
                  <span className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${getStatusColor(project.status)}`}>
                    {getStatusLabel(project.status)}
                  </span>
                </dd>
              </div>

              <div>
                <dt className="text-sm font-medium text-muted-foreground">תאריך התחלה</dt>
                <dd className="mt-1 text-sm text-foreground">
                  {project.startDate ? new Date(project.startDate).toLocaleDateString("he-IL") : "-"}
                </dd>
              </div>

              <div>
                <dt className="text-sm font-medium text-muted-foreground">תאריך סיום</dt>
                <dd className="mt-1 text-sm text-foreground">
                  {project.endDate ? new Date(project.endDate).toLocaleDateString("he-IL") : "-"}
                </dd>
              </div>

              {project.notes && (
                <div className="sm:col-span-2">
                  <dt className="text-sm font-medium text-muted-foreground">הערות</dt>
                  <dd className="mt-1 text-sm text-foreground whitespace-pre-wrap">{project.notes}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>

        {/* Project Totals Card */}
        <div className="mt-6 rounded-[14px] bg-card border border-border/50 shadow-sm">
          <div className="border-b border-border px-6 py-4">
            <h2 className="font-display text-lg font-semibold text-foreground">סיכום פרויקט</h2>
          </div>
          <div className="px-6 py-4">
            <dl className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div className="rounded-[14px] bg-primary-light p-4 border-t-2 border-t-primary">
                <dt className="text-sm font-medium text-primary">סה״כ שעות</dt>
                <dd className="mt-2 font-mono text-3xl font-bold tabular-nums text-primary">
                  {statsLoading ? "..." : projectStats?.totalHours?.toFixed(1) || "0.0"}
                </dd>
                <dt className="mt-2 text-xs text-primary">שעות רשומות בפרויקט</dt>
              </div>

              <div className="rounded-[14px] bg-success/10 p-4 border-t-2 border-t-success">
                <dt className="text-sm font-medium text-success">מספר רשומות</dt>
                <dd className="mt-2 font-mono text-3xl font-bold tabular-nums text-success">
                  {statsLoading ? "..." : projectStats?.entryCount || 0}
                </dd>
                <dt className="mt-2 text-xs text-success">כמות רשומות זמן בפרויקט</dt>
              </div>
            </dl>
          </div>
        </div>

        {/* Tasks */}
        <div className="mt-6 rounded-[14px] bg-card border border-border/50 shadow-sm">
          <div className="border-b border-border px-6 py-4">
            <h2 className="font-display text-lg font-semibold text-foreground">משימות</h2>
          </div>
          <div className="px-6 py-4">
            {/* Create Task Form */}
            {project.status !== "archived" && (
              <form onSubmit={handleCreateTask} className="mb-4 flex gap-2">
                <input
                  type="text"
                  value={newTaskName}
                  onChange={(e) => setNewTaskName(e.target.value)}
                  placeholder="שם משימה חדשה..."
                  className="flex-1 rounded-[14px] border border-border px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-primary"
                  disabled={creatingTask}
                />
                <button
                  type="submit"
                  disabled={creatingTask || !newTaskName.trim()}
                  className="rounded-[14px] bg-primary px-4 py-2 text-sm text-white hover:bg-primary/90 disabled:opacity-50"
                >
                  {creatingTask ? "מוסיף..." : "הוסף"}
                </button>
              </form>
            )}

            {/* Task List */}
            {tasksLoading ? (
              <p className="text-sm text-muted-foreground">טוען משימות...</p>
            ) : tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">אין משימות עדיין</p>
            ) : (
              <ul className="divide-y divide-border">
                {tasks.map((task) => (
                  <li key={task.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <button
                        onClick={() => handleToggleTaskStatus(task)}
                        title={task.status === "todo" ? "לביצוע" : task.status === "in_progress" ? "בתהליך" : "הושלם"}
                        className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                          task.status === "done"
                            ? "border-success bg-success text-white"
                            : task.status === "in_progress"
                            ? "border-primary bg-primary/10"
                            : "border-border bg-transparent"
                        }`}
                      >
                        {task.status === "done" && (
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                        {task.status === "in_progress" && (
                          <div className="w-2 h-2 rounded-full bg-primary" />
                        )}
                      </button>
                      <span className={`text-sm truncate ${task.status === "done" ? "line-through text-muted-foreground" : "text-foreground"}`}>
                        {task.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-xs rounded-full px-2 py-0.5 ${
                        task.status === "done"
                          ? "bg-success/10 text-success"
                          : task.status === "in_progress"
                          ? "bg-primary-light text-primary"
                          : "bg-muted text-muted-foreground"
                      }`}>
                        {task.status === "todo" ? "לביצוע" : task.status === "in_progress" ? "בתהליך" : "הושלם"}
                      </span>
                      {project.status !== "archived" && (
                        <button
                          onClick={() => handleDeleteTask(task.id)}
                          className="text-muted-foreground hover:text-destructive transition-colors"
                          title="מחק משימה"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Recent Entries */}
        <div className="mt-6 rounded-[14px] bg-card border border-border/50 shadow-sm">
          <div className="border-b border-border px-6 py-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold text-foreground">רשומות אחרונות</h2>
              <div className="flex gap-3">
                <Link
                  href={`/entries?projectId=${projectId}`}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  צפה בכל הרשומות
                </Link>
              </div>
            </div>
          </div>
          <div className="px-6 py-4">
            {entriesLoading ? (
              <p className="text-sm text-muted-foreground">טוען רשומות...</p>
            ) : recentEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground">אין רשומות זמן עדיין לפרויקט זה</p>
            ) : (
              <ul className="divide-y divide-border">
                {recentEntries.map((entry) => (
                  <li key={entry.id} className="py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">{entry.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(entry.date).toLocaleDateString("he-IL")}
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
      </PageContainer>
    </AppLayout>
  );
}
