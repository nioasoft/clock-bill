"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface User {
  id: string;
  email: string;
}

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
  pricingModel: string;
  hourlyRate: number | null;
  packagePrice: number | null;
  packageHours: number | null;
  overageRate: number | null;
  fixedBudget: number | null;
  retainerMonthlyFee: number | null;
  retainerHours: number | null;
  currency: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  notes: string | null;
  createdAt: string;
}

export default function ProjectsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    clientId: "",
    name: "",
    pricingModel: "hourly",
    hourlyRate: "",
    packagePrice: "",
    packageHours: "",
    overageRate: "",
    fixedBudget: "",
    retainerMonthlyFee: "",
    retainerHours: "",
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
    // Fetch clients when user is loaded
    const fetchClients = async () => {
      if (!user) return;

      try {
        const response = await fetch("/api/clients");
        const data = await response.json();

        if (data.success) {
          // Only show active clients
          setClients(data.clients.filter((c: Client) => c.isActive && true));
        }
      } catch (error) {
        console.error("Error fetching clients:", error);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
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
          pricingModel: formData.pricingModel,
          hourlyRate: formData.hourlyRate ? parseFloat(formData.hourlyRate) : undefined,
          packagePrice: formData.packagePrice ? parseFloat(formData.packagePrice) : undefined,
          packageHours: formData.packageHours ? parseFloat(formData.packageHours) : undefined,
          overageRate: formData.overageRate ? parseFloat(formData.overageRate) : undefined,
          fixedBudget: formData.fixedBudget ? parseFloat(formData.fixedBudget) : undefined,
          retainerMonthlyFee: formData.retainerMonthlyFee ? parseFloat(formData.retainerMonthlyFee) : undefined,
          retainerHours: formData.retainerHours ? parseFloat(formData.retainerHours) : undefined,
          currency: formData.currency,
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
          pricingModel: "hourly",
          hourlyRate: "",
          packagePrice: "",
          packageHours: "",
          overageRate: "",
          fixedBudget: "",
          retainerMonthlyFee: "",
          retainerHours: "",
          currency: "ILS",
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
    } else if (project.pricingModel === "fixed") {
      return `${symbol}${project.fixedBudget} (תקציב קבוע)`;
    } else if (project.pricingModel === "retainer") {
      return `${symbol}${project.retainerMonthlyFee}/חודש עבור ${project.retainerHours} שעות`;
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

  return (
    <div className="min-h-screen bg-zinc-50" dir="rtl">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-gray-600 hover:text-gray-900">
              ← חזור לדשבורד
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">פרויקטים</h1>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="rounded-lg bg-orange-600 px-4 py-2 text-white hover:bg-orange-700"
          >
            {showForm ? "ביטול" : "+ פרויקט חדש"}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Add Project Form */}
        {showForm && (
          <div className="mb-8 rounded-lg bg-white p-6 shadow">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">הוסף פרויקט חדש</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              {formError && (
                <div className="rounded-md bg-red-50 p-4 text-sm text-red-800">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="clientId" className="block text-sm font-medium text-gray-700">
                    לקוח *
                  </label>
                  <select
                    id="clientId"
                    required
                    value={formData.clientId}
                    onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-orange-500"
                    disabled={submitting}
                  >
                    <option value="">בחר לקוח</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.name}
                      </option>
                    ))}
                  </select>
                </div>

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
                    <option value="fixed">תקציב קבוע</option>
                    <option value="retainer">רטיינר</option>
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

                {formData.pricingModel === "fixed" && (
                  <div>
                    <label htmlFor="fixedBudget" className="block text-sm font-medium text-gray-700">
                      תקציב כולל *
                    </label>
                    <input
                      type="number"
                      id="fixedBudget"
                      required
                      min="0"
                      step="0.01"
                      value={formData.fixedBudget}
                      onChange={(e) => setFormData({ ...formData, fixedBudget: e.target.value })}
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-orange-500"
                      disabled={submitting}
                    />
                  </div>
                )}

                {formData.pricingModel === "retainer" && (
                  <>
                    <div>
                      <label htmlFor="retainerMonthlyFee" className="block text-sm font-medium text-gray-700">
                        תשלום חודשי *
                      </label>
                      <input
                        type="number"
                        id="retainerMonthlyFee"
                        required
                        min="0"
                        step="0.01"
                        value={formData.retainerMonthlyFee}
                        onChange={(e) => setFormData({ ...formData, retainerMonthlyFee: e.target.value })}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-orange-500"
                        disabled={submitting}
                      />
                    </div>

                    <div>
                      <label htmlFor="retainerHours" className="block text-sm font-medium text-gray-700">
                        שעות בחבילה *
                      </label>
                      <input
                        type="number"
                        id="retainerHours"
                        required
                        min="0"
                        step="0.5"
                        value={formData.retainerHours}
                        onChange={(e) => setFormData({ ...formData, retainerHours: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 px-3 py-2 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-orange-500 rounded-md"
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
                    setShowForm(false);
                    setFormData({
                      clientId: "",
                      name: "",
                      pricingModel: "hourly",
                      hourlyRate: "",
                      packagePrice: "",
                      packageHours: "",
                      overageRate: "",
                      fixedBudget: "",
                      retainerMonthlyFee: "",
                      retainerHours: "",
                      currency: "ILS",
                      status: "active",
                      startDate: "",
                      endDate: "",
                      notes: "",
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
                  {submitting ? "שומר..." : "שמור"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Projects List */}
        <div className="rounded-lg bg-white shadow">
          {projectsLoading ? (
            <div className="p-8 text-center text-gray-600">טוען פרויקטים...</div>
          ) : projects.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-600 mb-4">אין פרויקטים עדיין</p>
              <p className="text-sm text-gray-500 mb-4">צור לקוח תחילה ואז תוכל ליצור פרויקטים</p>
              <div className="flex gap-2 justify-center">
                <button
                  onClick={() => setShowForm(true)}
                  className="rounded-lg bg-orange-600 px-4 py-2 text-white hover:bg-orange-700"
                >
                  צור פרויקט
                </button>
                {clients.length === 0 && (
                  <Link
                    href="/clients"
                    className="rounded-lg border border-orange-600 px-4 py-2 text-orange-600 hover:bg-orange-50"
                  >
                    צור לקוח
                  </Link>
                )}
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                      שם
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                      לקוח
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                      מודל תמחור
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                      פירוט תמחור
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                      סטטוס
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                      תאריכים
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {projects.map((project) => (
                    <tr
                      key={project.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => router.push(`/projects/${project.id}`)}
                    >
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="text-sm font-medium text-orange-600 hover:text-orange-700">{project.name}</div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="text-sm text-gray-900">{project.clientName}</div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="text-sm text-gray-900">
                          {getPricingModelLabel(project.pricingModel)}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">{formatPricingDetails(project)}</div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        {project.status === "active" ? (
                          <span className="inline-flex rounded-full bg-green-100 px-2 text-xs font-semibold leading-5 text-green-800">
                            {getStatusLabel(project.status)}
                          </span>
                        ) : project.status === "completed" ? (
                          <span className="inline-flex rounded-full bg-blue-100 px-2 text-xs font-semibold leading-5 text-blue-800">
                            {getStatusLabel(project.status)}
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-yellow-100 px-2 text-xs font-semibold leading-5 text-yellow-800">
                            {getStatusLabel(project.status)}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-500">
                          {project.startDate ? new Date(project.startDate).toLocaleDateString("he-IL") : "-"}
                          {" - "}
                          {project.endDate ? new Date(project.endDate).toLocaleDateString("he-IL") : "ללא תאריך סיום"}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
