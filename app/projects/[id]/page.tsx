"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { AppLayout } from "@/components/app-layout";
import { Breadcrumb } from "@/components/breadcrumb";
import { validateRequired, validateNumber, validateDate, validateDateRange } from "@/lib/validation";

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
        return "bg-success/10 text-success";
      case "completed":
        return "bg-secondary-light text-secondary";
      case "paused":
        return "bg-accent text-foreground";
      default:
        return "bg-muted text-foreground";
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
      ? "bg-destructive/100"
      : percentage >= 80
      ? "bg-accent"
      : "bg-success/100";

    return (
      <div className="sm:col-span-2">
        <dt className="text-sm font-medium text-muted-foreground mb-2">{label}</dt>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              {current} / {total}
              {progress.type === "hours" ? " שעות" : ""}
            </span>
            <span className={`font-semibold ${isOverBudget ? "text-destructive" : percentage >= 80 ? "text-foreground" : "text-success"}`}>
              {percentage.toFixed(0)}%
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
            <div
              className={`${barColor} h-full rounded-full transition-all duration-300`}
              style={{ width: `${percentage}%` }}
            />
          </div>
          {isOverBudget && (
            <p className="text-xs text-destructive">חריגה מההיקף המוגדר</p>
          )}
        </div>
      </div>
    );
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
      <div className="px-4 py-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
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
                  <label className="block text-sm font-medium text-muted-foreground">
                    לקוח
                  </label>
                  <input
                    type="text"
                    value={project.clientName}
                    disabled
                    className="mt-1 block w-full rounded-[14px] border border-border bg-muted px-3 py-2 text-muted-foreground"
                  />
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
                        className="mt-1 block w-full rounded-[14px] border border-border px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary"
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
                <dt className="text-sm font-medium text-muted-foreground">מודל תמחור</dt>
                <dd className="mt-1 text-sm text-foreground">
                  {getPricingModelLabel(project.pricingModel)}
                </dd>
              </div>

              <div>
                <dt className="text-sm font-medium text-muted-foreground">פירוט תמחור</dt>
                <dd className="mt-1 text-sm text-foreground">
                  {formatPricingDetails(project)}
                </dd>
              </div>

              {/* Budget Progress Bar */}
              {!statsLoading && renderProgressBar(getBudgetProgress())}

              <div>
                <dt className="text-sm font-medium text-muted-foreground">סטטוס</dt>
                <dd className="mt-1">
                  <span className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${getStatusColor(project.status)}`}>
                    {getStatusLabel(project.status)}
                  </span>
                </dd>
              </div>

              <div>
                <dt className="text-sm font-medium text-muted-foreground">מטבע</dt>
                <dd className="mt-1 text-sm text-foreground">
                  {getCurrencySymbol(project.currency)} - {project.currency}
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
        </div>
      </div>
    </AppLayout>
  );
}
