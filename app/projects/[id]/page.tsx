"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
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
  pricingModel: string;
  hourlyRate: number | null;
  packagePrice: number | null;
  packageHours: number | null;
  overageRate: number | null;
  currency: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  notes: string | null;
  createdAt: string;
}

export default function ProjectDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<Project | null>(null);
  const [projectLoading, setProjectLoading] = useState(true);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    pricingModel: "hourly",
    hourlyRate: "",
    packagePrice: "",
    packageHours: "",
    overageRate: "",
    currency: "ILS",
    status: "active",
    startDate: "",
    endDate: "",
    notes: "",
  });
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
    // Fetch project when user is loaded
    const fetchProject = async () => {
      if (!user || !projectId) return;

      try {
        setProjectLoading(true);
        const response = await fetch(`/api/projects/${projectId}`);
        const data = await response.json();

        if (data.success && data.project) {
          setProject(data.project);
          // Initialize form data with project data
          setFormData({
            name: data.project.name,
            pricingModel: data.project.pricingModel,
            hourlyRate: data.project.hourlyRate?.toString() || "",
            packagePrice: data.project.packagePrice?.toString() || "",
            packageHours: data.project.packageHours?.toString() || "",
            overageRate: data.project.overageRate?.toString() || "",
            currency: data.project.currency,
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
  }, [user, projectId, router]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setSubmitting(true);

    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formData.name,
          pricingModel: formData.pricingModel,
          hourlyRate: formData.hourlyRate ? parseFloat(formData.hourlyRate) : null,
          packagePrice: formData.packagePrice ? parseFloat(formData.packagePrice) : null,
          packageHours: formData.packageHours ? parseFloat(formData.packageHours) : null,
          overageRate: formData.overageRate ? parseFloat(formData.overageRate) : null,
          currency: formData.currency,
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

  const getPricingModelLabel = (model: string) => {
    switch (model) {
      case "hourly":
        return "שעתי";
      case "package":
        return "חבילה";
      case "mixed":
        return "משולב";
      default:
        return model;
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
        return "bg-green-100 text-green-800";
      case "completed":
        return "bg-blue-100 text-blue-800";
      case "paused":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getCurrencySymbol = (currency: string) => {
    switch (currency) {
      case "ILS":
        return "₪";
      case "USD":
        return "$";
      case "USDT":
        return "₮";
      case "BTC":
        return "₿";
      case "ETH":
        return "Ξ";
      default:
        return currency;
    }
  };

  const formatPricingDetails = (project: Project) => {
    const symbol = getCurrencySymbol(project.currency);

    if (project.pricingModel === "hourly") {
      return `${symbol}${project.hourlyRate}/שעה`;
    } else if (project.pricingModel === "package") {
      return `${symbol}${project.packagePrice} עבור ${project.packageHours} שעות`;
    } else if (project.pricingModel === "mixed") {
      return `${symbol}${project.packagePrice} עבור ${project.packageHours} שעות, אז ${symbol}${project.overageRate}/שעה`;
    }
    return "-";
  };

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

  if (projectLoading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center" dir="rtl">
        <div className="text-gray-600">טוען פרויקט...</div>
      </div>
    );
  }

  if (!project) {
    return null; // Will redirect
  }

  return (
    <div className="min-h-screen bg-zinc-50" dir="rtl">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/projects" className="text-gray-600 hover:text-gray-900">
              ← חזור לפרויקטים
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowEditForm(!showEditForm)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
            >
              ערוך
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700"
            >
              מחק
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Delete Confirmation Dialog */}
        {showDeleteConfirm && (
          <div className="mb-8 rounded-lg bg-white p-6 shadow border-2 border-red-200">
            <h2 className="text-xl font-semibold text-red-900 mb-4">מחיקת פרויקט</h2>
            <p className="text-gray-700 mb-4">
              האם למחוק את הפרויקט &quot;{project.name}&quot;? פעולה זו אינה הפיכה.
            </p>
            {formError && (
              <div className="rounded-md bg-red-50 p-4 text-sm text-red-800 mb-4">
                {formError}
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setFormError("");
                }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
                disabled={submitting}
              >
                ביטול
              </button>
              <button
                onClick={handleDelete}
                disabled={submitting}
                className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:opacity-50"
              >
                {submitting ? "מוחק..." : "מחק פרויקט"}
              </button>
            </div>
          </div>
        )}

        {/* Edit Form */}
        {showEditForm && (
          <div className="mb-8 rounded-lg bg-white p-6 shadow">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">ערוך פרויקט</h2>
            <form onSubmit={handleUpdate} className="space-y-4">
              {formError && (
                <div className="rounded-md bg-red-50 p-4 text-sm text-red-800">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                    שם הפרויקט *
                  </label>
                  <input
                    type="text"
                    id="name"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-orange-500"
                    disabled={submitting}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    לקוח
                  </label>
                  <input
                    type="text"
                    value={project.clientName}
                    disabled
                    className="mt-1 block w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-gray-500"
                  />
                </div>

                <div>
                  <label htmlFor="pricingModel" className="block text-sm font-medium text-gray-700">
                    מודל תמחור *
                  </label>
                  <select
                    id="pricingModel"
                    required
                    value={formData.pricingModel}
                    onChange={(e) => setFormData({ ...formData, pricingModel: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-orange-500"
                    disabled={submitting}
                  >
                    <option value="hourly">שעתי</option>
                    <option value="package">חבילה</option>
                    <option value="mixed">משולב</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="currency" className="block text-sm font-medium text-gray-700">
                    מטבע
                  </label>
                  <select
                    id="currency"
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-orange-500"
                    disabled={submitting}
                  >
                    <option value="ILS">₪ - שקל ישראלי</option>
                    <option value="USD">$ - דולר אמריקאי</option>
                    <option value="USDT">₮ - טתר</option>
                    <option value="BTC">₿ - ביטקוין</option>
                    <option value="ETH">Ξ - אתריום</option>
                  </select>
                </div>

                {formData.pricingModel === "hourly" && (
                  <div>
                    <label htmlFor="hourlyRate" className="block text-sm font-medium text-gray-700">
                      תעריף שעתי *
                    </label>
                    <input
                      type="number"
                      id="hourlyRate"
                      required
                      min="0"
                      step="0.01"
                      value={formData.hourlyRate}
                      onChange={(e) => setFormData({ ...formData, hourlyRate: e.target.value })}
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-orange-500"
                      disabled={submitting}
                    />
                  </div>
                )}

                {formData.pricingModel === "package" && (
                  <>
                    <div>
                      <label htmlFor="packagePrice" className="block text-sm font-medium text-gray-700">
                        מחיר חבילה *
                      </label>
                      <input
                        type="number"
                        id="packagePrice"
                        required
                        min="0"
                        step="0.01"
                        value={formData.packagePrice}
                        onChange={(e) => setFormData({ ...formData, packagePrice: e.target.value })}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-orange-500"
                        disabled={submitting}
                      />
                    </div>

                    <div>
                      <label htmlFor="packageHours" className="block text-sm font-medium text-gray-700">
                        שעות בחבילה *
                      </label>
                      <input
                        type="number"
                        id="packageHours"
                        required
                        min="0"
                        step="0.5"
                        value={formData.packageHours}
                        onChange={(e) => setFormData({ ...formData, packageHours: e.target.value })}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-orange-500"
                        disabled={submitting}
                      />
                    </div>
                  </>
                )}

                {formData.pricingModel === "mixed" && (
                  <>
                    <div>
                      <label htmlFor="packagePrice" className="block text-sm font-medium text-gray-700">
                        מחיר חבילה *
                      </label>
                      <input
                        type="number"
                        id="packagePrice"
                        required
                        min="0"
                        step="0.01"
                        value={formData.packagePrice}
                        onChange={(e) => setFormData({ ...formData, packagePrice: e.target.value })}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-orange-500"
                        disabled={submitting}
                      />
                    </div>

                    <div>
                      <label htmlFor="packageHours" className="block text-sm font-medium text-gray-700">
                        שעות בחבילה *
                      </label>
                      <input
                        type="number"
                        id="packageHours"
                        required
                        min="0"
                        step="0.5"
                        value={formData.packageHours}
                        onChange={(e) => setFormData({ ...formData, packageHours: e.target.value })}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-orange-500"
                        disabled={submitting}
                      />
                    </div>

                    <div>
                      <label htmlFor="hourlyRate" className="block text-sm font-medium text-gray-700">
                        תעריף שעתי בחבילה *
                      </label>
                      <input
                        type="number"
                        id="hourlyRate"
                        required
                        min="0"
                        step="0.01"
                        value={formData.hourlyRate}
                        onChange={(e) => setFormData({ ...formData, hourlyRate: e.target.value })}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-orange-500"
                        disabled={submitting}
                      />
                    </div>

                    <div>
                      <label htmlFor="overageRate" className="block text-sm font-medium text-gray-700">
                        תעריף מעל החבילה *
                      </label>
                      <input
                        type="number"
                        id="overageRate"
                        required
                        min="0"
                        step="0.01"
                        value={formData.overageRate}
                        onChange={(e) => setFormData({ ...formData, overageRate: e.target.value })}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-orange-500"
                        disabled={submitting}
                      />
                    </div>
                  </>
                )}

                <div>
                  <label htmlFor="status" className="block text-sm font-medium text-gray-700">
                    סטטוס
                  </label>
                  <select
                    id="status"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-orange-500"
                    disabled={submitting}
                  >
                    <option value="active">פעיל</option>
                    <option value="paused">מושהה</option>
                    <option value="completed">הושלם</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="startDate" className="block text-sm font-medium text-gray-700">
                    תאריך התחלה
                  </label>
                  <input
                    type="date"
                    id="startDate"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-orange-500"
                    disabled={submitting}
                  />
                </div>

                <div>
                  <label htmlFor="endDate" className="block text-sm font-medium text-gray-700">
                    תאריך סיום
                  </label>
                  <input
                    type="date"
                    id="endDate"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-orange-500"
                    disabled={submitting}
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
                      pricingModel: project.pricingModel,
                      hourlyRate: project.hourlyRate?.toString() || "",
                      packagePrice: project.packagePrice?.toString() || "",
                      packageHours: project.packageHours?.toString() || "",
                      overageRate: project.overageRate?.toString() || "",
                      currency: project.currency,
                      status: project.status,
                      startDate: project.startDate || "",
                      endDate: project.endDate || "",
                      notes: project.notes || "",
                    });
                  }}
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
                  {submitting ? "שומר..." : "שמור שינויים"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Project Details Card */}
        <div className="rounded-lg bg-white shadow">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">פרטי פרויקט</h2>
          </div>
          <div className="px-6 py-4">
            <dl className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-gray-500">שם הפרויקט</dt>
                <dd className="mt-1 text-sm text-gray-900">{project.name}</dd>
              </div>

              <div>
                <dt className="text-sm font-medium text-gray-500">לקוח</dt>
                <dd className="mt-1 text-sm text-gray-900">{project.clientName}</dd>
              </div>

              <div>
                <dt className="text-sm font-medium text-gray-500">מודל תמחור</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {getPricingModelLabel(project.pricingModel)}
                </dd>
              </div>

              <div>
                <dt className="text-sm font-medium text-gray-500">פירוט תמחור</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {formatPricingDetails(project)}
                </dd>
              </div>

              <div>
                <dt className="text-sm font-medium text-gray-500">סטטוס</dt>
                <dd className="mt-1">
                  <span className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${getStatusColor(project.status)}`}>
                    {getStatusLabel(project.status)}
                  </span>
                </dd>
              </div>

              <div>
                <dt className="text-sm font-medium text-gray-500">מטבע</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {getCurrencySymbol(project.currency)} - {project.currency}
                </dd>
              </div>

              <div>
                <dt className="text-sm font-medium text-gray-500">תאריך התחלה</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {project.startDate ? new Date(project.startDate).toLocaleDateString("he-IL") : "-"}
                </dd>
              </div>

              <div>
                <dt className="text-sm font-medium text-gray-500">תאריך סיום</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {project.endDate ? new Date(project.endDate).toLocaleDateString("he-IL") : "-"}
                </dd>
              </div>

              {project.notes && (
                <div className="sm:col-span-2">
                  <dt className="text-sm font-medium text-gray-500">הערות</dt>
                  <dd className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">{project.notes}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      </main>
    </div>
  );
}
