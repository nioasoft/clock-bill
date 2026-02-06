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
  const [deleting, setDeleting] = useState(false);

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
    // Fetch entries when user is loaded
    const fetchEntries = async () => {
      if (!user) return;

      try {
        setEntriesLoading(true);
        const response = await fetch("/api/entries");
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
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
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
      } else {
        alert(data.message || "שגיאה במחיקת הרשומה");
      }
    } catch (error) {
      console.error("Error deleting entry:", error);
      alert("שגיאה במחיקת הרשומה");
    } finally {
      setDeleting(false);
    }
  };

  const cancelDelete = () => {
    setEntryToDelete(null);
  };

  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}:${mins.toString().padStart(2, "0")}`;
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
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center" dir="rtl">
        <div className="text-gray-600">טוען...</div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect
  }

  return (
    <div className="min-h-screen bg-zinc-50" dir="rtl">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-gray-600 hover:text-gray-900">
              ← חזור לדשבורד
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">רישום זמן</h1>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="rounded-lg bg-orange-600 px-4 py-2 text-white hover:bg-orange-700"
          >
            {showForm ? "ביטול" : "+ רשום זמן"}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
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
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-orange-500"
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
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-orange-500"
                    disabled={submitting}
                  />
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
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-orange-500"
                    disabled={submitting}
                    placeholder="לדוגמה: 60"
                  />
                  <p className="mt-1 text-xs text-gray-500">הזן את משך הזמן בדקות</p>
                </div>

                <div className="flex items-center">
                  <label htmlFor="isBillable" className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      id="isBillable"
                      checked={formData.isBillable}
                      onChange={(e) => setFormData({ ...formData, isBillable: e.target.checked })}
                      className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                      disabled={submitting}
                    />
                    <span className="ms-2 text-sm font-medium text-gray-700">ניתן לחיוב</span>
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
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-orange-500"
                    disabled={submitting}
                    placeholder="מה עשית?"
                  />
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
            <div className="p-8 text-center">
              <p className="text-gray-600 mb-4">אין רישומי זמן עדיין</p>
              <button
                onClick={() => setShowForm(true)}
                className="rounded-lg bg-orange-600 px-4 py-2 text-white hover:bg-orange-700"
              >
                רשום זמן ראשון
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                      תאריך
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                      תיאור
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                      לקוח
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                      פרויקט
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                      משך זמן
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                      פעולות
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {entries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="text-sm text-gray-900">
                          {new Date(entry.date).toLocaleDateString("he-IL")}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900 max-w-xs truncate">
                          {entry.description}
                        </div>
                        {entry.notes && (
                          <div className="text-xs text-gray-500 truncate max-w-xs">{entry.notes}</div>
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
    </div>
  );
}
