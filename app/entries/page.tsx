"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppLayout } from "@/components/app-layout";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Clock, Timer } from "lucide-react";
import { showSuccessToast, showErrorToast } from "@/lib/toast";
import { validateRequired, validateDate, validatePastDate, validateNumber } from "@/lib/validation";
import { pickDefaultHourlyRate, type ClientRate } from "@/lib/schemas/rates";
import { useKeyboardShortcut } from "@/hooks/use-keyboard-shortcut";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { HourglassSVG } from "@/components/ui/thematic-elements";

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

interface TaskOption {
  id: string;
  name: string;
}

interface TimeEntry {
  id: string;
  projectId: string;
  projectName: string;
  clientId: string;
  clientName: string;
  description: string;
  startTime: string | null;
  endTime: string | null;
  duration: number;
  date: string;
  tags: string[];
  notes: string | null;
  isBillable: boolean;
  createdAt: string;
  pausedAt: string | null;
  totalPausedTime: number | null;
  taskId: string | null;
  taskName: string | null;
  billingKind?: "hourly" | "item";
  rate?: number | null;
  rateLabel?: string | null;
  quantity?: number | null;
}

interface GroupedProjects {
  [clientId: string]: {
    clientName: string;
    projects: Project[];
  };
}

export default function EntriesPage() {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [clients, setClients] = useState<Client[]>([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  const [formData, setFormData] = useState({
    projectId: "",
    taskId: "",
    date: new Date().toISOString().split("T")[0],
    duration: "",
    description: "",
    notes: "",
    isBillable: true,
    billingKind: "hourly" as "hourly" | "item",
    rateId: "",
    quantity: "",
  });
  const [formTasks, setFormTasks] = useState<TaskOption[]>([]);
  const [formRates, setFormRates] = useState<ClientRate[]>([]);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<TimeEntry | null>(null);

  // Field validation errors
  const [fieldErrors, setFieldErrors] = useState<{
    projectId?: string;
    date?: string;
    duration?: string;
    description?: string;
  }>({});
  const [deleting, setDeleting] = useState(false);
  const [filters, setFilters] = useState({
    clientId: "",
    projectId: "",
    startDate: "",
    endDate: "",
  });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [bulkEditData, setBulkEditData] = useState({
    projectId: "",
    date: "",
    isBillable: undefined as boolean | undefined,
  });
  const [bulkEditSubmitting, setBulkEditSubmitting] = useState(false);
  const [bulkEditError, setBulkEditError] = useState("");
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [bulkDeleteSubmitting, setBulkDeleteSubmitting] = useState(false);

  // Handle keyboard shortcut for quick entry
  const handleQuickEntryShortcut = () => {
    // Toggle the form
    setShowForm((prev) => !prev);

    // If opening the form, focus on the first input after a short delay
    if (!showForm) {
      setTimeout(() => {
        const projectSelect = document.getElementById("projectId") as HTMLSelectElement;
        if (projectSelect) {
          projectSelect.focus();
        }
      }, 100);
    }
  };

  // Keyboard shortcut: 'n' key toggles quick entry form
  useKeyboardShortcut({
    key: "n",
    callback: handleQuickEntryShortcut,
  });

  // Keyboard shortcut: Escape key closes form
  useKeyboardShortcut({
    key: "Escape",
    callback: () => {
      if (showForm) {
        handleCancelEdit();
      }
    },
    disabled: !showForm,
  });

  useEffect(() => {
    // Fetch clients when component mounts
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
    // Fetch projects when component mounts
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
    // Fetch entries when component mounts or filters change
    const fetchEntries = async () => {
      try {
        setEntriesLoading(true);

        // Build query parameters for filtering
        const params = new URLSearchParams();
        if (filters.clientId) params.append("clientId", filters.clientId);
        if (filters.projectId) params.append("projectId", filters.projectId);
        if (filters.startDate) params.append("startDate", filters.startDate);
        if (filters.endDate) params.append("endDate", filters.endDate);

        const response = await fetch(`/api/entries?${params.toString()}`);
        const data = await response.json();

        if (data.success) {
          setEntries(data.entries || []);
        }
      } catch (error) {
        console.error("Error fetching entries:", error);
      } finally {
        setEntriesLoading(false);
      }
    };

    fetchEntries();
  }, [filters]);

  // Fetch tasks when project changes in form
  useEffect(() => {
    if (!formData.projectId) {
      setFormTasks([]);
      return;
    }
    const fetchTasks = async () => {
      try {
        const response = await fetch(`/api/projects/${formData.projectId}/tasks`);
        const data = await response.json();
        if (data.success) {
          setFormTasks(
            (data.tasks || [])
              .filter((t: { status: string }) => t.status !== "done")
              .map((t: { id: string; name: string }) => ({ id: t.id, name: t.name }))
          );
        }
      } catch (error) {
        console.error("Error fetching tasks:", error);
      }
    };
    fetchTasks();
  }, [formData.projectId]);

  // Fetch the selected project's client rates (hourly + items) for the pickers.
  useEffect(() => {
    const clientId = projects.find((p) => p.id === formData.projectId)?.clientId;
    if (!clientId) {
      setFormRates([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/clients/${clientId}/rates`);
        const data = await res.json();
        if (cancelled || !data.success) return;
        setFormRates(data.rates as ClientRate[]);
      } catch (error) {
        console.error("Error fetching rates for entry:", error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [formData.projectId, projects]);

  // Preselect a rate/item once rates load (or kind changes). When editing, match
  // the entry's snapshotted label first; otherwise pick the default/first of the kind.
  useEffect(() => {
    if (formRates.length === 0) return;
    setFormData((p) => {
      const pool = formRates.filter((r) => r.kind === p.billingKind);
      if (pool.some((r) => r.id === p.rateId)) return p; // keep a still-valid selection
      if (editingEntry?.rateLabel) {
        const match = pool.find((r) => r.name === editingEntry.rateLabel);
        if (match) return { ...p, rateId: match.id };
      }
      const pick = p.billingKind === "hourly" ? pickDefaultHourlyRate(formRates)?.id : pool[0]?.id;
      return { ...p, rateId: pick ?? "" };
    });
  }, [formRates, formData.billingKind, editingEntry]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setFieldErrors({});

    // Validate form fields
    const errors: typeof fieldErrors = {};

    // Validate project
    const projectValidation = validateRequired(formData.projectId, "פרויקט");
    if (!projectValidation.isValid) {
      errors.projectId = projectValidation.error;
    }

    // Validate date
    const dateValidation = validateDate(formData.date, true);
    if (!dateValidation.isValid) {
      errors.date = dateValidation.error;
    }

    // Validate duration (hours) or quantity + item selection (item)
    if (formData.billingKind === "item") {
      const q = parseFloat(formData.quantity);
      if (!formData.quantity || isNaN(q) || q <= 0) {
        errors.duration = "נא להזין כמות תקינה";
      } else if (!formData.rateId) {
        errors.duration = "נא לבחור פריט";
      }
    } else {
      const durationValidation = validateNumber(formData.duration, true, 1);
      if (!durationValidation.isValid) {
        errors.duration = durationValidation.error;
      }
    }

    // Validate description
    const descValidation = validateRequired(formData.description, "תיאור");
    if (!descValidation.isValid) {
      errors.description = descValidation.error;
    }

    // If there are errors, display them and don't submit
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setSubmitting(true);

    try {
      const isEditing = editingEntry !== null;
      const url = isEditing ? `/api/entries/${editingEntry.id}` : "/api/entries";
      const method = isEditing ? "PUT" : "POST";

      const chosen = formRates.find((r) => r.id === formData.rateId);
      const isItem = formData.billingKind === "item";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectId: formData.projectId,
          taskId: formData.taskId || null,
          date: formData.date,
          billingKind: formData.billingKind,
          duration: isItem ? 0 : parseInt(formData.duration, 10),
          quantity: isItem ? parseFloat(formData.quantity) || 0 : null,
          rate: chosen?.rate ?? null,
          rateLabel: chosen?.name ?? null,
          description: formData.description,
          notes: formData.notes || undefined,
          isBillable: formData.isBillable,
          tags: [],
        }),
      });

      const data = await response.json();

      if (data.success) {
        if (isEditing) {
          // Update existing entry in the list
          setEntries(entries.map((e) => (e.id === data.entry.id ? data.entry : e)));
        } else {
          // Add the new entry to the list
          setEntries([data.entry, ...entries]);
        }
        // Reset form and close
        setFormData({
          projectId: "",
          taskId: "",
          date: new Date().toISOString().split("T")[0],
          duration: "",
          description: "",
          notes: "",
          isBillable: true,
          billingKind: "hourly",
          rateId: "",
          quantity: "",
        });
        setShowForm(false);
        setEditingEntry(null);
        setFieldErrors({});
      } else {
        setFormError(data.message || isEditing ? "שגיאה בעדכון הרשומה" : "שגיאה ביצירת הרשומה");
      }
    } catch (error) {
      console.error("Error saving entry:", error);
      setFormError(editingEntry ? "שגיאה בעדכון הרשומה" : "שגיאה ביצירת הרשומה");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (entry: TimeEntry) => {
    setEditingEntry(entry);
    setFormData({
      projectId: entry.projectId,
      taskId: entry.taskId || "",
      date: entry.date.includes("T") ? entry.date.split("T")[0] : entry.date,
      duration: entry.duration.toString(),
      description: entry.description,
      notes: entry.notes || "",
      isBillable: entry.isBillable,
      billingKind: entry.billingKind ?? "hourly",
      rateId: "", // resolved by the preselect effect (matches rateLabel)
      quantity: entry.quantity?.toString() ?? "",
    });
    setShowForm(true);
  };

  const handleCancelEdit = () => {
    setEditingEntry(null);
    setFormData({
      projectId: "",
      taskId: "",
      date: new Date().toISOString().split("T")[0],
      duration: "",
      description: "",
      notes: "",
      isBillable: true,
      billingKind: "hourly",
      rateId: "",
      quantity: "",
    });
    setShowForm(false);
  };

  const handleDeleteClick = (entry: TimeEntry) => {
    setEntryToDelete(entry);
  };

  const handleDuplicate = async (entry: TimeEntry) => {
    try {
      const response = await fetch("/api/entries", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectId: entry.projectId,
          date: entry.date,
          duration: entry.duration,
          description: entry.description,
          notes: entry.notes,
          isBillable: entry.isBillable,
          tags: entry.tags,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Add the duplicated entry to the list
        setEntries([data.entry, ...entries]);
        showSuccessToast("הרשומה שוכפלה בהצלחה");
      } else {
        showErrorToast(data.message || "שגיאה בשכפול הרשומה");
      }
    } catch (error) {
      console.error("Error duplicating entry:", error);
      showErrorToast("שגיאה בשכפול הרשומה");
    }
  };

  const handleDeleteConfirm = async () => {
    if (!entryToDelete) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/entries/${entryToDelete.id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (data.success) {
        // Remove entry from list
        setEntries(entries.filter((e) => e.id !== entryToDelete.id));
        setEntryToDelete(null);
        showSuccessToast("הרשומה נמחקה בהצלחה");
      } else {
        showErrorToast(data.message || "שגיאה במחיקת הרשומה");
      }
    } catch (error) {
      console.error("Error deleting entry:", error);
      showErrorToast("שגיאה במחיקת הרשומה");
    } finally {
      setDeleting(false);
    }
  };

  const cancelDelete = () => {
    setEntryToDelete(null);
  };

  const handleSelectEntry = (entryId: string) => {
    setSelectedEntries((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(entryId)) {
        newSet.delete(entryId);
      } else {
        newSet.add(entryId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedEntries.size === entries.length) {
      setSelectedEntries(new Set());
    } else {
      setSelectedEntries(new Set(entries.map((e) => e.id)));
    }
  };

  const handleBulkEdit = () => {
    if (selectedEntries.size === 0) return;
    setBulkEditData({
      projectId: "",
      date: "",
      isBillable: undefined,
    });
    setBulkEditError("");
    setShowBulkEdit(true);
  };

  const handleBulkEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBulkEditError("");
    setBulkEditSubmitting(true);

    try {
      const response = await fetch("/api/entries/bulk", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          entryIds: Array.from(selectedEntries),
          projectId: bulkEditData.projectId || undefined,
          date: bulkEditData.date || undefined,
          isBillable: bulkEditData.isBillable,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Refresh entries to show updated values
        const params = new URLSearchParams();
        if (filters.clientId) params.append("clientId", filters.clientId);
        if (filters.projectId) params.append("projectId", filters.projectId);
        if (filters.startDate) params.append("startDate", filters.startDate);
        if (filters.endDate) params.append("endDate", filters.endDate);

        const entriesResponse = await fetch(`/api/entries?${params.toString()}`);
        const entriesData = await entriesResponse.json();

        if (entriesData.success) {
          setEntries(entriesData.entries || []);
        }

        // Close modal and clear selection
        setShowBulkEdit(false);
        setSelectedEntries(new Set());
        setBulkEditData({
          projectId: "",
          date: "",
          isBillable: undefined,
        });
      } else {
        setBulkEditError(data.message || "שגיאה בעדכון הרשומות");
      }
    } catch (error) {
      console.error("Error bulk updating entries:", error);
      setBulkEditError("שגיאה בעדכון הרשומות");
    } finally {
      setBulkEditSubmitting(false);
    }
  };

  const handleBulkDelete = async () => {
    setBulkDeleteSubmitting(true);

    try {
      const response = await fetch("/api/entries/bulk", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          entryIds: Array.from(selectedEntries),
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Remove deleted entries from list
        setEntries(entries.filter((e) => !selectedEntries.has(e.id)));

        // Close modal and clear selection
        setShowBulkDeleteConfirm(false);
        setSelectedEntries(new Set());

        showSuccessToast(data.message || "הרשומות נמחקו בהצלחה");
      } else {
        showErrorToast(data.message || "שגיאה במחיקת הרשומות");
      }
    } catch (error) {
      console.error("Error bulk deleting entries:", error);
      showErrorToast("שגיאה במחיקת הרשומות");
    } finally {
      setBulkDeleteSubmitting(false);
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({ clientId: "", projectId: "", startDate: "", endDate: "" });
  };

  const getFilteredProjects = () => {
    if (!filters.clientId) return projects;
    return projects.filter((p) => p.clientId === filters.clientId);
  };

  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}:${mins.toString().padStart(2, "0")}`;
  };

  const isEntryRunning = (entry: TimeEntry): boolean => {
    return entry.startTime !== null && entry.endTime === null;
  };

  // Group projects by client
  const groupedProjects = projects.reduce<GroupedProjects>((acc, project) => {
    if (!acc[project.clientId]) {
      acc[project.clientId] = {
        clientName: project.clientName,
        projects: [],
      };
    }
    acc[project.clientId].projects.push(project);
    return acc;
  }, {});

  return (
    <AppLayout>
      <PageContainer>
        <PageHeader title="רישום זמן">
          <kbd className="hidden sm:inline-block px-2 py-1 text-xs font-semibold text-muted-foreground bg-muted border border-border rounded">N</kbd>
          <button
            onClick={() => setShowForm(!showForm)}
            className="rounded-[var(--radius-card)] bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
          >
            {showForm ? "ביטול" : "+ רשום זמן"}
          </button>
        </PageHeader>

        {/* Filters Section */}
        <div className="mb-6 rounded-[var(--radius-card)] border-secondary/30 bg-secondary/5 p-4 shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-foreground">סינון</h2>
              {(filters.clientId || filters.projectId || filters.startDate || filters.endDate) && (
                <span className="bg-secondary text-secondary-foreground rounded-full text-xs px-2 py-0.5 font-semibold">
                  {[filters.clientId, filters.projectId, filters.startDate, filters.endDate].filter(Boolean).length}
                </span>
              )}
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="min-h-[44px] min-w-[44px] px-4 py-2 text-sm font-medium text-primary hover:bg-primary-light rounded-[var(--radius-card)] transition-colors"
            >
              {showFilters ? "הסתר סינון" : "הצג סינון"}
            </button>
          </div>

          {showFilters && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label htmlFor="filterClient" className="block text-sm font-medium text-foreground mb-1">
                  לקוח
                </label>
                <select
                  id="filterClient"
                  value={filters.clientId}
                  onChange={(e) => {
                    handleFilterChange("clientId", e.target.value);
                    handleFilterChange("projectId", ""); // Reset project when client changes
                  }}
                  className="block w-full rounded-md border border-border/50 px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-primary"
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

              <div>
                <label htmlFor="filterProject" className="block text-sm font-medium text-foreground mb-1">
                  פרויקט
                </label>
                <select
                  id="filterProject"
                  value={filters.projectId}
                  onChange={(e) => handleFilterChange("projectId", e.target.value)}
                  className="block w-full rounded-md border border-border/50 px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-primary"
                  disabled={projectsLoading}
                >
                  <option value="">כל הפרויקטים</option>
                  {getFilteredProjects().map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="filterStartDate" className="block text-sm font-medium text-foreground mb-1">
                  תאריך התחלה
                </label>
                <input
                  type="date"
                  id="filterStartDate"
                  value={filters.startDate}
                  onChange={(e) => handleFilterChange("startDate", e.target.value)}
                  className="block w-full rounded-md border border-border/50 px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-primary"
                />
              </div>

              <div>
                <label htmlFor="filterEndDate" className="block text-sm font-medium text-foreground mb-1">
                  תאריך סיום
                </label>
                <input
                  type="date"
                  id="filterEndDate"
                  value={filters.endDate}
                  onChange={(e) => handleFilterChange("endDate", e.target.value)}
                  className="block w-full rounded-md border border-border/50 px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-primary"
                />
              </div>

              <div className="sm:col-span-2 lg:col-span-4 flex justify-end">
                <button
                  onClick={clearFilters}
                  className="rounded-[var(--radius-card)] border border-border px-4 py-2 text-sm text-foreground hover:bg-muted"
                >
                  נקה סינון
                </button>
              </div>
            </div>
          )}

          {/* Active filters display */}
          {(filters.clientId || filters.projectId || filters.startDate || filters.endDate) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {filters.clientId && (
                <span className="inline-flex items-center rounded-full bg-primary-light px-3 py-1 text-sm text-primary">
                  לקוח: {clients.find((c) => c.id === filters.clientId)?.name}
                  <button
                    onClick={() => handleFilterChange("clientId", "")}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center me-1 text-primary hover:text-primary/80 rounded-full transition-colors"
                    aria-label="הסתר סינון לקוח"
                  >
                    ×
                  </button>
                </span>
              )}
              {filters.projectId && (
                <span className="inline-flex items-center rounded-full bg-primary-light px-3 py-1 text-sm text-primary">
                  פרויקט: {projects.find((p) => p.id === filters.projectId)?.name}
                  <button
                    onClick={() => handleFilterChange("projectId", "")}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center me-1 text-primary hover:text-primary/80 rounded-full transition-colors"
                    aria-label="הסתר סינון פרויקט"
                  >
                    ×
                  </button>
                </span>
              )}
              {filters.startDate && (
                <span className="inline-flex items-center rounded-full bg-primary-light px-3 py-1 text-sm text-primary">
                  מ: {new Date(filters.startDate).toLocaleDateString("he-IL")}
                  <button
                    onClick={() => handleFilterChange("startDate", "")}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center me-1 text-primary hover:text-primary/80 rounded-full transition-colors"
                    aria-label="הסתר סינון תאריך התחלה"
                  >
                    ×
                  </button>
                </span>
              )}
              {filters.endDate && (
                <span className="inline-flex items-center rounded-full bg-primary-light px-3 py-1 text-sm text-primary">
                  עד: {new Date(filters.endDate).toLocaleDateString("he-IL")}
                  <button
                    onClick={() => handleFilterChange("endDate", "")}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center me-1 text-primary hover:text-primary/80 rounded-full transition-colors"
                    aria-label="הסתר סינון תאריך סיום"
                  >
                    ×
                  </button>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Add/Edit Entry Form */}
        {showForm && (
          <div className="mb-8 rounded-[var(--radius-card)] bg-surface p-6 shadow motion-safe:animate-scale-in">
            <h2 className="text-xl font-semibold text-foreground mb-4">
              {editingEntry ? "ערוך רישום זמן" : "רשום זמן חדש"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              {formError && (
                <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="projectId" className="block text-sm font-medium text-foreground">
                    פרויקט *
                  </label>
                  <select
                    id="projectId"
                    required
                    value={formData.projectId}
                    onChange={(e) => setFormData({ ...formData, projectId: e.target.value, taskId: "" })}
                    className={`mt-1 block w-full rounded-md px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary ${fieldErrors.projectId ? "border border-destructive" : "border border-border/50"}`}
                    disabled={submitting || projectsLoading}
                  >
                    <option value="">בחר פרויקט</option>
                    {Object.entries(groupedProjects).map(([clientId, { clientName, projects: clientProjects }]) => (
                      <optgroup key={clientId} label={clientName}>
                        {clientProjects.map((project) => (
                          <option key={project.id} value={project.id}>
                            {project.name}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  {fieldErrors.projectId && (
                    <p className="mt-1 text-xs text-destructive">{fieldErrors.projectId}</p>
                  )}
                  {projects.length === 0 && !projectsLoading && (
                    <Link
                      href="/projects?create=true"
                      className="mt-1 inline-block text-xs text-primary hover:text-primary/90"
                    >
                      + צור פרויקט חדש
                    </Link>
                  )}
                </div>

                {formData.projectId && formTasks.length > 0 && (
                  <div>
                    <label htmlFor="taskId" className="block text-sm font-medium text-foreground">
                      משימה
                    </label>
                    <select
                      id="taskId"
                      value={formData.taskId}
                      onChange={(e) => setFormData({ ...formData, taskId: e.target.value })}
                      className="mt-1 block w-full rounded-md border border-border/50 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary"
                      disabled={submitting}
                    >
                      <option value="">ללא משימה</option>
                      {formTasks.map((task) => (
                        <option key={task.id} value={task.id}>
                          {task.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label htmlFor="date" className="block text-sm font-medium text-foreground">
                    תאריך *
                  </label>
                  <input
                    type="date"
                    id="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className={`mt-1 block w-full rounded-md px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary ${fieldErrors.date ? "border border-destructive" : "border border-border/50"}`}
                    disabled={submitting}
                  />
                  {fieldErrors.date && (
                    <p className="mt-1 text-xs text-destructive">{fieldErrors.date}</p>
                  )}
                </div>

                {/* Billing type toggle: hours vs item */}
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-foreground mb-1">סוג</label>
                  <div className="inline-flex rounded-md border border-border/50 p-0.5">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, billingKind: "hourly", rateId: "" })}
                      className={`min-h-[44px] px-4 py-1.5 text-sm rounded ${formData.billingKind === "hourly" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                      disabled={submitting}
                    >
                      שעות
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, billingKind: "item", rateId: "" })}
                      className={`min-h-[44px] px-4 py-1.5 text-sm rounded ${formData.billingKind === "item" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                      disabled={submitting}
                    >
                      פריט
                    </button>
                  </div>
                </div>

                {formData.billingKind === "hourly" ? (
                  <>
                    <div>
                      <label htmlFor="duration" className="block text-sm font-medium text-foreground">
                        משך זמן (דקות) *
                      </label>
                      <input
                        type="number"
                        id="duration"
                        min="1"
                        step="1"
                        value={formData.duration}
                        onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                        className={`mt-1 block w-full rounded-md px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary ${fieldErrors.duration ? "border border-destructive" : "border border-border/50"}`}
                        disabled={submitting}
                        placeholder="לדוגמה: 60"
                      />
                      {fieldErrors.duration && (
                        <p className="mt-1 text-xs text-destructive">{fieldErrors.duration}</p>
                      )}
                      <p className="mt-1 text-xs text-muted-foreground">הזן את משך הזמן בדקות</p>
                    </div>

                    {formRates.some((r) => r.kind === "hourly") && (
                      <div>
                        <label htmlFor="entryRate" className="block text-sm font-medium text-foreground">
                          תעריף
                        </label>
                        <select
                          id="entryRate"
                          value={formData.rateId}
                          onChange={(e) => setFormData({ ...formData, rateId: e.target.value })}
                          className="mt-1 block w-full rounded-md border border-border/50 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary"
                          disabled={submitting}
                        >
                          {formRates
                            .filter((r) => r.kind === "hourly")
                            .map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.name} — {r.rate}/שעה
                              </option>
                            ))}
                        </select>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div>
                      <label htmlFor="entryItem" className="block text-sm font-medium text-foreground">
                        פריט *
                      </label>
                      {formRates.some((r) => r.kind === "item") ? (
                        <select
                          id="entryItem"
                          value={formData.rateId}
                          onChange={(e) => setFormData({ ...formData, rateId: e.target.value })}
                          className={`mt-1 block w-full rounded-md px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary ${fieldErrors.duration ? "border border-destructive" : "border border-border/50"}`}
                          disabled={submitting}
                        >
                          <option value="">בחר פריט</option>
                          {formRates
                            .filter((r) => r.kind === "item")
                            .map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.name} — {r.rate}/יח׳
                              </option>
                            ))}
                        </select>
                      ) : (
                        <p className="mt-1 text-xs text-muted-foreground">
                          ללקוח זה אין פריטים מוגדרים. ניתן להוסיף פריטים בעמוד הלקוח.
                        </p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="quantity" className="block text-sm font-medium text-foreground">
                        כמות *
                      </label>
                      <input
                        type="number"
                        id="quantity"
                        min="0"
                        step="1"
                        value={formData.quantity}
                        onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                        className={`mt-1 block w-full rounded-md px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary ${fieldErrors.duration ? "border border-destructive" : "border border-border/50"}`}
                        disabled={submitting}
                        placeholder="לדוגמה: 3"
                      />
                      {fieldErrors.duration && (
                        <p className="mt-1 text-xs text-destructive">{fieldErrors.duration}</p>
                      )}
                    </div>
                  </>
                )}

                <div className="flex items-center">
                  <label htmlFor="isBillable" className="flex items-center cursor-pointer min-h-[44px]">
                    <input
                      type="checkbox"
                      id="isBillable"
                      checked={formData.isBillable}
                      onChange={(e) => setFormData({ ...formData, isBillable: e.target.checked })}
                      className="h-5 w-5 rounded border-border text-primary focus:ring-primary"
                      disabled={submitting}
                    />
                    <span className="me-2 text-sm font-medium text-foreground">ניתן לחיוב</span>
                  </label>
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="description" className="block text-sm font-medium text-foreground">
                    תיאור *
                  </label>
                  <input
                    type="text"
                    id="description"
                    required
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className={`mt-1 block w-full rounded-md px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary ${fieldErrors.description ? "border border-destructive" : "border border-border/50"}`}
                    disabled={submitting}
                    placeholder="מה עשית?"
                  />
                  {fieldErrors.description && (
                    <p className="mt-1 text-xs text-destructive">{fieldErrors.description}</p>
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
                    className="mt-1 block w-full rounded-md border border-border/50 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary"
                    disabled={submitting}
                    placeholder="הערות נוספות (אופציונלי)"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="rounded-[var(--radius-card)] border border-border px-4 py-2 text-foreground hover:bg-muted"
                  disabled={submitting}
                >
                  ביטול
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-[var(--radius-card)] bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {submitting ? "שומר..." : editingEntry ? "עדכן" : "שמור"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Entries List */}
        <div className="rounded-[var(--radius-card)] bg-card shadow">
          {entriesLoading ? (
            <div className="p-8 text-center text-muted-foreground">טוען רישומי זמן...</div>
          ) : entries.length === 0 ? (
            <div className="relative">
              <EmptyState
                icon={Clock}
                message="אין רישומי זמן עדיין"
                description="התחל לעקוב אחר זמני העבודה שלך על ידי רישום זמן ראשון"
                actionLabel="רשום זמן ראשון"
                onAction={() => setShowForm(true)}
              />
              <div className="absolute top-8 start-1/2 -translate-x-1/2 opacity-10 pointer-events-none">
                <HourglassSVG className="w-32 h-32 text-primary" />
              </div>
            </div>
          ) : (
            <>
              {/* Bulk Action Bar */}
              {selectedEntries.size > 0 && (
                <div className="fixed bottom-0 inset-x-0 md:sticky md:bottom-4 bg-primary text-primary-foreground rounded-lg shadow-lg motion-safe:animate-fade-up p-4 z-30 mb-4">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <span className="text-sm font-medium">
                      נבחרו {selectedEntries.size} רשומות
                    </span>
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={handleBulkEdit}
                        className="rounded-[var(--radius-card)] bg-accent text-accent-foreground px-4 py-2 text-sm hover:bg-accent/90"
                      >
                        ערוך נבחרים
                      </button>
                      <button
                        onClick={() => setShowBulkDeleteConfirm(true)}
                        className="rounded-[var(--radius-card)] bg-destructive px-4 py-2 text-sm text-white hover:bg-destructive/90"
                      >
                        מחק נבחרים
                      </button>
                      <button
                        onClick={() => setSelectedEntries(new Set())}
                        className="rounded-[var(--radius-card)] border border-primary-foreground/20 px-4 py-2 text-sm hover:bg-primary-foreground/10"
                      >
                        בטל בחירה
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full divide-y divide-border">
                  <thead className="bg-surface">
                    <tr>
                      <th className="px-6 py-3 text-start text-xs font-semibold uppercase tracking-wider text-muted-foreground w-12">
                        <input
                          type="checkbox"
                          checked={selectedEntries.size === entries.length && entries.length > 0}
                          onChange={handleSelectAll}
                          className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                          aria-label="בחר הכל"
                        />
                      </th>
                      <th className="px-6 py-3 text-start text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        תאריך
                      </th>
                      <th className="px-6 py-3 text-start text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        תיאור
                      </th>
                      <th className="px-6 py-3 text-start text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        לקוח
                      </th>
                      <th className="px-6 py-3 text-start text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        פרויקט
                      </th>
                      <th className="px-6 py-3 text-start text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        משך זמן
                      </th>
                      <th className="px-6 py-3 text-start text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        פעולות
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-card">
                    {entries.map((entry) => (
                      <tr key={entry.id} className={`hover:bg-surface even:bg-surface/50 ${selectedEntries.has(entry.id) ? "bg-primary-light" : ""}`}>
                        <td className="whitespace-nowrap px-6 py-4">
                          <input
                            type="checkbox"
                            checked={selectedEntries.has(entry.id)}
                            onChange={() => handleSelectEntry(entry.id)}
                            className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                            aria-label="בחר רשומה"
                          />
                        </td>
                        <td className="whitespace-nowrap px-6 py-4">
                          <div className="text-sm text-foreground">
                            {new Date(entry.date).toLocaleDateString("he-IL")}
                          </div>
                        </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {isEntryRunning(entry) && (
                            <div className="flex items-center gap-1.5 inline-flex items-center rounded-full bg-success/10 px-2 py-1 text-xs font-semibold text-success">
                              <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
                              </span>
                              <Timer className="h-3 w-3 me-1" />
                              פעיל
                            </div>
                          )}
                          <div className="text-sm text-foreground max-w-xs truncate">
                            {entry.description}
                          </div>
                        </div>
                        {entry.notes && (
                          <div className="text-xs text-muted-foreground truncate max-w-xs ms-6">{entry.notes}</div>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <Link href={`/clients/${entry.clientId}`} className="text-sm text-foreground hover:text-primary hover:underline">
                          {entry.clientName}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <Link href={`/projects/${entry.projectId}`} className="text-sm text-foreground hover:text-primary hover:underline">
                          {entry.projectName}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="text-sm font-mono font-semibold text-foreground">
                          {entry.billingKind === "item"
                            ? `${entry.quantity ?? 0} יח׳`
                            : formatDuration(entry.duration)}
                        </div>
                        {entry.rateLabel && (
                          <div className="text-xs text-muted-foreground">{entry.rateLabel}</div>
                        )}
                        {entry.isBillable && (
                          <span className="inline-flex rounded-full bg-accent/20 text-accent px-2 py-0.5 text-xs font-semibold leading-5 me-2">
                            לחיוב
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm">
                        <button
                          onClick={() => handleDuplicate(entry)}
                          className="text-secondary hover:text-secondary/90 font-medium ms-2"
                        >
                          שכפל
                        </button>
                        <button
                          onClick={() => handleEdit(entry)}
                          className="text-primary hover:text-primary/90 font-medium ms-2"
                        >
                          ערוך
                        </button>
                        <button
                          onClick={() => handleDeleteClick(entry)}
                          className="text-destructive hover:text-destructive/90 font-medium ms-2"
                        >
                          מחק
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
              {entries.map((entry) => (
                <div key={entry.id} className={`bg-card rounded-[var(--radius-card)] shadow p-4 border-s-4 border-primary ${selectedEntries.has(entry.id) ? "ring-2 ring-primary" : ""}`}>
                  <div className="flex items-start gap-3">
                    {/* Large touch-friendly checkbox */}
                    <div className="pt-1">
                      <input
                        type="checkbox"
                        checked={selectedEntries.has(entry.id)}
                        onChange={() => handleSelectEntry(entry.id)}
                        className="h-6 w-6 rounded border-border text-primary focus:ring-primary cursor-pointer"
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Header with date and status */}
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-muted-foreground">
                          {new Date(entry.date).toLocaleDateString("he-IL")}
                        </span>
                        {isEntryRunning(entry) && (
                          <div className="flex items-center gap-1.5 inline-flex items-center rounded-full bg-success/10 px-2 py-1 text-xs font-semibold text-success">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
                            </span>
                            <Timer className="h-3 w-3 me-1" />
                            פעיל
                          </div>
                        )}
                      </div>

                      {/* Project name prominent */}
                      <div className="flex items-center gap-2 text-sm font-semibold text-foreground mb-2">
                        <Link href={`/projects/${entry.projectId}`} className="hover:text-primary hover:underline">{entry.projectName}</Link>
                        <span className="text-muted-foreground">•</span>
                        <Link href={`/clients/${entry.clientId}`} className="text-muted-foreground hover:text-primary hover:underline">{entry.clientName}</Link>
                      </div>

                      {/* Description */}
                      <div className="text-sm text-foreground mb-1">
                        {entry.description}
                      </div>
                      {entry.notes && (
                        <div className="text-xs text-muted-foreground mb-2">{entry.notes}</div>
                      )}

                      {/* Duration and billable status */}
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-lg font-mono font-bold text-primary">
                          {entry.billingKind === "item"
                            ? `${entry.quantity ?? 0} יח׳`
                            : formatDuration(entry.duration)}
                        </span>
                        {entry.rateLabel && (
                          <span className="text-xs text-muted-foreground">{entry.rateLabel}</span>
                        )}
                        {entry.isBillable && (
                          <span className="inline-flex rounded-full bg-accent/20 text-accent px-2 py-0.5 text-xs font-semibold leading-5">
                            לחיוב
                          </span>
                        )}
                      </div>

                      {/* Action buttons - large touch targets */}
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          onClick={() => handleDuplicate(entry)}
                          className="min-h-[44px] flex items-center justify-center rounded-[var(--radius-card)] border border-secondary bg-secondary-light px-3 py-2 text-sm font-medium text-secondary hover:bg-secondary-light/80 active:bg-secondary-light/60 transition-colors"
                        >
                          שכפל
                        </button>
                        <button
                          onClick={() => handleEdit(entry)}
                          className="min-h-[44px] flex items-center justify-center rounded-[var(--radius-card)] bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 active:bg-primary/80 transition-colors"
                        >
                          ערוך
                        </button>
                        <button
                          onClick={() => handleDeleteClick(entry)}
                          className="min-h-[44px] flex items-center justify-center rounded-[var(--radius-card)] border border-destructive bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/20 active:bg-destructive/30 transition-colors"
                        >
                          מחק
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
        </div>
      </PageContainer>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!entryToDelete} onOpenChange={(open) => { if (!open) cancelDelete(); }}>
        <DialogContent showCloseButton={false} className="border-destructive/20">
          <DialogHeader>
            <DialogTitle>מחק רישום זמן</DialogTitle>
            <DialogDescription>
              האם למחוק את רישום הזמן &quot;{entryToDelete?.description}&quot;? פעולה זו אינה הפיכה.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <button
              onClick={cancelDelete}
              disabled={deleting}
              className="rounded-[var(--radius-card)] border border-border px-4 py-2 text-foreground hover:bg-muted disabled:opacity-50"
            >
              ביטול
            </button>
            <button
              onClick={handleDeleteConfirm}
              disabled={deleting}
              className="rounded-[var(--radius-card)] bg-destructive px-4 py-2 text-white hover:bg-destructive/90 disabled:opacity-50"
            >
              {deleting ? "מוחק..." : "מחק"}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Edit Modal */}
      <Dialog open={showBulkEdit} onOpenChange={(open) => { if (!open) setShowBulkEdit(false); }}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>ערוך {selectedEntries.size} רשומות</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleBulkEditSubmit} className="space-y-4">
            {bulkEditError && (
              <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
                {bulkEditError}
              </div>
            )}

            <div>
              <label htmlFor="bulkProjectId" className="block text-sm font-medium text-foreground mb-1">
                פרויקט (אופציונלי)
              </label>
              <select
                id="bulkProjectId"
                value={bulkEditData.projectId}
                onChange={(e) => setBulkEditData({ ...bulkEditData, projectId: e.target.value })}
                className="block w-full rounded-md border border-border/50 px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-primary"
                disabled={bulkEditSubmitting}
              >
                <option value="">ללא שינוי</option>
                {Object.entries(groupedProjects).map(([clientId, { clientName, projects: clientProjects }]) => (
                  <optgroup key={clientId} label={clientName}>
                    {clientProjects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="bulkDate" className="block text-sm font-medium text-foreground mb-1">
                תאריך (אופציונלי)
              </label>
              <input
                type="date"
                id="bulkDate"
                value={bulkEditData.date}
                onChange={(e) => setBulkEditData({ ...bulkEditData, date: e.target.value })}
                className="block w-full rounded-md border border-border/50 px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-primary"
                disabled={bulkEditSubmitting}
              />
            </div>

            <div>
              <label htmlFor="bulkIsBillable" className="block text-sm font-medium text-foreground mb-1">
                ניתן לחיוב (אופציונלי)
              </label>
              <select
                id="bulkIsBillable"
                value={bulkEditData.isBillable === undefined ? "" : bulkEditData.isBillable ? "true" : "false"}
                onChange={(e) => {
                  const value = e.target.value;
                  setBulkEditData({
                    ...bulkEditData,
                    isBillable: value === "" ? undefined : value === "true",
                  });
                }}
                className="block w-full rounded-md border border-border/50 px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-primary"
                disabled={bulkEditSubmitting}
              >
                <option value="">ללא שינוי</option>
                <option value="true">כן</option>
                <option value="false">לא</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <button
                type="button"
                onClick={() => setShowBulkEdit(false)}
                className="rounded-[var(--radius-card)] border border-border px-4 py-2 text-foreground hover:bg-muted"
                disabled={bulkEditSubmitting}
              >
                ביטול
              </button>
              <button
                type="submit"
                disabled={bulkEditSubmitting}
                className="rounded-[var(--radius-card)] bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {bulkEditSubmitting ? "מעדכן..." : "עדכן רשומות"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Confirmation Modal */}
      <Dialog open={showBulkDeleteConfirm} onOpenChange={(open) => { if (!open) setShowBulkDeleteConfirm(false); }}>
        <DialogContent showCloseButton={false} className="border-destructive/20">
          <DialogHeader>
            <DialogTitle>מחק {selectedEntries.size} רשומות</DialogTitle>
            <DialogDescription>
              האם למחוק את {selectedEntries.size} הרשומות הנבחרות? פעולה זו אינה הפיכה.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowBulkDeleteConfirm(false)}
              disabled={bulkDeleteSubmitting}
              className="rounded-[var(--radius-card)] border border-border px-4 py-2 text-foreground hover:bg-muted disabled:opacity-50"
            >
              ביטול
            </button>
            <button
              onClick={handleBulkDelete}
              disabled={bulkDeleteSubmitting}
              className="rounded-[var(--radius-card)] bg-destructive px-4 py-2 text-white hover:bg-destructive/90 disabled:opacity-50"
            >
              {bulkDeleteSubmitting ? "מוחק..." : "מחק"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
