"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { Breadcrumb } from "@/components/breadcrumb";
import { validateRequired, validateNumber, validateDate, validateDateRange } from "@/lib/validation";

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
  fixedBudget: number | null;
  retainerMonthlyFee: number | null;
  retainerHours: number | null;
  currency: string;
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

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
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
  const [formData, setFormData] = useState({
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
            fixedBudget: data.project.fixedBudget?.toString() || "",
            retainerMonthlyFee: data.project.retainerMonthlyFee?.toString() || "",
            retainerHours: data.project.retainerHours?.toString() || "",
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

  useEffect(() => {
    // Fetch project stats when project is loaded
    const fetchProjectStats = async () => {
      if (!user || !projectId) return;

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
  }, [user, projectId]);

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
        name: formData.name,
        pricingModel: formData.pricingModel,
        currency: formData.currency,
        status: formData.status,
        startDate: formData.startDate || null,
        endDate: formData.endDate || null,
        notes: formData.notes || null,
      };

      // Add pricing fields based on the selected model
      if (formData.pricingModel === "hourly") {
        pricingData.hourlyRate = formData.hourlyRate ? parseFloat(formData.hourlyRate) : null;
      } else if (formData.pricingModel === "package") {
        pricingData.packagePrice = formData.packagePrice ? parseFloat(formData.packagePrice) : null;
        pricingData.packageHours = formData.packageHours ? parseFloat(formData.packageHours) : null;
      } else if (formData.pricingModel === "mixed") {
        pricingData.hourlyRate = formData.hourlyRate ? parseFloat(formData.hourlyRate) : null;
        pricingData.packagePrice = formData.packagePrice ? parseFloat(formData.packagePrice) : null;
        pricingData.packageHours = formData.packageHours ? parseFloat(formData.packageHours) : null;
        pricingData.overageRate = formData.overageRate ? parseFloat(formData.overageRate) : null;
      } else if (formData.pricingModel === "fixed") {
        pricingData.fixedBudget = formData.fixedBudget ? parseFloat(formData.fixedBudget) : null;
      } else if (formData.pricingModel === "retainer") {
        pricingData.retainerMonthlyFee = formData.retainerMonthlyFee ? parseFloat(formData.retainerMonthlyFee) : null;
        pricingData.retainerHours = formData.retainerHours ? parseFloat(formData.retainerHours) : null;
      }

      const response = await fetch(`/api/projects/${projectId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(pricingData),
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
          name: project.name,
          pricingModel: project.pricingModel,
          hourlyRate: project.hourlyRate,
          packagePrice: project.packagePrice,
          packageHours: project.packageHours,
          overageRate: project.overageRate,
          fixedBudget: project.fixedBudget,
          retainerMonthlyFee: project.retainerMonthlyFee,
          retainerHours: project.retainerHours,
          currency: project.currency,
          status: "archived",
          startDate: project.startDate,
          endDate: project.endDate,
          notes: project.notes,
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
          name: project.name,
          pricingModel: project.pricingModel,
          hourlyRate: project.hourlyRate,
          packagePrice: project.packagePrice,
          packageHours: project.packageHours,
          overageRate: project.overageRate,
          fixedBudget: project.fixedBudget,
          retainerMonthlyFee: project.retainerMonthlyFee,
          retainerHours: project.retainerHours,
          currency: project.currency,
          status: "active",
          startDate: project.startDate,
          endDate: project.endDate,
          notes: project.notes,
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

  const getPricingModelLabel = (model: string) => {
    switch (model) {
      case "hourly":
        return "שעתי";
      case "package":
        return "חבילה";
      case "mixed":
        return "משולב";
      case "fixed":
        return "תקציב קבוע";
      case "retainer":
        return "רטיינר";
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
    } else if (project.pricingModel === "fixed") {
      return `${symbol}${project.fixedBudget} (תקציב קבוע)`;
    } else if (project.pricingModel === "retainer") {
      return `${symbol}${project.retainerMonthlyFee}/חודש עבור ${project.retainerHours} שעות`;
    }
    return "-";
  };

  const getBudgetProgress = () => {
    if (!projectStats || !project) return null;

    const { totalHours } = projectStats;
    const { pricingModel, packageHours, retainerHours, fixedBudget, hourlyRate } = project;

    // For package, mixed, and retainer models: show hours used vs included hours
    if (pricingModel === "package" && packageHours) {
      const percentage = Math.min((totalHours / packageHours) * 100, 100);
      const isOverBudget = totalHours > packageHours;
      return {
        type: "hours",
        current: totalHours.toFixed(1),
        total: packageHours.toFixed(1),
        percentage: isOverBudget ? 100 : percentage,
        isOverBudget,
        label: "שימוש בשעות החבילה",
      };
    }

    if (pricingModel === "mixed" && packageHours) {
      const percentage = Math.min((totalHours / packageHours) * 100, 100);
      const isOverBudget = totalHours > packageHours;
      return {
        type: "hours",
        current: totalHours.toFixed(1),
        total: packageHours.toFixed(1),
        percentage: isOverBudget ? 100 : percentage,
        isOverBudget,
        label: "שימוש בשעות החבילה",
      };
    }

    if (pricingModel === "retainer" && retainerHours) {
      const percentage = Math.min((totalHours / retainerHours) * 100, 100);
      const isOverBudget = totalHours > retainerHours;
      return {
        type: "hours",
        current: totalHours.toFixed(1),
        total: retainerHours.toFixed(1),
        percentage: isOverBudget ? 100 : percentage,
        isOverBudget,
        label: "שימוש בשעות הריטיינר",
      };
    }

    // For fixed budget model: show actual cost vs budget
    if (pricingModel === "fixed" && fixedBudget && hourlyRate) {
      const actualCost = totalHours * hourlyRate;
      const percentage = Math.min((actualCost / fixedBudget) * 100, 100);
      const isOverBudget = actualCost > fixedBudget;
      const symbol = getCurrencySymbol(project.currency);
      return {
        type: "currency",
        current: `${symbol}${actualCost.toFixed(2)}`,
        total: `${symbol}${fixedBudget.toFixed(2)}`,
        percentage: isOverBudget ? 100 : percentage,
        isOverBudget,
        label: "צריכה מול התקציב",
      };
    }

    return null;
  };

  const renderProgressBar = (progress: ReturnType<typeof getBudgetProgress>) => {
    if (!progress) return null;

    const { percentage, isOverBudget, current, total, label } = progress;
    const barColor = isOverBudget
      ? "bg-red-500"
      : percentage >= 80
      ? "bg-yellow-500"
      : "bg-green-500";

    return (
      <div className="sm:col-span-2">
        <dt className="text-sm font-medium text-gray-500 mb-2">{label}</dt>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-700">
              {current} / {total}
              {progress.type === "hours" ? " שעות" : ""}
            </span>
            <span className={`font-semibold ${isOverBudget ? "text-red-600" : percentage >= 80 ? "text-yellow-600" : "text-green-600"}`}>
              {percentage.toFixed(0)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div
              className={`${barColor} h-full rounded-full transition-all duration-300`}
              style={{ width: `${percentage}%` }}
            />
          </div>
          {isOverBudget && (
            <p className="text-xs text-red-600">חריגה מההיקף המוגדר</p>
          )}
        </div>
      </div>
    );
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
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="mb-4">
            <Breadcrumb
              items={[
                { label: "פרויקטים", href: "/projects" },
                { label: project.name },
              ]}
            />
          </div>
          {formError && !showEditForm && !showDeleteConfirm && !showArchiveConfirm && (
            <div className="mb-4 rounded-md bg-red-50 p-4 text-sm text-red-800">
              {formError}
            </div>
          )}
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
            <div className="flex gap-2">
              {project.status !== "archived" && (
                <>
                  <button
                    onClick={() => setShowEditForm(!showEditForm)}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
                  >
                    ערוך
                  </button>
                  <button
                    onClick={handleDuplicate}
                    disabled={duplicating}
                    className="rounded-lg border border-blue-300 bg-blue-50 px-4 py-2 text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                  >
                    {duplicating ? "מעתיק..." : "שכפל"}
                  </button>
                  <button
                    onClick={() => setShowArchiveConfirm(true)}
                    className="rounded-lg bg-gray-600 px-4 py-2 text-white hover:bg-gray-700"
                  >
                    ארכב
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700"
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
                    className="rounded-lg border border-blue-300 bg-blue-50 px-4 py-2 text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                  >
                    {duplicating ? "מעתיק..." : "שכפל"}
                  </button>
                  <button
                    onClick={() => handleUnarchive()}
                    className="rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700"
                    disabled={submitting}
                  >
                    {submitting ? "משחזר..." : "שחזר פרויקט"}
                  </button>
                </>
              )}
            </div>
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

        {/* Archive Confirmation Dialog */}
        {showArchiveConfirm && (
          <div className="mb-8 rounded-lg bg-white p-6 shadow border-2 border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">ארכוב פרויקט</h2>
            <p className="text-gray-700 mb-4">
              האם לארכב את הפרויקט &quot;{project.name}&quot;? הפרויקט יוסתר מרשימת הפרויקטים אך ניתן יהיה לשחזר אותו.
            </p>
            {formError && (
              <div className="rounded-md bg-red-50 p-4 text-sm text-red-800 mb-4">
                {formError}
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowArchiveConfirm(false);
                  setFormError("");
                }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
                disabled={submitting}
              >
                ביטול
              </button>
              <button
                onClick={handleArchive}
                disabled={submitting}
                className="rounded-lg bg-gray-600 px-4 py-2 text-white hover:bg-gray-700 disabled:opacity-50"
              >
                {submitting ? "מארכב..." : "ארכב פרויקט"}
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
                      fixedBudget: project.fixedBudget?.toString() || "",
                      retainerMonthlyFee: project.retainerMonthlyFee?.toString() || "",
                      retainerHours: project.retainerHours?.toString() || "",
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

              {/* Budget Progress Bar */}
              {!statsLoading && renderProgressBar(getBudgetProgress())}

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

        {/* Project Totals Card */}
        <div className="mt-6 rounded-lg bg-white shadow">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">סיכום פרויקט</h2>
          </div>
          <div className="px-6 py-4">
            <dl className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div className="rounded-lg bg-orange-50 p-4">
                <dt className="text-sm font-medium text-orange-800">סה״כ שעות</dt>
                <dd className="mt-2 text-3xl font-bold text-orange-900">
                  {statsLoading ? "..." : projectStats?.totalHours?.toFixed(1) || "0.0"}
                </dd>
                <dt className="mt-2 text-xs text-orange-700">שעות רשומות בפרויקט</dt>
              </div>

              <div className="rounded-lg bg-green-50 p-4">
                <dt className="text-sm font-medium text-green-800">מספר רשומות</dt>
                <dd className="mt-2 text-3xl font-bold text-green-900">
                  {statsLoading ? "..." : projectStats?.entryCount || 0}
                </dd>
                <dt className="mt-2 text-xs text-green-700">כמות רשומות זמן בפרויקט</dt>
              </div>
            </dl>
          </div>
        </div>
      </main>
    </div>
  );
}
