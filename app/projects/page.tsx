"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AppLayout } from "@/components/app-layout";
import { EmptyState } from "@/components/ui/empty-state";
import { FolderOpen } from "lucide-react";
import { validateRequired, validateNumber, validateDate, validateDateRange } from "@/lib/validation";

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

  // Field validation errors
  const [fieldErrors, setFieldErrors] = useState<{
    clientId?: string;
    name?: string;
    hourlyRate?: string;
    packagePrice?: string;
    packageHours?: string;
    overageRate?: string;
    fixedBudget?: string;
    retainerMonthlyFee?: string;
    retainerHours?: string;
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

    // Validate pricing fields based on pricing model
    if (formData.pricingModel === "hourly") {
      if (formData.hourlyRate && formData.hourlyRate.trim()) {
        const rateValidation = validateNumber(formData.hourlyRate, true, 0);
        if (!rateValidation.isValid) {
          errors.hourlyRate = rateValidation.error;
        }
      } else {
        errors.hourlyRate = "שדה חובה עבור מודל תמחור שעתי";
      }
    } else if (formData.pricingModel === "package") {
      if (formData.packagePrice && formData.packagePrice.trim()) {
        const priceValidation = validateNumber(formData.packagePrice, true, 0);
        if (!priceValidation.isValid) {
          errors.packagePrice = priceValidation.error;
        }
      } else {
        errors.packagePrice = "שדה חובה עבור מודל תמחור חבילה";
      }
      if (formData.packageHours && formData.packageHours.trim()) {
        const hoursValidation = validateNumber(formData.packageHours, true, 0);
        if (!hoursValidation.isValid) {
          errors.packageHours = hoursValidation.error;
        }
      } else {
        errors.packageHours = "שדה חובה עבור מודל תמחור חבילה";
      }
    } else if (formData.pricingModel === "mixed") {
      if (formData.packagePrice && formData.packagePrice.trim()) {
        const priceValidation = validateNumber(formData.packagePrice, true, 0);
        if (!priceValidation.isValid) {
          errors.packagePrice = priceValidation.error;
        }
      } else {
        errors.packagePrice = "שדה חובה עבור מודל תמחור משולב";
      }
      if (formData.packageHours && formData.packageHours.trim()) {
        const hoursValidation = validateNumber(formData.packageHours, true, 0);
        if (!hoursValidation.isValid) {
          errors.packageHours = hoursValidation.error;
        }
      } else {
        errors.packageHours = "שדה חובה עבור מודל תמחור משולב";
      }
      if (formData.overageRate && formData.overageRate.trim()) {
        const overageValidation = validateNumber(formData.overageRate, true, 0);
        if (!overageValidation.isValid) {
          errors.overageRate = overageValidation.error;
        }
      } else {
        errors.overageRate = "שדה חובה עבור מודל תמחור משולב";
      }
    } else if (formData.pricingModel === "fixed") {
      if (formData.fixedBudget && formData.fixedBudget.trim()) {
        const budgetValidation = validateNumber(formData.fixedBudget, true, 0);
        if (!budgetValidation.isValid) {
          errors.fixedBudget = budgetValidation.error;
        }
      } else {
        errors.fixedBudget = "שדה חובה עבור מודל תמחור קבוע";
      }
    } else if (formData.pricingModel === "retainer") {
      if (formData.retainerMonthlyFee && formData.retainerMonthlyFee.trim()) {
        const feeValidation = validateNumber(formData.retainerMonthlyFee, true, 0);
        if (!feeValidation.isValid) {
          errors.retainerMonthlyFee = feeValidation.error;
        }
      } else {
        errors.retainerMonthlyFee = "שדה חובה עבור מודל תמחור ריטיינר";
      }
      if (formData.retainerHours && formData.retainerHours.trim()) {
        const hoursValidation = validateNumber(formData.retainerHours, true, 0);
        if (!hoursValidation.isValid) {
          errors.retainerHours = hoursValidation.error;
        }
      } else {
        errors.retainerHours = "שדה חובה עבור מודל תמחור ריטיינר";
      }
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
      // Only send the pricing fields that are relevant to the current pricing model
      const pricingData: any = {
        clientId: formData.clientId,
        name: formData.name,
        pricingModel: formData.pricingModel,
        currency: formData.currency,
        status: formData.status,
        startDate: formData.startDate || undefined,
        endDate: formData.endDate || undefined,
        notes: formData.notes || undefined,
      };

      // Add pricing fields based on the selected model
      if (formData.pricingModel === "hourly") {
        pricingData.hourlyRate = formData.hourlyRate ? parseFloat(formData.hourlyRate) : undefined;
      } else if (formData.pricingModel === "package") {
        pricingData.packagePrice = formData.packagePrice ? parseFloat(formData.packagePrice) : undefined;
        pricingData.packageHours = formData.packageHours ? parseFloat(formData.packageHours) : undefined;
      } else if (formData.pricingModel === "mixed") {
        pricingData.hourlyRate = formData.hourlyRate ? parseFloat(formData.hourlyRate) : undefined;
        pricingData.packagePrice = formData.packagePrice ? parseFloat(formData.packagePrice) : undefined;
        pricingData.packageHours = formData.packageHours ? parseFloat(formData.packageHours) : undefined;
        pricingData.overageRate = formData.overageRate ? parseFloat(formData.overageRate) : undefined;
      } else if (formData.pricingModel === "fixed") {
        pricingData.fixedBudget = formData.fixedBudget ? parseFloat(formData.fixedBudget) : undefined;
      } else if (formData.pricingModel === "retainer") {
        pricingData.retainerMonthlyFee = formData.retainerMonthlyFee ? parseFloat(formData.retainerMonthlyFee) : undefined;
        pricingData.retainerHours = formData.retainerHours ? parseFloat(formData.retainerHours) : undefined;
      }

      const response = await fetch("/api/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(pricingData),
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
      case "archived":
        return "בארכיון";
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
      <div className="px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-4">
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">פרויקטים</h1>
          {statusFilter === "active" && (
            <button
              onClick={() => setShowForm(!showForm)}
              className="rounded-lg bg-primary px-4 py-2 text-white hover:bg-primary/90"
            >
              {showForm ? "ביטול" : "+ פרויקט חדש"}
            </button>
          )}
        </div>

        {/* Status Filter Tabs */}
        <div className="flex gap-2 border-b border-border mb-6">
          <button
            onClick={() => setStatusFilter("active")}
            className={`px-4 py-2 font-medium transition-colors ${
              statusFilter === "active"
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            פעילים
          </button>
          <button
            onClick={() => setStatusFilter("archived")}
            className={`px-4 py-2 font-medium transition-colors ${
              statusFilter === "archived"
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            ארכיון
          </button>
        </div>
        {/* Add Project Form */}
        {showForm && (
          <div className="mb-8 rounded-lg bg-card p-6 shadow">
            <h2 className="text-xl font-semibold text-foreground mb-4">הוסף פרויקט חדש</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              {formError && (
                <div className="rounded-[14px] bg-destructive/10 p-4 text-sm text-destructive">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="clientId" className="block text-sm font-medium text-muted-foreground">
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
                    className={`mt-1 block w-full rounded-[14px] px-3 py-2 shadow-sm focus:outline-none focus:ring-primary disabled:opacity-50 ${
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
                  <label htmlFor="name" className="block text-sm font-medium text-muted-foreground">
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
                    className={`mt-1 block w-full rounded-[14px] px-3 py-2 shadow-sm focus:outline-none focus:ring-primary disabled:opacity-50 ${
                      fieldErrors.name
                        ? "border-destructive/30 focus:border-destructive focus:ring-destructive/20"
                        : "border-border focus:border-primary"
                    }`}
                    disabled={submitting}
                  />
                  {fieldErrors.name && <p className="mt-1 text-sm text-destructive">{fieldErrors.name}</p>}
                </div>

                <div>
                  <label htmlFor="pricingModel" className="block text-sm font-medium text-muted-foreground">
                    מודל תמחור *
                  </label>
                  <select
                    id="pricingModel"
                    required
                    value={formData.pricingModel}
                    onChange={(e) => setFormData({ ...formData, pricingModel: e.target.value })}
                    className="mt-1 block w-full rounded-[14px] border border-border px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary"
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
                  <label htmlFor="currency" className="block text-sm font-medium text-muted-foreground">
                    מטבע
                  </label>
                  <select
                    id="currency"
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                    className="mt-1 block w-full rounded-[14px] border border-border px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary"
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
                    <label htmlFor="hourlyRate" className="block text-sm font-medium text-muted-foreground">
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
                      className="mt-1 block w-full rounded-[14px] border border-border px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary"
                      disabled={submitting}
                    />
                  </div>
                )}

                {formData.pricingModel === "package" && (
                  <>
                    <div>
                      <label htmlFor="packagePrice" className="block text-sm font-medium text-muted-foreground">
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
                        className="mt-1 block w-full rounded-[14px] border border-border px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary"
                        disabled={submitting}
                      />
                    </div>

                    <div>
                      <label htmlFor="packageHours" className="block text-sm font-medium text-muted-foreground">
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
                        className="mt-1 block w-full rounded-[14px] border border-border px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary"
                        disabled={submitting}
                      />
                    </div>
                  </>
                )}

                {formData.pricingModel === "mixed" && (
                  <>
                    <div>
                      <label htmlFor="packagePrice" className="block text-sm font-medium text-muted-foreground">
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
                        className="mt-1 block w-full rounded-[14px] border border-border px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary"
                        disabled={submitting}
                      />
                    </div>

                    <div>
                      <label htmlFor="packageHours" className="block text-sm font-medium text-muted-foreground">
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
                        className="mt-1 block w-full rounded-[14px] border border-border px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary"
                        disabled={submitting}
                      />
                    </div>

                    <div>
                      <label htmlFor="hourlyRate" className="block text-sm font-medium text-muted-foreground">
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
                        className="mt-1 block w-full rounded-[14px] border border-border px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary"
                        disabled={submitting}
                      />
                    </div>

                    <div>
                      <label htmlFor="overageRate" className="block text-sm font-medium text-muted-foreground">
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
                        className="mt-1 block w-full rounded-[14px] border border-border px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary"
                        disabled={submitting}
                      />
                    </div>
                  </>
                )}

                {formData.pricingModel === "fixed" && (
                  <div>
                    <label htmlFor="fixedBudget" className="block text-sm font-medium text-muted-foreground">
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
                      className="mt-1 block w-full rounded-[14px] border border-border px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary"
                      disabled={submitting}
                    />
                  </div>
                )}

                {formData.pricingModel === "retainer" && (
                  <>
                    <div>
                      <label htmlFor="retainerMonthlyFee" className="block text-sm font-medium text-muted-foreground">
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
                        className="mt-1 block w-full rounded-[14px] border border-border px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary"
                        disabled={submitting}
                      />
                    </div>

                    <div>
                      <label htmlFor="retainerHours" className="block text-sm font-medium text-muted-foreground">
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
                        className="mt-1 block w-full rounded-[14px] border-border px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary rounded-[14px]"
                        disabled={submitting}
                      />
                    </div>
                  </>
                )}

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
                    className={`mt-1 block w-full rounded-[14px] border px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary ${fieldErrors.startDate ? "border-destructive" : "border-border"}`}
                    disabled={submitting}
                  />
                  {fieldErrors.startDate && (
                    <p className="mt-1 text-xs text-destructive">{fieldErrors.startDate}</p>
                  )}
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
                    className={`mt-1 block w-full rounded-[14px] border px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary ${fieldErrors.endDate ? "border-destructive" : "border-border"}`}
                    disabled={submitting}
                  />
                  {fieldErrors.endDate && (
                    <p className="mt-1 text-xs text-destructive">{fieldErrors.endDate}</p>
                  )}
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
                  className="rounded-lg border border-border px-4 py-2 text-muted-foreground hover:bg-muted/50"
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
        <div className="rounded-lg bg-card shadow">
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
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-6 py-3 text-start text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      שם
                    </th>
                    <th className="px-6 py-3 text-start text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      לקוח
                    </th>
                    <th className="px-6 py-3 text-start text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      מודל תמחור
                    </th>
                    <th className="px-6 py-3 text-start text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      פירוט תמחור
                    </th>
                    <th className="px-6 py-3 text-start text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      סטטוס
                    </th>
                    <th className="px-6 py-3 text-start text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      תאריכים
                    </th>
                    {statusFilter === "archived" && (
                      <th className="px-6 py-3 text-start text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        פעולות
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-card">
                  {projects.map((project) => (
                    <tr
                      key={project.id}
                      className="hover:bg-muted/50"
                    >
                      <td
                        className="whitespace-nowrap px-6 py-4 cursor-pointer"
                        onClick={() => router.push(`/projects/${project.id}`)}
                      >
                        <div className="text-sm font-medium text-primary hover:text-primary/90">{project.name}</div>
                      </td>
                      <td
                        className="whitespace-nowrap px-6 py-4 cursor-pointer"
                        onClick={() => router.push(`/projects/${project.id}`)}
                      >
                        <div className="text-sm text-foreground">{project.clientName}</div>
                      </td>
                      <td
                        className="whitespace-nowrap px-6 py-4 cursor-pointer"
                        onClick={() => router.push(`/projects/${project.id}`)}
                      >
                        <div className="text-sm text-foreground">
                          {getPricingModelLabel(project.pricingModel)}
                        </div>
                      </td>
                      <td
                        className="px-6 py-4 cursor-pointer"
                        onClick={() => router.push(`/projects/${project.id}`)}
                      >
                        <div className="text-sm text-foreground">{formatPricingDetails(project)}</div>
                      </td>
                      <td
                        className="whitespace-nowrap px-6 py-4 cursor-pointer"
                        onClick={() => router.push(`/projects/${project.id}`)}
                      >
                        {project.status === "active" ? (
                          <span className="inline-flex rounded-full bg-success/10 px-2 text-xs font-semibold leading-5 text-success">
                            {getStatusLabel(project.status)}
                          </span>
                        ) : project.status === "completed" ? (
                          <span className="inline-flex rounded-full bg-secondary-light px-2 text-xs font-semibold leading-5 text-secondary">
                            {getStatusLabel(project.status)}
                          </span>
                        ) : project.status === "archived" ? (
                          <span className="inline-flex rounded-full bg-muted px-2 text-xs font-semibold leading-5 text-foreground">
                            {getStatusLabel(project.status)}
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-yellow-100 px-2 text-xs font-semibold leading-5 text-yellow-800">
                            {getStatusLabel(project.status)}
                          </span>
                        )}
                      </td>
                      <td
                        className="px-6 py-4 cursor-pointer"
                        onClick={() => router.push(`/projects/${project.id}`)}
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
                            className="min-h-[44px] px-4 py-2 rounded-[14px] bg-success text-sm text-white hover:bg-success/90"
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
      </div>
    </AppLayout>
  );
}
