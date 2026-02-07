"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { Clock, Timer } from "lucide-react";
import { showSuccessToast, showErrorToast } from "@/lib/toast";
import { validateRequired, validateDate, validatePastDate, validateNumber } from "@/lib/validation";
import { useKeyboardShortcut } from "@/hooks/use-keyboard-shortcut";

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
}

interface GroupedProjects {
  [clientId: string]: {
    clientName: string;
    projects: Project[];
  };
}

export default function EntriesPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
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
    date: new Date().toISOString().split("T")[0],
    duration: "",
    description: "",
    notes: "",
    isBillable: true,
  });
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

  useEffect(() => {
    // Fetch entries when user is loaded or filters change
    const fetchEntries = async () => {
      if (!user) return;

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
  }, [user, filters]);

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

    // Validate duration
    const durationValidation = validateNumber(formData.duration, true, 1);
    if (!durationValidation.isValid) {
      errors.duration = durationValidation.error;
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

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectId: formData.projectId,
          date: formData.date,
          duration: parseInt(formData.duration, 10),
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
          date: new Date().toISOString().split("T")[0],
          duration: "",
          description: "",
          notes: "",
          isBillable: true,
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
      date: entry.date,
      duration: entry.duration.toString(),
      description: entry.description,
      notes: entry.notes || "",
      isBillable: entry.isBillable,
    });
    setShowForm(true);
  };

  const handleCancelEdit = () => {
    setEditingEntry(null);
    setFormData({
      projectId: "",
      date: new Date().toISOString().split("T")[0],
      duration: "",
      description: "",
      notes: "",
      isBillable: true,
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

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="text-gray-600">טוען...</div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-gray-600 hover:text-gray-900">
              ← חזור לדשבורד
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">רישום זמן</h1>
          </div>
          <div className="flex items-center gap-3">
            <kbd className="hidden sm:inline-block px-2 py-1 text-xs font-semibold text-gray-600 bg-gray-100 border border-gray-300 rounded">N</kbd>
            <button
              onClick={() => setShowForm(!showForm)}
              className="rounded-lg bg-orange-600 px-4 py-2 text-white hover:bg-orange-700"
            >
              {showForm ? "ביטול" : "+ רשום זמן"}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Filters Section */}
        <div className="mb-6 rounded-lg bg-white p-4 shadow">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">סינון</h2>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="min-h-[44px] min-w-[44px] px-4 py-2 text-sm font-medium text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
            >
              {showFilters ? "הסתר סינון" : "הצג סינון"}
            </button>
          </div>

          {showFilters && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label htmlFor="filterClient" className="block text-sm font-medium text-gray-700 mb-1">
                  לקוח
                </label>
                <select
                  id="filterClient"
                  value={filters.clientId}
                  onChange={(e) => {
                    handleFilterChange("clientId", e.target.value);
                    handleFilterChange("projectId", ""); // Reset project when client changes
                  }}
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-orange-500 focus:outline-none focus:ring-orange-500"
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
                <label htmlFor="filterProject" className="block text-sm font-medium text-gray-700 mb-1">
                  פרויקט
                </label>
                <select
                  id="filterProject"
                  value={filters.projectId}
                  onChange={(e) => handleFilterChange("projectId", e.target.value)}
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-orange-500 focus:outline-none focus:ring-orange-500"
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
                <label htmlFor="filterStartDate" className="block text-sm font-medium text-gray-700 mb-1">
                  תאריך התחלה
                </label>
                <input
                  type="date"
                  id="filterStartDate"
                  value={filters.startDate}
                  onChange={(e) => handleFilterChange("startDate", e.target.value)}
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-orange-500 focus:outline-none focus:ring-orange-500"
                />
              </div>

              <div>
                <label htmlFor="filterEndDate" className="block text-sm font-medium text-gray-700 mb-1">
                  תאריך סיום
                </label>
                <input
                  type="date"
                  id="filterEndDate"
                  value={filters.endDate}
                  onChange={(e) => handleFilterChange("endDate", e.target.value)}
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-orange-500 focus:outline-none focus:ring-orange-500"
                />
              </div>

              <div className="sm:col-span-2 lg:col-span-4 flex justify-end">
                <button
                  onClick={clearFilters}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
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
                <span className="inline-flex items-center rounded-full bg-orange-100 px-3 py-1 text-sm text-orange-800">
                  לקוח: {clients.find((c) => c.id === filters.clientId)?.name}
                  <button
                    onClick={() => handleFilterChange("clientId", "")}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center me-1 text-orange-600 hover:text-orange-700 rounded-full transition-colors"
                    aria-label="הסתר סינון לקוח"
                  >
                    ×
                  </button>
                </span>
              )}
              {filters.projectId && (
                <span className="inline-flex items-center rounded-full bg-orange-100 px-3 py-1 text-sm text-orange-800">
                  פרויקט: {projects.find((p) => p.id === filters.projectId)?.name}
                  <button
                    onClick={() => handleFilterChange("projectId", "")}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center me-1 text-orange-600 hover:text-orange-700 rounded-full transition-colors"
                    aria-label="הסתר סינון פרויקט"
                  >
                    ×
                  </button>
                </span>
              )}
              {filters.startDate && (
                <span className="inline-flex items-center rounded-full bg-orange-100 px-3 py-1 text-sm text-orange-800">
                  מ: {new Date(filters.startDate).toLocaleDateString("he-IL")}
                  <button
                    onClick={() => handleFilterChange("startDate", "")}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center me-1 text-orange-600 hover:text-orange-700 rounded-full transition-colors"
                    aria-label="הסתר סינון תאריך התחלה"
                  >
                    ×
                  </button>
                </span>
              )}
              {filters.endDate && (
                <span className="inline-flex items-center rounded-full bg-orange-100 px-3 py-1 text-sm text-orange-800">
                  עד: {new Date(filters.endDate).toLocaleDateString("he-IL")}
                  <button
                    onClick={() => handleFilterChange("endDate", "")}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center me-1 text-orange-600 hover:text-orange-700 rounded-full transition-colors"
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
          <div className="mb-8 rounded-lg bg-white p-6 shadow">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              {editingEntry ? "ערוך רישום זמן" : "רשום זמן חדש"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              {formError && (
                <div className="rounded-md bg-red-50 p-4 text-sm text-red-800">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="projectId" className="block text-sm font-medium text-gray-700">
                    פרויקט *
                  </label>
                  <select
                    id="projectId"
                    required
                    value={formData.projectId}
                    onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
                    className={`mt-1 block w-full rounded-md border px-3 py-2 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-orange-500 ${fieldErrors.projectId ? "border-red-500" : "border-gray-300"}`}
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
                    <p className="mt-1 text-xs text-red-600">{fieldErrors.projectId}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="date" className="block text-sm font-medium text-gray-700">
                    תאריך *
                  </label>
                  <input
                    type="date"
                    id="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className={`mt-1 block w-full rounded-md border px-3 py-2 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-orange-500 ${fieldErrors.date ? "border-red-500" : "border-gray-300"}`}
                    disabled={submitting}
                  />
                  {fieldErrors.date && (
                    <p className="mt-1 text-xs text-red-600">{fieldErrors.date}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="duration" className="block text-sm font-medium text-gray-700">
                    משך זמן (דקות) *
                  </label>
                  <input
                    type="number"
                    id="duration"
                    required
                    min="1"
                    step="1"
                    value={formData.duration}
                    onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                    className={`mt-1 block w-full rounded-md border px-3 py-2 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-orange-500 ${fieldErrors.duration ? "border-red-500" : "border-gray-300"}`}
                    disabled={submitting}
                    placeholder="לדוגמה: 60"
                  />
                  {fieldErrors.duration && (
                    <p className="mt-1 text-xs text-red-600">{fieldErrors.duration}</p>
                  )}
                  <p className="mt-1 text-xs text-gray-500">הזן את משך הזמן בדקות</p>
                </div>

                <div className="flex items-center">
                  <label htmlFor="isBillable" className="flex items-center cursor-pointer min-h-[44px]">
                    <input
                      type="checkbox"
                      id="isBillable"
                      checked={formData.isBillable}
                      onChange={(e) => setFormData({ ...formData, isBillable: e.target.checked })}
                      className="h-5 w-5 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                      disabled={submitting}
                    />
                    <span className="me-2 text-sm font-medium text-gray-700">ניתן לחיוב</span>
                  </label>
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                    תיאור *
                  </label>
                  <input
                    type="text"
                    id="description"
                    required
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className={`mt-1 block w-full rounded-md border px-3 py-2 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-orange-500 ${fieldErrors.description ? "border-red-500" : "border-gray-300"}`}
                    disabled={submitting}
                    placeholder="מה עשית?"
                  />
                  {fieldErrors.description && (
                    <p className="mt-1 text-xs text-red-600">{fieldErrors.description}</p>
                  )}
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
                    הערות
                  </label>
                  <textarea
                    id="notes"
                    rows={3}
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-orange-500"
                    disabled={submitting}
                    placeholder="הערות נוספות (אופציונלי)"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
                  disabled={submitting}
                >
                  ביטול
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-orange-600 px-4 py-2 text-white hover:bg-orange-700 disabled:opacity-50"
                >
                  {submitting ? "שומר..." : editingEntry ? "עדכן" : "שמור"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Entries List */}
        <div className="rounded-lg bg-white shadow">
          {entriesLoading ? (
            <div className="p-8 text-center text-gray-600">טוען רישומי זמן...</div>
          ) : entries.length === 0 ? (
            <EmptyState
              icon={Clock}
              message="אין רישומי זמן עדיין"
              description="התחל לעקוב אחר זמני העבודה שלך על ידי רישום זמן ראשון"
              actionLabel="רשום זמן ראשון"
              onAction={() => setShowForm(true)}
            />
          ) : (
            <>
              {/* Bulk Action Bar */}
              {selectedEntries.size > 0 && (
                <div className="mb-4 rounded-lg bg-orange-50 p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium text-orange-900">
                      נבחרו {selectedEntries.size} רשומות
                    </span>
                    <button
                      onClick={handleBulkEdit}
                      className="rounded-lg bg-orange-600 px-4 py-2 text-sm text-white hover:bg-orange-700"
                    >
                      ערוך נבחרים
                    </button>
                    <button
                      onClick={() => setShowBulkDeleteConfirm(true)}
                      className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700"
                    >
                      מחק נבחרים
                    </button>
                    <button
                      onClick={() => setSelectedEntries(new Set())}
                      className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      בטל בחירה
                    </button>
                  </div>
                </div>
              )}

              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-start text-xs font-medium uppercase tracking-wider text-gray-500 w-12">
                        <input
                          type="checkbox"
                          checked={selectedEntries.size === entries.length && entries.length > 0}
                          onChange={handleSelectAll}
                          className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                        />
                      </th>
                      <th className="px-6 py-3 text-start text-xs font-medium uppercase tracking-wider text-gray-500">
                        תאריך
                      </th>
                      <th className="px-6 py-3 text-start text-xs font-medium uppercase tracking-wider text-gray-500">
                        תיאור
                      </th>
                      <th className="px-6 py-3 text-start text-xs font-medium uppercase tracking-wider text-gray-500">
                        לקוח
                      </th>
                      <th className="px-6 py-3 text-start text-xs font-medium uppercase tracking-wider text-gray-500">
                        פרויקט
                      </th>
                      <th className="px-6 py-3 text-start text-xs font-medium uppercase tracking-wider text-gray-500">
                        משך זמן
                      </th>
                      <th className="px-6 py-3 text-start text-xs font-medium uppercase tracking-wider text-gray-500">
                        פעולות
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {entries.map((entry) => (
                      <tr key={entry.id} className={`hover:bg-gray-50 ${selectedEntries.has(entry.id) ? "bg-orange-50" : ""}`}>
                        <td className="whitespace-nowrap px-6 py-4">
                          <input
                            type="checkbox"
                            checked={selectedEntries.has(entry.id)}
                            onChange={() => handleSelectEntry(entry.id)}
                            className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                          />
                        </td>
                        <td className="whitespace-nowrap px-6 py-4">
                          <div className="text-sm text-gray-900">
                            {new Date(entry.date).toLocaleDateString("he-IL")}
                          </div>
                        </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {isEntryRunning(entry) && (
                            <div className="flex items-center gap-1.5 inline-flex items-center rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-800">
                              <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                              </span>
                              <Timer className="h-3 w-3 me-1" />
                              פעיל
                            </div>
                          )}
                          <div className="text-sm text-gray-900 max-w-xs truncate">
                            {entry.description}
                          </div>
                        </div>
                        {entry.notes && (
                          <div className="text-xs text-gray-500 truncate max-w-xs ms-6">{entry.notes}</div>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="text-sm text-gray-900">{entry.clientName}</div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="text-sm text-gray-900">{entry.projectName}</div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="text-sm text-gray-900">{formatDuration(entry.duration)}</div>
                        {entry.isBillable && (
                          <span className="inline-flex rounded-full bg-green-100 px-2 text-xs font-semibold leading-5 text-green-800 me-2">
                            לחיוב
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm">
                        <button
                          onClick={() => handleDuplicate(entry)}
                          className="text-blue-600 hover:text-blue-900 font-medium ms-2"
                        >
                          שכפל
                        </button>
                        <button
                          onClick={() => handleEdit(entry)}
                          className="text-orange-600 hover:text-orange-900 font-medium ms-2"
                        >
                          ערוך
                        </button>
                        <button
                          onClick={() => handleDeleteClick(entry)}
                          className="text-red-600 hover:text-red-900 font-medium ms-2"
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
                <div key={entry.id} className={`bg-white rounded-lg shadow p-4 ${selectedEntries.has(entry.id) ? "ring-2 ring-orange-500" : ""}`}>
                  <div className="flex items-start gap-3">
                    {/* Large touch-friendly checkbox */}
                    <div className="pt-1">
                      <input
                        type="checkbox"
                        checked={selectedEntries.has(entry.id)}
                        onChange={() => handleSelectEntry(entry.id)}
                        className="h-6 w-6 rounded border-gray-300 text-orange-600 focus:ring-orange-500 cursor-pointer"
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Header with date and status */}
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-900">
                          {new Date(entry.date).toLocaleDateString("he-IL")}
                        </span>
                        {isEntryRunning(entry) && (
                          <div className="flex items-center gap-1.5 inline-flex items-center rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-800">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                            </span>
                            <Timer className="h-3 w-3 me-1" />
                            פעיל
                          </div>
                        )}
                      </div>

                      {/* Description */}
                      <div className="text-sm text-gray-900 mb-1">
                        {entry.description}
                      </div>
                      {entry.notes && (
                        <div className="text-xs text-gray-500 mb-2">{entry.notes}</div>
                      )}

                      {/* Client and Project */}
                      <div className="flex items-center gap-2 text-xs text-gray-600 mb-2">
                        <span>{entry.clientName}</span>
                        <span>•</span>
                        <span>{entry.projectName}</span>
                      </div>

                      {/* Duration and billable status */}
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-sm font-medium text-gray-900">
                          {formatDuration(entry.duration)}
                        </span>
                        {entry.isBillable && (
                          <span className="inline-flex rounded-full bg-green-100 px-2 py-1 text-xs font-semibold leading-5 text-green-800">
                            לחיוב
                          </span>
                        )}
                      </div>

                      {/* Action buttons - large touch targets */}
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          onClick={() => handleDuplicate(entry)}
                          className="min-h-[44px] flex items-center justify-center rounded-lg border border-blue-600 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-100 active:bg-blue-200 transition-colors"
                        >
                          שכפל
                        </button>
                        <button
                          onClick={() => handleEdit(entry)}
                          className="min-h-[44px] flex items-center justify-center rounded-lg bg-orange-600 px-3 py-2 text-sm font-medium text-white hover:bg-orange-700 active:bg-orange-800 transition-colors"
                        >
                          ערוך
                        </button>
                        <button
                          onClick={() => handleDeleteClick(entry)}
                          className="min-h-[44px] flex items-center justify-center rounded-lg border border-red-600 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-100 active:bg-red-200 transition-colors"
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
      </main>

      {/* Delete Confirmation Dialog */}
      {entryToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="rounded-lg bg-white p-6 shadow-xl max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">מחק רישום זמן</h3>
            <p className="text-gray-600 mb-6">
              האם למחוק את רישום הזמן "{entryToDelete.description}"? פעולה זו אינה הפיכה.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={cancelDelete}
                disabled={deleting}
                className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                ביטול
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? "מוחק..." : "מחק"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Edit Modal */}
      {showBulkEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="rounded-lg bg-white p-6 shadow-xl max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              ערוך {selectedEntries.size} רשומות
            </h3>
            <form onSubmit={handleBulkEditSubmit} className="space-y-4">
              {bulkEditError && (
                <div className="rounded-md bg-red-50 p-4 text-sm text-red-800">
                  {bulkEditError}
                </div>
              )}

              <div>
                <label htmlFor="bulkProjectId" className="block text-sm font-medium text-gray-700 mb-1">
                  פרויקט (אופציונלי)
                </label>
                <select
                  id="bulkProjectId"
                  value={bulkEditData.projectId}
                  onChange={(e) => setBulkEditData({ ...bulkEditData, projectId: e.target.value })}
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-orange-500 focus:outline-none focus:ring-orange-500"
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
                <label htmlFor="bulkDate" className="block text-sm font-medium text-gray-700 mb-1">
                  תאריך (אופציונלי)
                </label>
                <input
                  type="date"
                  id="bulkDate"
                  value={bulkEditData.date}
                  onChange={(e) => setBulkEditData({ ...bulkEditData, date: e.target.value })}
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-orange-500 focus:outline-none focus:ring-orange-500"
                  disabled={bulkEditSubmitting}
                />
              </div>

              <div>
                <label htmlFor="bulkIsBillable" className="block text-sm font-medium text-gray-700 mb-1">
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
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-orange-500 focus:outline-none focus:ring-orange-500"
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
                  className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
                  disabled={bulkEditSubmitting}
                >
                  ביטול
                </button>
                <button
                  type="submit"
                  disabled={bulkEditSubmitting}
                  className="rounded-lg bg-orange-600 px-4 py-2 text-white hover:bg-orange-700 disabled:opacity-50"
                >
                  {bulkEditSubmitting ? "מעדכן..." : "עדכן רשומות"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {showBulkDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="rounded-lg bg-white p-6 shadow-xl max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">מחק {selectedEntries.size} רשומות</h3>
            <p className="text-gray-600 mb-6">
              האם למחוק את {selectedEntries.size} הרשומות הנבחרות? פעולה זו אינה הפיכה.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowBulkDeleteConfirm(false)}
                disabled={bulkDeleteSubmitting}
                className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                ביטול
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={bulkDeleteSubmitting}
                className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:opacity-50"
              >
                {bulkDeleteSubmitting ? "מוחק..." : "מחק"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
