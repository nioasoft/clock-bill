"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/src/i18n/navigation";
import { useTimer } from "@/contexts/timer-context";
import { AppLayout } from "@/components/app-layout";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { SimpleSelect } from "@/components/ui/simple-select";
import { MonthField } from "@/components/ui/month-field";
import { Clock, Lock, Pencil, Trash2 } from "lucide-react";
import { showSuccessToast, showErrorToast } from "@/lib/toast";
import { messageForError } from "@/lib/api-error";
import { validateRequired, validateDate, validateNumber } from "@/lib/validation";
import { useValidationMessage } from "@/lib/validation-messages";
import { pickDefaultHourlyRate, type ClientRate } from "@/lib/schemas/rates";
import { calcHourlyAmount, calcItemAmount } from "@/lib/money";
import { formatCurrency } from "@/lib/currency";
import { useKeyboardShortcut } from "@/hooks/use-keyboard-shortcut";
import { useClients, useProjects } from "@/hooks/use-clients";
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

// Stable empty defaults — a fresh `[]` per render would change identity and
// re-trigger the rates effect (which depends on `projects`).
const EMPTY_PROJECTS: Project[] = [];
const EMPTY_CLIENTS: Client[] = [];

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
  unit?: string | null;
  quantity?: number | null;
  itemRef?: number | null;
  currency?: string;
  chargeDocumentId?: string | null;
  chargeDocNumber?: number | null;
  chargeDocStatus?: "pending" | "paid" | "canceled" | null;
}

/** First/last day of a date's month + its YYYY-MM key, as local-date strings. */
function monthRange(d: Date): { start: string; end: string; key: string } {
  const y = d.getFullYear();
  const m = d.getMonth();
  const fmt = (x: Date) =>
    `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  return {
    start: fmt(new Date(y, m, 1)),
    end: fmt(new Date(y, m + 1, 0)),
    key: `${y}-${String(m + 1).padStart(2, "0")}`,
  };
}

/** Un-rounded billed amount for an entry (records log shows actual worked value). */
function entryAmount(entry: TimeEntry): number {
  return entry.billingKind === "item"
    ? calcItemAmount(entry.quantity, entry.rate)
    : calcHourlyAmount(entry.duration, entry.rate);
}

/** Sentinel rateId for "+ פריט חד-פעמי…" (an ad-hoc, typed item not in the catalog). */
const ADHOC = "__adhoc__";

/**
 * Sentinel rateId for an edited hourly entry whose rate snapshot has no matching
 * catalog rate (it came from the profile/project default cascade, or the catalog
 * rate was deleted/renamed). Lets the picker show the entry's own rate as a
 * selected option so the price stays visible — never silently blank on edit.
 */
const SNAPSHOT_RATE = "__entry_snapshot__";

interface GroupedProjects {
  [clientId: string]: {
    clientName: string;
    projects: Project[];
  };
}

export default function EntriesPage() {
  const t = useTranslations("Entries");
  const tRoot = useTranslations();
  const locale = useLocale();
  const intlLocale = locale === "en" ? "en-US" : "he-IL";
  const resolveValidation = useValidationMessage();
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(true);
  // Shared, cache-deduped lists (one fetch per app, reused across navigation).
  // Stable empty defaults keep array identity constant while loading.
  const { data: projectsData, isPending: projectsLoading } = useProjects<Project>();
  const { data: clientsData, isPending: clientsLoading } = useClients<Client>();
  const projects = projectsData ?? EMPTY_PROJECTS;
  const clients = clientsData ?? EMPTY_CLIENTS;
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  // Two-step form selection: with several clients, pick the client first and
  // see only its projects (mirrors the timer start modal).
  const [formClientId, setFormClientId] = useState("");
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
    adhocName: "",
    adhocUnit: "",
    adhocPrice: "",
    saveItemToClient: false,
  });
  const [formTasks, setFormTasks] = useState<TaskOption[]>([]);
  const [formRates, setFormRates] = useState<ClientRate[]>([]);
  const [ratesLoaded, setRatesLoaded] = useState(false);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<TimeEntry | null>(null);

  // Field validation errors
  const [fieldErrors, setFieldErrors] = useState<{
    projectId?: string;
    date?: string;
    duration?: string;
    description?: string;
    adhocName?: string;
    adhocPrice?: string;
  }>({});
  const [deleting, setDeleting] = useState(false);
  // Default to the current month — the user can widen/change the range.
  const [filters, setFilters] = useState(() => {
    const { start, end } = monthRange(new Date());
    return { clientId: "", projectId: "", startDate: start, endDate: end };
  });
  const [showFilters, setShowFilters] = useState(false);

  /** Set the date range to a chosen month (YYYY-MM from <input type="month">). */
  const handleMonthChange = (key: string) => {
    if (!key) return;
    const [y, m] = key.split("-").map(Number);
    const { start, end } = monthRange(new Date(y, m - 1, 1));
    setFilters((prev) => ({ ...prev, startDate: start, endDate: end }));
  };

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

  // Escape closes the form via the Dialog's own onOpenChange — no shortcut needed.

  // Fetch entries for the current filters. `silent` skips the loading state so a
  // background refresh (e.g. after a timer stops) doesn't flash the whole table.
  const fetchEntries = useCallback(
    async (opts?: { silent?: boolean }) => {
      try {
        if (!opts?.silent) setEntriesLoading(true);

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
        if (!opts?.silent) setEntriesLoading(false);
      }
    },
    [filters]
  );

  // Fetch entries on mount and whenever filters change.
  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  // Refetch when a timer is stopped elsewhere (e.g. the persistent timer bar),
  // so the just-saved record appears without a manual page refresh.
  const { onTimerStopped } = useTimer();
  useEffect(() => {
    return onTimerStopped(() => {
      fetchEntries({ silent: true });
    });
  }, [onTimerStopped, fetchEntries]);

  // Fetch tasks when project changes in form
  useEffect(() => {
    if (!formData.projectId) {
      setFormTasks([]);
      return;
    }
    const fetchTasks = async () => {
      try {
        // Tasks are now global (Kanban board), filtered by project. The old
        // per-project /api/projects/[id]/tasks endpoint was removed.
        const response = await fetch(`/api/tasks?projectId=${formData.projectId}`);
        const data = await response.json();
        if (data.success) {
          // Only show todo/in_progress tasks; task `title` replaces the old `name`.
          setFormTasks(
            (data.tasks || [])
              .filter((t: { status: string }) => t.status !== "done")
              .map((t: { id: string; title: string }) => ({ id: t.id, name: t.title }))
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
      setRatesLoaded(false);
      return;
    }
    let cancelled = false;
    setRatesLoaded(false);
    (async () => {
      try {
        // projectId narrows to general rates + ones scoped to this project.
        const res = await fetch(
          `/api/clients/${clientId}/rates?projectId=${encodeURIComponent(formData.projectId)}`
        );
        const data = await res.json();
        if (cancelled || !data.success) return;
        setFormRates(data.rates as ClientRate[]);
      } catch (error) {
        console.error("Error fetching rates for entry:", error);
      } finally {
        if (!cancelled) setRatesLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [formData.projectId, projects]);

  // Preselect a rate/item once rates load (or kind changes). When editing, match
  // the entry's snapshotted label first; otherwise pick the default/first of the kind.
  useEffect(() => {
    if (!ratesLoaded) return; // wait until we actually know this client's rates
    setFormData((p) => {
      if (p.billingKind === "hourly") {
        const pool = formRates.filter((r) => r.kind === "hourly");
        if (pool.some((r) => r.id === p.rateId)) return p; // keep a still-valid selection
        if (editingEntry?.rateLabel) {
          const match = pool.find((r) => r.name === editingEntry.rateLabel);
          if (match) return { ...p, rateId: match.id };
        }
        // Editing without a catalog match: select the snapshot sentinel so the
        // picker shows the entry's own rate (visible + preserved on submit),
        // never silently swapping it for a different default.
        if (editingEntry) {
          return { ...p, rateId: editingEntry.rate != null ? SNAPSHOT_RATE : "" };
        }
        // New entry: default to the cascade's hourly rate.
        return { ...p, rateId: pickDefaultHourlyRate(formRates)?.id ?? "" };
      }
      // item mode: keep a still-valid selection (including the ad-hoc sentinel)
      const items = formRates.filter((r) => r.kind === "item");
      if (p.rateId === ADHOC || items.some((r) => r.id === p.rateId)) return p;
      // editing an item line: match the snapshot to a catalog item, else ad-hoc-prefill it
      if (editingEntry?.billingKind === "item" && editingEntry.rateLabel) {
        const match = items.find((r) => r.name === editingEntry.rateLabel);
        if (match) return { ...p, rateId: match.id };
        return {
          ...p,
          rateId: ADHOC,
          adhocName: editingEntry.rateLabel ?? "",
          adhocUnit: editingEntry.unit ?? "",
          adhocPrice: editingEntry.rate != null ? String(editingEntry.rate) : "",
        };
      }
      // new item line: first catalog item, or ad-hoc when the client has none
      return { ...p, rateId: items[0]?.id ?? ADHOC };
    });
  }, [formRates, ratesLoaded, formData.billingKind, editingEntry]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setFieldErrors({});

    // Validate form fields
    const errors: typeof fieldErrors = {};

    // Validate project
    const projectValidation = validateRequired(formData.projectId, "project");
    if (!projectValidation.isValid) {
      errors.projectId = resolveValidation(projectValidation.code);
    }

    // Validate date
    const dateValidation = validateDate(formData.date, true);
    if (!dateValidation.isValid) {
      errors.date = resolveValidation(dateValidation.code);
    }

    // Validate duration (hours) or quantity + item selection (item)
    if (formData.billingKind === "item") {
      const q = parseFloat(formData.quantity);
      if (!formData.quantity || isNaN(q) || q <= 0) {
        errors.duration = t("validation.quantityInvalid");
      } else if (!formData.rateId) {
        errors.duration = t("validation.selectItem");
      }
      // Ad-hoc item: name + unit price are required.
      if (formData.rateId === ADHOC) {
        const price = parseFloat(formData.adhocPrice);
        if (!formData.adhocName.trim()) {
          errors.adhocName = t("validation.itemNameRequired");
        }
        if (formData.adhocPrice === "" || isNaN(price) || price < 0) {
          errors.adhocPrice = t("validation.unitPriceRequired");
        }
      }
    } else {
      const durationValidation = validateNumber(formData.duration, true, 1);
      if (!durationValidation.isValid) {
        errors.duration = resolveValidation(durationValidation.code);
      }
    }

    // Validate description
    const descValidation = validateRequired(formData.description, "description");
    if (!descValidation.isValid) {
      errors.description = resolveValidation(descValidation.code);
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

      const isItem = formData.billingKind === "item";
      const isAdhoc = isItem && formData.rateId === ADHOC;
      const chosen = formRates.find((r) => r.id === formData.rateId);
      // Ad-hoc lines carry typed name+price; catalog lines snapshot the chosen
      // rate. When editing and no catalog rate is chosen (rate deleted/renamed,
      // or it came from the profile default and never had a catalog entry), fall
      // back to the entry's own snapshot so editing other fields never zeroes it.
      const itemRate = isAdhoc ? parseFloat(formData.adhocPrice) || 0 : chosen?.rate ?? editingEntry?.rate ?? null;
      const itemLabel = isAdhoc ? formData.adhocName.trim() : chosen?.name ?? editingEntry?.rateLabel ?? null;
      // Ad-hoc items carry a typed unit noun ("יום"/"פגישה"); empty → null.
      // Catalog items snapshot the chosen rate's unit.
      const itemUnit = isAdhoc ? (formData.adhocUnit.trim() || null) : chosen?.unit ?? null;
      // Hourly lines snapshot the chosen hourly rate/label so the amount survives
      // create AND edit. Sending null here zeroes the entry's price (regression),
      // so fall back to the entry's own snapshot when nothing is chosen on edit.
      const hourlyRate = chosen?.rate ?? editingEntry?.rate ?? null;
      const hourlyLabel = chosen?.name ?? editingEntry?.rateLabel ?? null;

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
          rate: isItem ? itemRate : hourlyRate,
          rateLabel: isItem ? itemLabel : hourlyLabel,
          unit: isItem ? itemUnit : null,
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

        // Optionally persist an ad-hoc item to the client for reuse. Best-effort:
        // the entry is already saved, so a failure here only warns — it never
        // rolls back the entry.
        if (isAdhoc && formData.saveItemToClient) {
          const clientId = projects.find((p) => p.id === formData.projectId)?.clientId;
          if (clientId) {
            try {
              const r = await fetch(`/api/clients/${clientId}/rates`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: itemLabel, rate: itemRate, unit: itemUnit }),
              });
              const rd = await r.json();
              if (rd.success) {
                showSuccessToast(rd.created ? t("toast.itemSaved") : t("toast.itemAlreadyExists"));
              } else {
                showErrorToast(t("toast.itemNotSaved"));
              }
            } catch (err) {
              console.error("Error saving item to client:", err);
              showErrorToast(t("toast.itemNotSaved"));
            }
          }
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
          adhocName: "",
          adhocUnit: "",
          adhocPrice: "",
          saveItemToClient: false,
        });
        setShowForm(false);
        setEditingEntry(null);
        setFieldErrors({});
      } else {
        setFormError(
          data.error_code
            ? messageForError(data, tRoot)
            : isEditing
              ? t("error.update")
              : t("error.create")
        );
      }
    } catch (error) {
      console.error("Error saving entry:", error);
      setFormError(editingEntry ? t("error.update") : t("error.create"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (entry: TimeEntry) => {
    // Entries claimed by a charge document are locked (edit + delete). The
    // buttons are already disabled; this guards any other call path.
    if (entry.chargeDocumentId) {
      showErrorToast(t("entry.billedLocked", { number: entry.chargeDocNumber ?? 0 }));
      return;
    }
    setEditingEntry(entry);
    setFormClientId(entry.clientId);
    setFormData({
      projectId: entry.projectId,
      taskId: entry.taskId || "",
      date: entry.date.includes("T") ? entry.date.split("T")[0] : entry.date,
      duration: entry.duration.toString(),
      description: entry.description,
      notes: entry.notes || "",
      isBillable: entry.isBillable,
      billingKind: entry.billingKind ?? "hourly",
      rateId: "", // resolved by the preselect effect (matches rateLabel, else ad-hoc)
      quantity: entry.quantity?.toString() ?? "",
      adhocName: "", // filled by the preselect effect when the item isn't in the catalog
      adhocUnit: "", // ditto
      adhocPrice: "",
      saveItemToClient: false,
    });
    setShowForm(true);
  };

  const handleCancelEdit = () => {
    setEditingEntry(null);
    setFormClientId("");
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
      adhocName: "",
      adhocUnit: "",
      adhocPrice: "",
      saveItemToClient: false,
    });
    setShowForm(false);
  };

  // Open a fresh manual-entry form directly in the requested mode. Lets the
  // header (and dashboard deep-links) jump straight to "hours" or "item" without
  // making the user open the form and then flip the toggle.
  const openManualEntry = useCallback((kind: "hourly" | "item") => {
    setEditingEntry(null);
    setFormClientId("");
    setFormData({
      projectId: "",
      taskId: "",
      date: new Date().toISOString().split("T")[0],
      duration: "",
      description: "",
      notes: "",
      isBillable: true,
      billingKind: kind,
      rateId: "",
      quantity: "",
      adhocName: "",
      adhocUnit: "",
      adhocPrice: "",
      saveItemToClient: false,
    });
    setFieldErrors({});
    setShowForm(true);
  }, []);

  // Deep link: /entries?new=item or ?new=manual opens the form in that mode
  // (used by the dashboard quick actions). Cleans the URL afterwards.
  useEffect(() => {
    const mode = new URLSearchParams(window.location.search).get("new");
    if (mode === "item") openManualEntry("item");
    else if (mode === "manual") openManualEntry("hourly");
    if (mode) window.history.replaceState({}, "", "/entries");
  }, [openManualEntry]);

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
        // Delete is only reachable from within the edit form — close it on success.
        setShowForm(false);
        setEditingEntry(null);
        showSuccessToast(t("toast.deleted"));
      } else {
        showErrorToast(data.error_code ? messageForError(data, tRoot) : t("error.delete"));
      }
    } catch (error) {
      console.error("Error deleting entry:", error);
      showErrorToast(t("error.delete"));
    } finally {
      setDeleting(false);
    }
  };

  const cancelDelete = () => {
    setEntryToDelete(null);
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    const { start, end } = monthRange(new Date());
    setFilters({ clientId: "", projectId: "", startDate: start, endDate: end });
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

  // Clients that actually have projects (a timer/entry must attach to a project).
  const formClients = Object.entries(groupedProjects).map(([id, group]) => ({
    id,
    name: group.clientName,
  }));
  const formMultiClient = formClients.length > 1;
  const formProjects = formMultiClient
    ? formClientId
      ? projects.filter((p) => p.clientId === formClientId)
      : []
    : projects;

  return (
    <AppLayout>
      <PageContainer>
        <PageHeader title={t("pageTitle")}>
          <kbd className="hidden sm:inline-block px-2 py-1 text-xs font-semibold text-muted-foreground bg-muted border border-border rounded">N</kbd>
          <button
            onClick={() => openManualEntry("hourly")}
            className="rounded-[var(--radius-card)] bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
          >
            {t("addTimeEntry")}
          </button>
          <button
            onClick={() => openManualEntry("item")}
            className="rounded-[var(--radius-card)] border border-border px-4 py-2 text-foreground hover:bg-surface"
          >
            {t("addBillingItem")}
          </button>
        </PageHeader>

        {/* Filters Section */}
        <div className="mb-6 rounded-[var(--radius-card)] border border-border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <label htmlFor="filterMonth" className="text-sm font-medium text-foreground">{t("filters.month")}</label>
              <MonthField
                id="filterMonth"
                locale={locale}
                ariaLabel={t("filters.month")}
                value={filters.startDate ? filters.startDate.slice(0, 7) : ""}
                onChange={handleMonthChange}
              />
              {(filters.clientId || filters.projectId) && (
                <span className="bg-secondary text-secondary-foreground rounded-full text-xs px-2 py-0.5 font-semibold">
                  {[filters.clientId, filters.projectId].filter(Boolean).length}
                </span>
              )}
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="min-h-[44px] px-4 py-2 text-sm font-medium text-primary hover:bg-primary-light rounded-[var(--radius-card)] transition-colors"
            >
              {showFilters ? t("filters.hideAdvanced") : t("filters.advanced")}
            </button>
          </div>

          {showFilters && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label htmlFor="filterClient" className="block text-sm font-medium text-foreground mb-1">
                  {t("filters.client")}
                </label>
                <SimpleSelect
                  id="filterClient"
                  value={filters.clientId}
                  onChange={(v) => {
                    handleFilterChange("clientId", v);
                    handleFilterChange("projectId", ""); // Reset project when client changes
                  }}
                  disabled={clientsLoading}
                  options={[
                    { value: "", label: t("filters.allClients") },
                    ...clients.map((client) => ({
                      value: client.id,
                      label: client.name,
                    })),
                  ]}
                />
              </div>

              <div>
                <label htmlFor="filterProject" className="block text-sm font-medium text-foreground mb-1">
                  {t("filters.project")}
                </label>
                <SimpleSelect
                  id="filterProject"
                  value={filters.projectId}
                  onChange={(v) => handleFilterChange("projectId", v)}
                  disabled={projectsLoading}
                  options={[
                    { value: "", label: t("filters.allProjects") },
                    ...getFilteredProjects().map((project) => ({
                      value: project.id,
                      label: project.name,
                    })),
                  ]}
                />
              </div>

              <div>
                <label htmlFor="filterStartDate" className="block text-sm font-medium text-foreground mb-1">
                  {t("filters.startDate")}
                </label>
                <input
                  type="date"
                  id="filterStartDate"
                  value={filters.startDate}
                  onChange={(e) => handleFilterChange("startDate", e.target.value)}
                  className="block w-full rounded-[var(--radius)] border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label htmlFor="filterEndDate" className="block text-sm font-medium text-foreground mb-1">
                  {t("filters.endDate")}
                </label>
                <input
                  type="date"
                  id="filterEndDate"
                  value={filters.endDate}
                  onChange={(e) => handleFilterChange("endDate", e.target.value)}
                  className="block w-full rounded-[var(--radius)] border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="sm:col-span-2 lg:col-span-4 flex justify-end">
                <button
                  onClick={clearFilters}
                  className="rounded-[var(--radius-card)] border border-border px-4 py-2 text-sm text-foreground hover:bg-muted"
                >
                  {t("filters.clear")}
                </button>
              </div>
            </div>
          )}

          {/* Active filters — client/project only; the month picker owns the date range */}
          {(filters.clientId || filters.projectId) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {filters.clientId && (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 ps-3 pe-1.5 py-1 text-sm text-primary">
                  {clients.find((c) => c.id === filters.clientId)?.name}
                  <button
                    onClick={() => handleFilterChange("clientId", "")}
                    className="flex h-5 w-5 items-center justify-center rounded-full text-primary/70 hover:bg-primary/20 hover:text-primary"
                    aria-label={t("filters.removeClientFilter")}
                  >
                    ×
                  </button>
                </span>
              )}
              {filters.projectId && (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 ps-3 pe-1.5 py-1 text-sm text-primary">
                  {projects.find((p) => p.id === filters.projectId)?.name}
                  <button
                    onClick={() => handleFilterChange("projectId", "")}
                    className="flex h-5 w-5 items-center justify-center rounded-full text-primary/70 hover:bg-primary/20 hover:text-primary"
                    aria-label={t("filters.removeProjectFilter")}
                  >
                    ×
                  </button>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Add/Edit Entry Form — bottom sheet on mobile, centered dialog on desktop */}
        <Dialog
          open={showForm}
          onOpenChange={(open) => {
            if (!open) handleCancelEdit();
          }}
        >
          <DialogContent variant="sheet" showCloseButton={false} className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingEntry
                  ? formData.billingKind === "item"
                    ? t("form.editItemTitle")
                    : t("form.editTitle")
                  : formData.billingKind === "item"
                    ? t("form.newItemTitle")
                    : t("form.newTitle")}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              {formError && (
                <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-x-3 gap-y-4">
                {formMultiClient && (
                  <div className="col-span-2">
                    <label htmlFor="formClientId" className="block text-sm font-medium text-foreground">
                      {t("form.clientLabel")}
                    </label>
                    <SimpleSelect
                      id="formClientId"
                      value={formClientId}
                      onChange={(v) => {
                        setFormClientId(v);
                        // The previous project belongs to another client now.
                        setFormData({ ...formData, projectId: "", taskId: "" });
                      }}
                      placeholder={t("form.selectClient")}
                      className="mt-1"
                      disabled={submitting || projectsLoading}
                      options={formClients.map((client) => ({
                        value: client.id,
                        label: client.name,
                      }))}
                    />
                  </div>
                )}

                <div className="col-span-2">
                  <label htmlFor="projectId" className="block text-sm font-medium text-foreground">
                    {t("form.projectLabel")}
                  </label>
                  <SimpleSelect
                    id="projectId"
                    value={formData.projectId}
                    onChange={(v) => setFormData({ ...formData, projectId: v, taskId: "" })}
                    placeholder={
                      formMultiClient && !formClientId
                        ? t("form.selectClientFirst")
                        : t("form.selectProject")
                    }
                    className={`mt-1 ${fieldErrors.projectId ? "border-destructive" : ""}`}
                    disabled={submitting || projectsLoading || (formMultiClient && !formClientId)}
                    options={formProjects.map((project) => ({
                      value: project.id,
                      label: project.name,
                    }))}
                  />
                  {fieldErrors.projectId && (
                    <p className="mt-1 text-xs text-destructive">{fieldErrors.projectId}</p>
                  )}
                  {projects.length === 0 && !projectsLoading && (
                    <Link
                      href="/projects?create=true"
                      className="mt-1 inline-block text-xs text-primary hover:text-primary/90"
                    >
                      {t("form.createProject")}
                    </Link>
                  )}
                </div>

                {formData.projectId && formTasks.length > 0 && (
                  <div className="col-span-2">
                    <label htmlFor="taskId" className="block text-sm font-medium text-foreground">
                      {t("form.taskLabel")}
                    </label>
                    <SimpleSelect
                      id="taskId"
                      value={formData.taskId}
                      onChange={(v) => setFormData({ ...formData, taskId: v })}
                      className="mt-1"
                      disabled={submitting}
                      options={[
                        { value: "", label: t("form.noTask") },
                        ...formTasks.map((task) => ({
                          value: task.id,
                          label: task.name,
                        })),
                      ]}
                    />
                  </div>
                )}

                <div>
                  <label htmlFor="date" className="block text-sm font-medium text-foreground">
                    {t("form.dateLabel")}
                  </label>
                  <input
                    type="date"
                    id="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className={`mt-1 block w-full rounded-[var(--radius)] px-3 py-2 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 ${fieldErrors.date ? "border border-destructive" : "border border-border"}`}
                    disabled={submitting}
                  />
                  {fieldErrors.date && (
                    <p className="mt-1 text-xs text-destructive">{fieldErrors.date}</p>
                  )}
                </div>

                {/* Billing type toggle: hours vs item — pairs beside the date field */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">{t("form.kindLabel")}</label>
                  <div className="flex w-full rounded-[var(--radius)] border border-border p-0.5">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, billingKind: "hourly", rateId: "" })}
                      className={`flex-1 min-h-[40px] px-2 py-1.5 text-sm rounded ${formData.billingKind === "hourly" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                      disabled={submitting}
                    >
                      {t("form.kindHours")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, billingKind: "item", rateId: "" })}
                      className={`flex-1 min-h-[40px] px-2 py-1.5 text-sm rounded ${formData.billingKind === "item" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                      disabled={submitting}
                    >
                      {t("form.kindItem")}
                    </button>
                  </div>
                </div>

                {formData.billingKind === "hourly" ? (
                  <>
                    <div>
                      <label htmlFor="duration" className="block text-sm font-medium text-foreground">
                        {t("form.durationLabel")}
                      </label>
                      <input
                        type="number"
                        id="duration"
                        min="1"
                        step="1"
                        value={formData.duration}
                        onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                        className={`mt-1 block w-full rounded-[var(--radius)] px-3 py-2 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 ${fieldErrors.duration ? "border border-destructive" : "border border-border"}`}
                        disabled={submitting}
                        placeholder={t("form.durationPlaceholder")}
                      />
                      {fieldErrors.duration && (
                        <p className="mt-1 text-xs text-destructive">{fieldErrors.duration}</p>
                      )}
                      <p className="mt-1 text-xs text-muted-foreground">{t("form.durationHelp")}</p>
                    </div>

                    {(formRates.some((r) => r.kind === "hourly") ||
                      (formData.rateId === SNAPSHOT_RATE && editingEntry)) && (
                      <div className="col-span-2">
                        <label htmlFor="entryRate" className="block text-sm font-medium text-foreground">
                          {t("form.rateLabel")}
                        </label>
                        <SimpleSelect
                          id="entryRate"
                          value={formData.rateId}
                          onChange={(v) => setFormData({ ...formData, rateId: v })}
                          className="mt-1"
                          disabled={submitting}
                          options={[
                            // The edited entry's own rate snapshot, shown when it
                            // has no catalog match (default-cascade or deleted rate)
                            // so the price stays visible and selectable.
                            ...(formData.rateId === SNAPSHOT_RATE && editingEntry
                              ? [{
                                  value: SNAPSHOT_RATE,
                                  label: t("form.hourlyRateOption", {
                                    name: editingEntry.rateLabel ?? "—",
                                    rate: editingEntry.rate ?? 0,
                                  }),
                                }]
                              : []),
                            ...formRates
                              .filter((r) => r.kind === "hourly")
                              .map((r) => ({
                                value: r.id,
                                label: t("form.hourlyRateOption", { name: r.name, rate: r.rate }),
                              })),
                          ]}
                        />
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="col-span-2">
                      <label htmlFor="entryItem" className="block text-sm font-medium text-foreground">
                        {t("form.itemLabel")}
                      </label>
                      <SimpleSelect
                        id="entryItem"
                        value={formData.rateId}
                        onChange={(v) => setFormData({ ...formData, rateId: v })}
                        className={`mt-1 ${fieldErrors.duration ? "border-destructive" : ""}`}
                        disabled={submitting}
                        options={[
                          { value: ADHOC, label: t("form.adhocOption") },
                          ...formRates
                            .filter((r) => r.kind === "item")
                            .map((r) => ({
                              value: r.id,
                              label: t("form.itemRateOption", { name: r.name, rate: r.rate }),
                            })),
                        ]}
                      />
                    </div>

                    {/* Ad-hoc item: typed name + unit price, optionally saved to the client */}
                    {formData.rateId === ADHOC && (
                      <>
                        <datalist id="unit-suggestions">
                          {(tRoot.raw("Units.suggestions") as string[]).map((u) => (
                            <option key={u} value={u} />
                          ))}
                        </datalist>
                        <div className="col-span-2">
                          <label htmlFor="adhocName" className="block text-sm font-medium text-foreground">
                            {t("form.adhocNameLabel")}
                          </label>
                          <input
                            type="text"
                            id="adhocName"
                            value={formData.adhocName}
                            onChange={(e) => setFormData({ ...formData, adhocName: e.target.value })}
                            className={`mt-1 block w-full rounded-[var(--radius)] px-3 py-2 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 ${fieldErrors.adhocName ? "border border-destructive" : "border border-border"}`}
                            disabled={submitting}
                            placeholder={t("form.adhocNamePlaceholder")}
                          />
                          {fieldErrors.adhocName && (
                            <p className="mt-1 text-xs text-destructive">{fieldErrors.adhocName}</p>
                          )}
                        </div>

                        <div>
                          <label htmlFor="adhocUnit" className="block text-sm font-medium text-foreground">
                            {t("form.adhocUnitLabel")}
                          </label>
                          <input
                            type="text"
                            id="adhocUnit"
                            list="unit-suggestions"
                            value={formData.adhocUnit}
                            onChange={(e) => setFormData({ ...formData, adhocUnit: e.target.value })}
                            className="mt-1 block w-full rounded-[var(--radius)] border border-border px-3 py-2 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                            disabled={submitting}
                            maxLength={30}
                            placeholder={t("form.adhocUnitPlaceholder")}
                          />
                        </div>

                        <div>
                          <label htmlFor="adhocPrice" className="block text-sm font-medium text-foreground">
                            {t("form.adhocPriceLabel")}
                          </label>
                          <input
                            type="number"
                            id="adhocPrice"
                            min="0"
                            step="0.01"
                            value={formData.adhocPrice}
                            onChange={(e) => setFormData({ ...formData, adhocPrice: e.target.value })}
                            className={`mt-1 block w-full rounded-[var(--radius)] px-3 py-2 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 ${fieldErrors.adhocPrice ? "border border-destructive" : "border border-border"}`}
                            disabled={submitting}
                            placeholder={t("form.adhocPricePlaceholder")}
                          />
                          {fieldErrors.adhocPrice && (
                            <p className="mt-1 text-xs text-destructive">{fieldErrors.adhocPrice}</p>
                          )}
                        </div>

                        <div className="self-end">
                          <label htmlFor="saveItemToClient" className="flex items-center gap-2 cursor-pointer min-h-[44px]">
                            <input
                              type="checkbox"
                              id="saveItemToClient"
                              checked={formData.saveItemToClient}
                              onChange={(e) => setFormData({ ...formData, saveItemToClient: e.target.checked })}
                              className="h-5 w-5 rounded border-border text-primary focus:ring-primary"
                              disabled={submitting}
                            />
                            <span className="text-sm text-muted-foreground">{t("form.saveItemToClient")}</span>
                          </label>
                        </div>
                      </>
                    )}

                    <div>
                      <label htmlFor="quantity" className="block text-sm font-medium text-foreground">
                        {t("form.quantityLabel")}
                      </label>
                      <input
                        type="number"
                        id="quantity"
                        min="0"
                        step="1"
                        value={formData.quantity}
                        onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                        className={`mt-1 block w-full rounded-[var(--radius)] px-3 py-2 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 ${fieldErrors.duration ? "border border-destructive" : "border border-border"}`}
                        disabled={submitting}
                      />
                      {fieldErrors.duration && (
                        <p className="mt-1 text-xs text-destructive">{fieldErrors.duration}</p>
                      )}
                    </div>
                  </>
                )}

                <div className="flex items-center self-end">
                  <label htmlFor="isBillable" className="flex items-center gap-2 cursor-pointer min-h-[44px]">
                    <input
                      type="checkbox"
                      id="isBillable"
                      checked={formData.isBillable}
                      onChange={(e) => setFormData({ ...formData, isBillable: e.target.checked })}
                      className="h-5 w-5 rounded border-border text-primary focus:ring-primary"
                      disabled={submitting}
                    />
                    <span className="text-sm font-medium text-foreground">{t("form.billable")}</span>
                  </label>
                </div>

                <div className="col-span-2">
                  <label htmlFor="description" className="block text-sm font-medium text-foreground">
                    {formData.billingKind === "item" ? t("form.detailLabel") : t("form.descriptionLabel")}
                  </label>
                  <input
                    type="text"
                    id="description"
                    required
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className={`mt-1 block w-full rounded-[var(--radius)] px-3 py-2 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 ${fieldErrors.description ? "border border-destructive" : "border border-border"}`}
                    disabled={submitting}
                    placeholder={
                      formData.billingKind === "item"
                        ? t("form.detailPlaceholder")
                        : t("form.descriptionPlaceholder")
                    }
                  />
                  {fieldErrors.description && (
                    <p className="mt-1 text-xs text-destructive">{fieldErrors.description}</p>
                  )}
                </div>

                <div className="col-span-2">
                  <label htmlFor="notes" className="block text-sm font-medium text-foreground">
                    {t("form.notesLabel")}
                  </label>
                  <textarea
                    id="notes"
                    rows={3}
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="mt-1 block w-full rounded-[var(--radius)] border border-border px-3 py-2 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    disabled={submitting}
                    placeholder={t("form.notesPlaceholder")}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-2">
                {/* Delete lives inside edit only — a quiet text action, confirmed before it runs */}
                {editingEntry ? (
                  <button
                    type="button"
                    onClick={() => handleDeleteClick(editingEntry)}
                    className="inline-flex items-center gap-1.5 text-sm text-destructive hover:text-destructive/80 transition-colors"
                    disabled={submitting}
                  >
                    <Trash2 className="h-4 w-4" />
                    {t("form.deleteEntry")}
                  </button>
                ) : (
                  <span />
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="rounded-[var(--radius-card)] border border-border px-4 py-2 text-foreground hover:bg-muted"
                    disabled={submitting}
                  >
                    {t("cancel")}
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="rounded-[var(--radius-card)] bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {submitting ? t("form.saving") : editingEntry ? t("form.update") : t("form.save")}
                  </button>
                </div>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Entries List */}
        <div className="rounded-[var(--radius-card)] bg-card shadow">
          {entriesLoading ? (
            <div className="p-8 text-center text-muted-foreground">{t("list.loading")}</div>
          ) : entries.length === 0 ? (
            <div className="relative">
              <EmptyState
                icon={Clock}
                message={t("empty.message")}
                description={t("empty.description")}
                actionLabel={t("empty.action")}
                onAction={() => setShowForm(true)}
              />
              <div className="absolute top-8 start-1/2 -translate-x-1/2 opacity-10 pointer-events-none">
                <HourglassSVG className="w-32 h-32 text-primary" />
              </div>
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full divide-y divide-border">
                  <thead className="bg-surface">
                    <tr>
                      <th className="px-6 py-3 text-start text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {t("table.date")}
                      </th>
                      <th className="px-6 py-3 text-start text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {t("table.description")}
                      </th>
                      <th className="px-6 py-3 text-start text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {t("table.client")}
                      </th>
                      <th className="px-6 py-3 text-start text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {t("table.project")}
                      </th>
                      <th className="px-6 py-3 text-start text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {t("table.durationQuantity")}
                      </th>
                      <th className="px-6 py-3 text-start text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {t("table.amount")}
                      </th>
                      <th className="px-6 py-3 text-start text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {t("table.actions")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-card">
                    {entries.map((entry) => (
                      <tr key={entry.id} className="hover:bg-surface even:bg-surface/50">
                        <td className="whitespace-nowrap px-6 py-4">
                          <div className="text-sm text-foreground">
                            {new Date(entry.date).toLocaleDateString(intlLocale)}
                          </div>
                        </td>
                      <td className="px-6 py-4 max-w-sm">
                        <div className="flex items-center gap-2">
                          {isEntryRunning(entry) && (
                            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success">
                              <span className="relative flex h-1.5 w-1.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success"></span>
                              </span>
                              {t("entry.active")}
                            </span>
                          )}
                          <span className="truncate text-sm font-medium text-foreground">
                            {entry.billingKind === "item" && entry.rateLabel ? entry.rateLabel : entry.description}
                          </span>
                          {!entry.isBillable && (
                            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{t("entry.notBillable")}</span>
                          )}
                          {entry.chargeDocumentId && (
                            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                              <Lock className="h-3 w-3" />
                              {t("entry.billedBadge", { number: entry.chargeDocNumber ?? 0 })}
                            </span>
                          )}
                        </div>
                        {(() => {
                          const sub: string[] = [];
                          if (entry.billingKind === "item" && entry.rateLabel && entry.description) sub.push(entry.description);
                          if (entry.billingKind !== "item" && entry.rateLabel) sub.push(entry.rateLabel);
                          if (entry.notes) sub.push(entry.notes);
                          if (entry.billingKind === "item" && entry.itemRef != null) sub.push(t("entry.reference", { ref: entry.itemRef }));
                          return sub.length ? (
                            <div className="mt-0.5 truncate text-xs text-muted-foreground">{sub.join(" · ")}</div>
                          ) : null;
                        })()}
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
                        <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
                          {entry.billingKind === "item"
                            ? t("entry.quantity", { quantity: entry.quantity ?? 0 })
                            : formatDuration(entry.duration)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
                          {formatCurrency(entryAmount(entry), entry.currency || "ILS", locale)}
                        </span>
                      </td>
                      <td className="w-px whitespace-nowrap px-4 py-4 text-start">
                        <button
                          onClick={() => handleEdit(entry)}
                          disabled={!!entry.chargeDocumentId}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius)] text-muted-foreground transition-colors hover:bg-surface hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
                          aria-label={t("entry.editAria")}
                          title={entry.chargeDocumentId ? t("entry.billedLocked", { number: entry.chargeDocNumber ?? 0 }) : t("entry.editTitle")}
                        >
                          {entry.chargeDocumentId ? <Lock className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-3">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-[var(--radius-card)] border border-border/70 bg-card-elevated p-3.5 shadow-lg shadow-black/40"
                >
                  {/* Top row: date + badges (right) · amount + edit (left) */}
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {new Date(entry.date).toLocaleDateString(intlLocale)}
                      </span>
                      {isEntryRunning(entry) && (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success">
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75"></span>
                            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success"></span>
                          </span>
                          {t("entry.active")}
                        </span>
                      )}
                      {!entry.isBillable && (
                        <span className="inline-flex shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                          {t("entry.notBillable")}
                        </span>
                      )}
                      {entry.chargeDocumentId && (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                          <Lock className="h-3 w-3" />
                          {t("entry.billedBadge", { number: entry.chargeDocNumber ?? 0 })}
                        </span>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="font-mono text-base font-bold tabular-nums text-foreground">
                        {formatCurrency(entryAmount(entry), entry.currency || "ILS", locale)}
                      </span>
                      <button
                        onClick={() => handleEdit(entry)}
                        disabled={!!entry.chargeDocumentId}
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius)] border border-border text-muted-foreground transition-colors hover:bg-surface hover:text-foreground active:bg-surface/80 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
                        aria-label={t("entry.editAria")}
                        title={entry.chargeDocumentId ? t("entry.billedLocked", { number: entry.chargeDocNumber ?? 0 }) : t("entry.editTitle")}
                      >
                        {entry.chargeDocumentId ? <Lock className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Project • client */}
                  <div className="mb-1 flex min-w-0 items-center gap-1.5 text-sm font-semibold text-foreground">
                    <Link href={`/projects/${entry.projectId}`} className="truncate hover:text-primary hover:underline">{entry.projectName}</Link>
                    <span className="shrink-0 text-muted-foreground">•</span>
                    <Link href={`/clients/${entry.clientId}`} className="truncate text-muted-foreground hover:text-primary hover:underline">{entry.clientName}</Link>
                  </div>

                  {/* Item name (item lines) shown prominently */}
                  {entry.billingKind === "item" && entry.rateLabel && (
                    <div className="text-sm font-semibold text-foreground">{entry.rateLabel}</div>
                  )}
                  {/* Description (clamped to keep cards short) */}
                  {entry.description && (
                    <div
                      className={`line-clamp-2 ${
                        entry.billingKind === "item" && entry.rateLabel
                          ? "text-xs text-muted-foreground"
                          : "text-sm text-foreground"
                      }`}
                    >
                      {entry.description}
                    </div>
                  )}
                  {entry.notes && (
                    <div className="line-clamp-1 text-xs text-muted-foreground">{entry.notes}</div>
                  )}

                  {/* Bottom: duration / quantity + rate / reference */}
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="font-mono text-base font-bold tabular-nums text-primary">
                      {entry.billingKind === "item"
                        ? t("entry.quantity", { quantity: entry.quantity ?? 0 })
                        : formatDuration(entry.duration)}
                    </span>
                    {entry.billingKind !== "item" && entry.rateLabel && (
                      <span className="truncate text-xs text-muted-foreground">{entry.rateLabel}</span>
                    )}
                    {entry.billingKind === "item" && entry.itemRef != null && (
                      <span className="font-mono text-xs tabular-nums text-muted-foreground">{t("entry.reference", { ref: entry.itemRef })}</span>
                    )}
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
            <DialogTitle>{t("deleteDialog.title")}</DialogTitle>
            <DialogDescription>
              {t("deleteDialog.body", { description: entryToDelete?.description ?? "" })}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <button
              onClick={cancelDelete}
              disabled={deleting}
              className="rounded-[var(--radius-card)] border border-border px-4 py-2 text-foreground hover:bg-muted disabled:opacity-50"
            >
              {t("cancel")}
            </button>
            <button
              onClick={handleDeleteConfirm}
              disabled={deleting}
              className="rounded-[var(--radius-card)] bg-destructive px-4 py-2 text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
            >
              {deleting ? t("deleteDialog.deleting") : t("deleteDialog.confirm")}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
