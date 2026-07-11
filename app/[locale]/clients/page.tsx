"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Link } from "@/src/i18n/navigation";
import { AppLayout } from "@/components/app-layout";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { PlanUsageBanner } from "@/components/plan-usage-banner";
import { EmptyState } from "@/components/ui/empty-state";
import { ArrowUpLeft, Lock, Mail, Phone, Search, Users } from "lucide-react";
import { showSuccessToast, showErrorToast } from "@/lib/toast";
import { messageForError } from "@/lib/api-error";
import { fieldClass } from "@/lib/form-styles";
import { CURRENCY_SYMBOLS, formatCurrency } from "@/lib/currency";
import { ClientRatesEditor } from "@/components/client-rates-editor";
import { ROUNDING_MODES, type RoundingMode } from "@/lib/rounding";
import { getProfession } from "@/lib/professions";
import { useTranslations, useLocale } from "next-intl";
import { cleanClientRates } from "@/lib/schemas/rates";
import type { ClientRate, ClientRateInput } from "@/lib/schemas/rates";
import {
  validateRequired,
  validateEmail,
  validatePhone,
} from "@/lib/validation";
import { useValidationMessage } from "@/lib/validation-messages";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { SimpleSelect } from "@/components/ui/simple-select";
import { resolveDocumentLocale } from "@/lib/document-language";
import { useProfile } from "@/hooks/use-profile";
import { useQueryClient } from "@tanstack/react-query";
import { clientsQueryKey } from "@/hooks/use-clients";
import { Button } from "@/components/ui/button";

interface Client {
  id: string;
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  defaultRate: number | null;
  currency: string;
  billingRounding: string | null;
  isRetainer: boolean;
  retainerHours: number | null;
  retainerMonthlyFee: number | null;
  overageRate: number | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  unbilledTotal: number;
  outstandingTotal: number;
  paidTotal: number;
  hasOtherCurrency: boolean;
  totalHours: number;
  projectCount: number;
  activeProjectCount: number;
  documentLanguage: string | null;
  vatMode: string | null;
  settlementBillingDay: number | null;
}

/**
 * One brand-new hourly rate row, preselected as default.
 * The seed name is passed in (translated) by the caller.
 */
const seedRates = (name: string): ClientRateInput[] => [
  { kind: "hourly", name, rate: 0, isDefault: true },
];

const CURRENCIES = [
  { value: "ILS", label: "₪ ILS" },
  { value: "USD", label: "$ USD" },
  { value: "USDT", label: "₮ USDT" },
  { value: "BTC", label: "₿ BTC" },
  { value: "ETH", label: "Ξ ETH" },
] as const;

export default function ClientsPage() {
  return (
    <Suspense>
      <ClientsPageContent />
    </Suspense>
  );
}

function ClientsPageContent() {
  const t = useTranslations("Clients");
  const locale = useLocale();
  const tRoot = useTranslations();
  const tRounding = useTranslations("Rounding");
  const resolveValidation = useValidationMessage();
  const searchParams = useSearchParams();
  const [clients, setClients] = useState<Client[]>([]);
  const [plan, setPlan] = useState<{ activeCount: number; clientLimit: number | null } | null>(null);
  const [lockedIds, setLockedIds] = useState<Set<string>>(new Set());
  const [clientsLoading, setClientsLoading] = useState(true);
  const [clientsLoadError, setClientsLoadError] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [clientFilter, setClientFilter] = useState<"active" | "attention" | "archived">("active");
  const [showForm, setShowForm] = useState(false);
  const [createStep, setCreateStep] = useState<1 | 2 | 3>(1);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  // The user's profession (from their profile) suggests a default billing model.
  // When it's "retainer" we prefill the NEW-client retainer toggle ON (one-time
  // default, never forced — the user's choice always wins).
  const [professionId, setProfessionId] = useState<string | null>(null);
  // Refresh the shared (dropdown) clients cache after local mutations.
  const queryClient = useQueryClient();
  const suggestsRetainer = useMemo(
    () => getProfession(professionId)?.defaults.suggestedBillingModel === "retainer",
    [professionId],
  );
  // True once the user manually toggles the retainer switch in the current
  // create session — after that their choice stands and we never re-prefill.
  const [retainerTouched, setRetainerTouched] = useState(false);
  const starterItems = useMemo(
    () => getProfession(professionId)?.starterItems ?? [],
    [professionId],
  );
  // One-shot per create session — mirrors retainerTouched so the prefill never
  // re-appends after the user removes/edits rows.
  const [starterSeeded, setStarterSeeded] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    contactName: "",
    email: "",
    phone: "",
    address: "",
    defaultRate: "",
    currency: "ILS",
    billingRounding: "" as "" | RoundingMode,
    isRetainer: false,
    retainerHours: "",
    retainerMonthlyFee: "",
    hasOverageRate: false,
    overageRate: "",
    notes: "",
    rates: [] as ClientRateInput[],
    documentLanguage: "" as "" | "he" | "en",
    vatMode: "" as "" | "add" | "exempt",
    settlementBillingDay: null as number | null,
  });
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [ratesLoading, setRatesLoading] = useState(false);
  const [ratesLoadError, setRatesLoadError] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [makingActiveId, setMakingActiveId] = useState<string | null>(null);

  const filteredClients = useMemo(() => {
    const normalizedSearch = clientSearch.trim().toLocaleLowerCase(locale);
    return clients.filter((client) => {
      const matchesFilter =
        clientFilter === "archived"
          ? !client.isActive
          : clientFilter === "attention"
            ? client.isActive && (client.unbilledTotal > 0 || client.outstandingTotal > 0)
            : client.isActive;
      if (!matchesFilter) return false;
      if (!normalizedSearch) return true;
      return [client.name, client.contactName, client.email, client.phone]
        .filter(Boolean)
        .some((value) => value!.toLocaleLowerCase(locale).includes(normalizedSearch));
    });
  }, [clientFilter, clientSearch, clients, locale]);

  // Field validation errors
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    email?: string;
    phone?: string;
    defaultRate?: string;
  }>({});

  // Auto-open create form via URL params (seed one default hourly rate row)
  useEffect(() => {
    if (searchParams.get("create") === "true") {
      setCreateStep(1);
      setFormData((prev) => ({ ...prev, rates: prev.rates.length ? prev.rates : seedRates(t("seedRateName")) }));
      setShowForm(true);
    }
  }, [searchParams, t]);

  // Profession from the shared profile query, used to prefill the retainer toggle.
  const { data: profile } = useProfile();
  useEffect(() => {
    if (profile) setProfessionId(profile.profession ?? null);
  }, [profile]);

  // Create-mode default: once the profession resolves, prefill the retainer
  // toggle ON if it's suggested — but only while the create form is open, the
  // user hasn't touched the toggle, and it isn't already on. This converges
  // (suggestsRetainer changes once; retainerTouched flips on interaction), so
  // there's no render loop, and it never runs in edit mode.
  useEffect(() => {
    if (showForm && editingClient === null && !retainerTouched && suggestsRetainer) {
      setFormData((prev) => (prev.isRetainer ? prev : { ...prev, isRetainer: true }));
    }
  }, [showForm, editingClient, retainerTouched, suggestsRetainer]);

  // Create-mode default: seed the profession's starter item rows once, only if
  // the user hasn't already added an item row. Never runs in edit mode.
  useEffect(() => {
    if (showForm && editingClient === null && !starterSeeded && starterItems.length > 0) {
      setFormData((prev) =>
        prev.rates.some((r) => r.kind === "item")
          ? prev
          : {
              ...prev,
              rates: [
                ...prev.rates,
                ...starterItems.map((s) => ({
                  kind: "item" as const,
                  name: locale === "he" ? s.nameHe : s.nameEn,
                  rate: 0,
                  isDefault: false,
                  unit: locale === "he" ? s.unitHe : s.unitEn,
                })),
              ],
            }
      );
      setStarterSeeded(true);
    }
  }, [showForm, editingClient, starterSeeded, starterItems, locale]);

  useEffect(() => {
    const fetchClients = async () => {
      try {
        setClientsLoading(true);
        setClientsLoadError(false);
        const response = await fetch("/api/clients");
        const data = await response.json();

        if (data.success) {
          setClients(data.clients || []);
          if (data.plan) {
            setPlan({ activeCount: data.plan.activeCount, clientLimit: data.plan.clientLimit });
          }
          setLockedIds(new Set<string>(Array.isArray(data.lockedClientIds) ? (data.lockedClientIds as string[]) : []));
        } else {
          setClientsLoadError(true);
        }
      } catch (error) {
        console.error("Error fetching clients:", error);
        setClientsLoadError(true);
      } finally {
        setClientsLoading(false);
      }
    };

    fetchClients();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setFieldErrors({});

    const isEditing = editingClient !== null;
    if (isEditing && ratesLoading) return;
    if (isEditing && ratesLoadError) {
      setFormError(t("errorLoadRates"));
      return;
    }

    // Validate form fields
    const errors: typeof fieldErrors = {};

    // Name is required
    const nameValidation = validateRequired(formData.name, "clientName");
    if (!nameValidation.isValid) {
      errors.name = resolveValidation(nameValidation.code);
    }

    // Email is optional but must be valid if provided
    if (formData.email && formData.email.trim()) {
      const emailValidation = validateEmail(formData.email, false);
      if (!emailValidation.isValid) {
        errors.email = resolveValidation(emailValidation.code);
      }
    }

    // Phone is optional but must be valid if provided
    if (formData.phone && formData.phone.trim()) {
      const phoneValidation = validatePhone(formData.phone, false);
      if (!phoneValidation.isValid) {
        errors.phone = resolveValidation(phoneValidation.code);
      }
    }

    // If there are errors, display them and don't submit
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    // Rows with a price but no name are likely mistakes — block submit.
    if (formData.rates.some((r) => r.name.trim() === "" && r.rate > 0)) {
      setFormError(t("errorRateNameRequired"));
      return;
    }

    // Clean rates (drop empty-name rows) and guarantee one default hourly.
    const cleanedRates = cleanClientRates(formData.rates);

    setSubmitting(true);

    try {
      const url = isEditing ? `/api/clients/${editingClient.id}` : "/api/clients";
      const method = isEditing ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formData.name,
          contactName: formData.contactName || undefined,
          email: formData.email || undefined,
          phone: formData.phone || undefined,
          address: formData.address || undefined,
          defaultRate: formData.defaultRate ? parseFloat(formData.defaultRate) : undefined,
          currency: formData.currency,
          billingRounding: formData.billingRounding === "" ? null : formData.billingRounding,
          isRetainer: formData.isRetainer,
          retainerHours: formData.isRetainer && formData.retainerHours ? parseFloat(formData.retainerHours) : undefined,
          retainerMonthlyFee: formData.isRetainer && formData.retainerMonthlyFee ? parseFloat(formData.retainerMonthlyFee) : undefined,
          overageRate: formData.isRetainer && formData.hasOverageRate && formData.overageRate ? parseFloat(formData.overageRate) : undefined,
          notes: formData.notes || undefined,
          rates: cleanedRates,
          documentLanguage: formData.documentLanguage === "" ? null : formData.documentLanguage,
          vatMode: formData.vatMode === "" ? null : formData.vatMode,
          settlementBillingDay: formData.settlementBillingDay,
        }),
      });

      const data = await response.json();

      if (data.success) {
        if (isEditing) {
          // Update existing client in the list
          setClients(clients.map((c) => (c.id === data.client.id ? data.client : c)));
        } else {
          // Add the new client to the list
          setClients([data.client, ...clients]);
          // Keep the usage banner fresh (only count genuine creates)
          setPlan((p) => (p ? { ...p, activeCount: p.activeCount + 1 } : p));
        }
        // Refresh the shared clients list used by dropdowns elsewhere.
        void queryClient.invalidateQueries({ queryKey: clientsQueryKey });
        // Reset form and close
        setFormData({
          name: "",
          contactName: "",
          email: "",
          phone: "",
          address: "",
          defaultRate: "",
          currency: "ILS",
          billingRounding: "" as "" | RoundingMode,
          isRetainer: suggestsRetainer,
          retainerHours: "",
          retainerMonthlyFee: "",
          hasOverageRate: false,
          overageRate: "",
          notes: "",
          rates: [],
          documentLanguage: "" as "" | "he" | "en",
          vatMode: "" as "" | "add" | "exempt",
          settlementBillingDay: null,
        });
        setRetainerTouched(false);
        setShowForm(false);
        setCreateStep(1);
        setEditingClient(null);
      } else {
        setFormError(
          data.error_code
            ? messageForError(data, tRoot)
            : isEditing
              ? t("errorUpdateClient")
              : t("errorCreateClient")
        );
      }
    } catch (error) {
      console.error("Error saving client:", error);
      setFormError(editingClient ? t("errorUpdateClient") : t("errorCreateClient"));
    } finally {
      setSubmitting(false);
    }
  };

  const validateIdentityStep = (): boolean => {
    const errors: typeof fieldErrors = {};
    const nameValidation = validateRequired(formData.name, "clientName");
    if (!nameValidation.isValid) errors.name = resolveValidation(nameValidation.code);
    if (formData.email.trim()) {
      const result = validateEmail(formData.email, false);
      if (!result.isValid) errors.email = resolveValidation(result.code);
    }
    if (formData.phone.trim()) {
      const result = validatePhone(formData.phone, false);
      if (!result.isValid) errors.phone = resolveValidation(result.code);
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleWizardSubmit = (event: React.FormEvent) => {
    if (editingClient || createStep === 3) {
      void handleSubmit(event);
      return;
    }
    event.preventDefault();
    if (createStep === 1 && !validateIdentityStep()) return;
    setCreateStep((current) => (current === 1 ? 2 : 3));
  };

  // Kept as the safe edit loader while the create form is progressively split
  // from the detail workspace; list rows now navigate to the workspace.
  const _handleEdit = async (client: Client) => {
    setRatesLoading(true);
    setRatesLoadError(false);
    setFormError("");
    setEditingClient(client);
    setFormData({
      name: client.name,
      contactName: client.contactName || "",
      email: client.email || "",
      phone: client.phone || "",
      address: client.address || "",
      defaultRate: client.defaultRate?.toString() || "",
      currency: client.currency || "ILS",
      billingRounding: (client.billingRounding ?? "") as "" | RoundingMode,
      isRetainer: client.isRetainer ?? false,
      retainerHours: client.retainerHours?.toString() || "",
      retainerMonthlyFee: client.retainerMonthlyFee?.toString() || "",
      hasOverageRate: (client.overageRate ?? 0) > 0,
      overageRate: client.overageRate?.toString() || "",
      notes: client.notes || "",
      rates: [],
      documentLanguage: (client.documentLanguage ?? "") as "" | "he" | "en",
      vatMode: (client.vatMode ?? "") as "" | "add" | "exempt",
      settlementBillingDay: client.settlementBillingDay ?? null,
    });
    setShowForm(true);

    // Load the client's rates (the list endpoint doesn't include them).
    try {
      const res = await fetch(`/api/clients/${client.id}/rates`);
      const data = await res.json();
      if (data.success) {
        const loaded: ClientRateInput[] = (data.rates as ClientRate[]).map((r) => ({
          kind: r.kind,
          name: r.name,
          rate: r.rate,
          isDefault: r.isDefault,
          unit: r.unit ?? null,
          projectId: r.projectId ?? null,
        }));
        setFormData((prev) => ({ ...prev, rates: loaded }));
      } else {
        setRatesLoadError(true);
      }
    } catch (error) {
      console.error("Error loading client rates:", error);
      setRatesLoadError(true);
    } finally {
      setRatesLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingClient(null);
    setRatesLoading(false);
    setRatesLoadError(false);
    setCreateStep(1);
    setRetainerTouched(false);
    setFormData({
      name: "",
      contactName: "",
      email: "",
      phone: "",
      address: "",
      defaultRate: "",
      currency: "ILS",
      billingRounding: "" as "" | RoundingMode,
      isRetainer: suggestsRetainer,
      retainerHours: "",
      retainerMonthlyFee: "",
      hasOverageRate: false,
      overageRate: "",
      notes: "",
      rates: [],
      documentLanguage: "" as "" | "he" | "en",
      vatMode: "" as "" | "add" | "exempt",
      settlementBillingDay: null,
    });
    setShowForm(false);
  };

  const handleDelete = async (client: Client) => {
    setClientToDelete(client);
  };

  const confirmDelete = async () => {
    if (!clientToDelete) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/clients/${clientToDelete.id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (data.success) {
        // Update client in list (soft delete - sets isActive to false)
        setClients(clients.map((c) => (c.id === clientToDelete.id ? { ...c, isActive: false } : c)));
        // Archiving frees a slot — keep the usage banner fresh
        setPlan((p) => (p ? { ...p, activeCount: Math.max(0, p.activeCount - 1) } : p));
        void queryClient.invalidateQueries({ queryKey: clientsQueryKey });
        setClientToDelete(null);
        // Close edit form if open
        setShowForm(false);
        setEditingClient(null);
        showSuccessToast(t("toastArchived"));
      } else {
        showErrorToast(data.error_code ? messageForError(data, tRoot) : t("errorDeleteClient"));
      }
    } catch (error) {
      console.error("Error deleting client:", error);
      showErrorToast(t("errorDeleteClient"));
    } finally {
      setDeleting(false);
    }
  };

  const handleRestore = async (client: Client) => {
    try {
      const response = await fetch(`/api/clients/${client.id}`, {
        method: "PATCH",
      });

      const data = await response.json();

      if (data.success) {
        // Update client in list (restore - sets isActive to true)
        setClients(clients.map((c) => (c.id === client.id ? { ...c, isActive: true } : c)));
        // Restoring consumes a slot — keep the usage banner fresh
        setPlan((p) => (p ? { ...p, activeCount: p.activeCount + 1 } : p));
        void queryClient.invalidateQueries({ queryKey: clientsQueryKey });
        // Close edit form if open
        setShowForm(false);
        setEditingClient(null);
        showSuccessToast(t("toastRestored"));
      } else {
        showErrorToast(data.error_code ? messageForError(data, tRoot) : t("errorRestoreClient"));
      }
    } catch (error) {
      console.error("Error restoring client:", error);
      showErrorToast(t("errorRestoreClient"));
    }
  };

  const handleMakeActive = async (clientId: string) => {
    setMakingActiveId(clientId);
    try {
      const response = await fetch(`/api/clients/${clientId}/make-active`, {
        method: "POST",
      });
      const data = await response.json() as { success: boolean; error_code?: string };
      if (data.success) {
        // Full refetch to sync plan counts, client status, and locked set from server.
        // No optimistic mutation — rely solely on the server response for consistency.
        try {
          const res = await fetch("/api/clients");
          const fresh = await res.json() as {
            success: boolean;
            clients?: Client[];
            plan?: { activeCount: number; clientLimit: number | null };
            lockedClientIds?: string[];
          };
          if (fresh.success) {
            setClients(fresh.clients ?? []);
            if (fresh.plan) {
              setPlan({ activeCount: fresh.plan.activeCount, clientLimit: fresh.plan.clientLimit });
            }
            setLockedIds(new Set<string>(Array.isArray(fresh.lockedClientIds) ? fresh.lockedClientIds : []));
          } else {
            showErrorToast(t("usage.refreshFailed"));
          }
        } catch (fetchErr) {
          console.error("Error refetching clients after make-active:", fetchErr);
          showErrorToast(t("usage.refreshFailed"));
        }
        void queryClient.invalidateQueries({ queryKey: clientsQueryKey });
        showSuccessToast(t("usage.madeActiveSuccess"));
      } else {
        showErrorToast(data.error_code ? messageForError(data, tRoot) : t("usage.errorMakeActive"));
      }
    } catch (error) {
      console.error("Error making client active:", error);
      showErrorToast(t("usage.errorMakeActive"));
    } finally {
      setMakingActiveId(null);
    }
  };

  const cancelDelete = () => {
    setClientToDelete(null);
  };

  // At the plan's client cap — gate the create action (banner explains why).
  const atClientLimit =
    plan !== null && plan.clientLimit !== null && plan.activeCount >= plan.clientLimit;

  return (
    <AppLayout>
      <PageContainer>
        <PageHeader title={t("pageTitle")}>
          <Button
            onClick={() => {
              if (showForm) {
                handleCancelEdit();
                return;
              }
              if (!showForm) {
                setCreateStep(1);
                setEditingClient(null);
                setRetainerTouched(false);
                setStarterSeeded(false);
                setFormData((prev) => ({
                  ...prev,
                  isRetainer: suggestsRetainer,
                  rates: seedRates(t("seedRateName")),
                }));
              }
              setShowForm(true);
            }}
            disabled={!showForm && atClientLimit}
          >
            {showForm ? t("cancel") : t("newClientButton")}
          </Button>
        </PageHeader>
        {plan && <PlanUsageBanner active={plan.activeCount} limit={plan.clientLimit} />}
        {/* Add/Edit Client Form */}
        {showForm && (
          <div className="mb-8 rounded-[var(--radius-card)] border border-border bg-card p-6 sm:p-8 motion-safe:animate-scale-in">
            <div className="mb-6">
              <h2 className="font-display text-xl font-semibold text-foreground">
                {editingClient ? t("editClientTitle") : t("newClientTitle")}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {editingClient ? t("editClientSubtitle") : t("newClientSubtitle")}
              </p>
              {!editingClient && (
                <ol className="mt-5 grid grid-cols-3 gap-2" aria-label={t("createFlow.label")}>
                  {([1, 2, 3] as const).map((step) => (
                    <li key={step} className="flex items-center gap-2">
                      <span className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${createStep >= step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{step}</span>
                      <span className={`hidden text-xs font-semibold sm:inline ${createStep === step ? "text-foreground" : "text-muted-foreground"}`}>{t(`createFlow.step${step}`)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            <form onSubmit={handleWizardSubmit} className="space-y-8" noValidate>
              {formError && (
                <div className="rounded-[var(--radius)] border border-destructive/30 bg-destructive/10 p-3.5 text-sm text-destructive">
                  {formError}
                </div>
              )}
              {ratesLoading && (
                <div className="rounded-[var(--radius)] border border-border bg-background/50 p-3.5 text-sm text-muted-foreground" role="status" aria-live="polite">
                  {t("loadingRates")}
                </div>
              )}
              {ratesLoadError && (
                <div className="rounded-[var(--radius)] border border-destructive/30 bg-destructive/10 p-3.5 text-sm text-destructive" role="alert">
                  {t("errorLoadRates")}
                </div>
              )}

              {/* Section — contact details */}
              {(editingClient || createStep === 1) && (
              <fieldset className="space-y-4">
                <legend className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  {t("contactSection")}
                </legend>
                <div className="grid grid-cols-1 gap-x-3 gap-y-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-foreground">
                      {t("clientNameLabel")} <span className="text-primary">*</span>
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="organization"
                      autoComplete="organization"
                      required
                      value={formData.name}
                      onChange={(e) => {
                        setFormData({ ...formData, name: e.target.value });
                        setFieldErrors({ ...fieldErrors, name: undefined });
                      }}
                      className={fieldClass(!!fieldErrors.name)}
                      aria-invalid={Boolean(fieldErrors.name) || undefined}
                      aria-describedby={fieldErrors.name ? "name-error" : undefined}
                      disabled={submitting}
                      placeholder={t("clientNamePlaceholder")}
                    />
                    {fieldErrors.name && <p id="name-error" className="mt-1.5 text-xs text-destructive">{fieldErrors.name}</p>}
                  </div>

                  <div>
                    <label htmlFor="contactName" className="mb-1.5 block text-sm font-medium text-foreground">
                      {t("contactNameLabel")}
                    </label>
                    <input
                      type="text"
                      id="contactName"
                      name="contactName"
                      autoComplete="name"
                      value={formData.contactName}
                      onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                      className={fieldClass(false)}
                      disabled={submitting}
                      placeholder={t("contactNamePlaceholder")}
                    />
                  </div>

                  <div>
                    <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-foreground">
                      {t("emailLabel")}
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      autoComplete="email"
                      dir="ltr"
                      value={formData.email}
                      onChange={(e) => {
                        setFormData({ ...formData, email: e.target.value });
                        setFieldErrors({ ...fieldErrors, email: undefined });
                      }}
                      className={`${fieldClass(!!fieldErrors.email)} text-end`}
                      aria-invalid={Boolean(fieldErrors.email) || undefined}
                      aria-describedby={fieldErrors.email ? "email-error" : undefined}
                      disabled={submitting}
                      placeholder="name@example.com"
                    />
                    {fieldErrors.email && <p id="email-error" className="mt-1.5 text-xs text-destructive">{fieldErrors.email}</p>}
                  </div>

                  <div>
                    <label htmlFor="phone" className="mb-1.5 block text-sm font-medium text-foreground">
                      {t("phoneLabel")}
                    </label>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      autoComplete="tel"
                      dir="ltr"
                      value={formData.phone}
                      onChange={(e) => {
                        setFormData({ ...formData, phone: e.target.value });
                        setFieldErrors({ ...fieldErrors, phone: undefined });
                      }}
                      className={`${fieldClass(!!fieldErrors.phone)} text-end`}
                      aria-invalid={Boolean(fieldErrors.phone) || undefined}
                      aria-describedby={fieldErrors.phone ? "phone-error" : undefined}
                      disabled={submitting}
                      placeholder="050-0000000"
                    />
                    {fieldErrors.phone && <p id="phone-error" className="mt-1.5 text-xs text-destructive">{fieldErrors.phone}</p>}
                  </div>

                  <div className="sm:col-span-2">
                    <label htmlFor="address" className="mb-1.5 block text-sm font-medium text-foreground">
                      {t("addressLabel")}
                    </label>
                    <input
                      type="text"
                      id="address"
                      name="address"
                      autoComplete="street-address"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className={fieldClass(false)}
                      disabled={submitting}
                      placeholder={t("addressPlaceholder")}
                    />
                  </div>
                </div>
              </fieldset>
              )}

              {/* Section — billing */}
              {(editingClient || createStep > 1) && (
              <fieldset className="space-y-4">
                <legend className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  {createStep === 3 && !editingClient ? t("createFlow.advanced") : t("billingSection")}
                </legend>

                <div className="grid grid-cols-1 gap-x-3 gap-y-4 sm:grid-cols-2">
                  {(editingClient || createStep === 2) && (<>
                  <div>
                    <label htmlFor="currency" className="mb-1.5 block text-sm font-medium text-foreground">
                      {t("currencyLabel")}
                    </label>
                    <SimpleSelect
                      id="currency"
                      name="currency"
                      value={formData.currency}
                      onChange={(v) => setFormData({ ...formData, currency: v })}
                      disabled={submitting}
                      options={CURRENCIES.map((c) => ({ value: c.value, label: c.label }))}
                    />
                    <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
                      {t("currencyPolicyHint")}
                    </p>
                  </div>
                  </>)}

                  {(editingClient || createStep === 3) && (<>
                  <div>
                    <label htmlFor="billingRounding" className="mb-1.5 block text-sm font-medium text-foreground">
                      {t("billingRoundingLabel")}
                    </label>
                    <SimpleSelect
                      id="billingRounding"
                      name="billingRounding"
                      value={formData.billingRounding}
                      onChange={(v) => setFormData({ ...formData, billingRounding: v as "" | RoundingMode })}
                      disabled={submitting}
                      options={[
                        { value: "", label: t("roundingInherit") },
                        ...ROUNDING_MODES.map((m) => ({ value: m, label: tRounding(m) })),
                      ]}
                    />
                  </div>

                  <div>
                    <label htmlFor="documentLanguage" className="mb-1.5 block text-sm font-medium text-foreground">
                      {t("documentLanguageLabel")}
                    </label>
                    <SimpleSelect
                      id="documentLanguage"
                      name="documentLanguage"
                      value={formData.documentLanguage}
                      onChange={(v) =>
                        setFormData({ ...formData, documentLanguage: v as "" | "he" | "en" })
                      }
                      disabled={submitting}
                      options={[
                        {
                          value: "",
                          label: t("documentLanguageAutoResolved", {
                            lang:
                              resolveDocumentLocale(null, formData.currency) === "he"
                                ? t("documentLanguageHe")
                                : t("documentLanguageEn"),
                          }),
                        },
                        { value: "he", label: t("documentLanguageHe") },
                        { value: "en", label: t("documentLanguageEn") },
                      ]}
                    />
                    <p className="mt-1 text-xs text-muted-foreground">{t("documentLanguageHint")}</p>
                  </div>

                  <div>
                    <label htmlFor="vatMode" className="mb-1.5 block text-sm font-medium text-foreground">
                      {t("vatModeLabel")}
                    </label>
                    <SimpleSelect
                      id="vatMode"
                      name="vatMode"
                      value={formData.vatMode}
                      onChange={(v) =>
                        setFormData({ ...formData, vatMode: v as "" | "add" | "exempt" })
                      }
                      disabled={submitting}
                      options={[
                        { value: "", label: t("vatModeInherit") },
                        { value: "add", label: t("vatModeAdd") },
                        { value: "exempt", label: t("vatModeExempt") },
                      ]}
                    />
                    <p className="mt-1 text-xs text-muted-foreground">{t("vatModeHint")}</p>
                  </div>

                  <div>
                    <label htmlFor="settlementBillingDay" className="mb-1.5 block text-sm font-medium text-foreground">
                      {t("settlementDay")}
                    </label>
                    <SimpleSelect
                      id="settlementBillingDay"
                      name="settlementBillingDay"
                      value={formData.settlementBillingDay === null ? "" : String(formData.settlementBillingDay)}
                      onChange={(v) =>
                        setFormData({ ...formData, settlementBillingDay: v === "" ? null : Number(v) })
                      }
                      disabled={submitting}
                      options={[
                        { value: "", label: t("settlementDayNone") },
                        ...Array.from({ length: 28 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) })),
                        { value: "31", label: t("settlementDayEndOfMonth") },
                      ]}
                    />
                    <p className="mt-1 text-xs text-muted-foreground">{t("settlementDayHint")}</p>
                  </div>
                </>)}
                </div>

                {(editingClient || createStep === 2) && (<>
                {/* Rates & items editor */}
                <div className="space-y-2">
                  <span className="text-sm font-medium text-foreground">{t("ratesAndItems")}</span>
                  <ClientRatesEditor
                    rates={formData.rates}
                    currency={formData.currency}
                    onChange={(rates) => setFormData((prev) => ({ ...prev, rates }))}
                    disabled={submitting}
                  />
                </div>

                {/* Retainer toggle — full-width switch row */}
                <label className="flex cursor-pointer items-center justify-between rounded-[var(--radius)] border border-border bg-background px-4 py-3">
                  <span className="text-sm font-medium text-foreground">{t("retainerClient")}</span>
                  <input
                    type="checkbox"
                    name="isRetainer"
                    checked={formData.isRetainer}
                    onChange={(e) => {
                      setRetainerTouched(true);
                      setFormData({ ...formData, isRetainer: e.target.checked });
                    }}
                    className="h-4 w-4 rounded border-border accent-primary"
                    disabled={submitting}
                  />
                </label>
                {/* Profession-based suggestion (create mode only). */}
                {suggestsRetainer && editingClient === null && (
                  <p className="text-xs text-muted-foreground">{t("retainerSuggestedHint")}</p>
                )}

                {/* Retainer fields */}
                {formData.isRetainer && (
                  <div className="space-y-4 rounded-[var(--radius)] border border-border bg-background/50 p-4">
                    <div className="grid grid-cols-1 gap-x-3 gap-y-4 sm:grid-cols-2">
                      <div>
                        <label htmlFor="retainerHours" className="mb-1.5 block text-sm font-medium text-foreground">
                          {t("retainerHoursLabel")}
                        </label>
                        <input
                          type="number"
                          id="retainerHours"
                          name="retainerHours"
                          min="0"
                          step="0.5"
                          value={formData.retainerHours}
                          onChange={(e) => setFormData({ ...formData, retainerHours: e.target.value })}
                          className={`${fieldClass(false)} font-mono`}
                          disabled={submitting}
                          placeholder="40"
                        />
                      </div>
                      <div>
                        <label htmlFor="retainerMonthlyFee" className="mb-1.5 block text-sm font-medium text-foreground">
                          {t("monthlyAmountLabel", { symbol: CURRENCY_SYMBOLS[formData.currency] || "₪" })}
                        </label>
                        <input
                          type="number"
                          id="retainerMonthlyFee"
                          name="retainerMonthlyFee"
                          min="0"
                          step="0.01"
                          value={formData.retainerMonthlyFee}
                          onChange={(e) => setFormData({ ...formData, retainerMonthlyFee: e.target.value })}
                          className={`${fieldClass(false)} font-mono`}
                          disabled={submitting}
                          placeholder="10000"
                        />
                      </div>
                    </div>

                    <label className="flex cursor-pointer items-center justify-between rounded-[var(--radius)] border border-border bg-background px-4 py-3">
                      <span className="text-sm font-medium text-foreground">{t("separateOverageRate")}</span>
                      <input
                        type="checkbox"
                        name="hasOverageRate"
                        checked={formData.hasOverageRate}
                        onChange={(e) => setFormData({ ...formData, hasOverageRate: e.target.checked })}
                        className="h-4 w-4 rounded border-border accent-primary"
                        disabled={submitting}
                      />
                    </label>

                    {formData.hasOverageRate && (
                      <div className="sm:max-w-[calc(50%-0.5rem)]">
                        <label htmlFor="overageRate" className="mb-1.5 block text-sm font-medium text-foreground">
                          {t("overageHourlyRateLabel", { symbol: CURRENCY_SYMBOLS[formData.currency] || "₪" })}
                        </label>
                        <input
                          type="number"
                          id="overageRate"
                          name="overageRate"
                          min="0"
                          step="0.01"
                          value={formData.overageRate}
                          onChange={(e) => setFormData({ ...formData, overageRate: e.target.value })}
                          className={`${fieldClass(false)} font-mono`}
                          disabled={submitting}
                          placeholder="0.00"
                        />
                      </div>
                    )}
                  </div>
                )}
                </>)}
              </fieldset>
              )}

              {/* Section — notes */}
              {(editingClient || createStep === 3) && (
              <fieldset className="space-y-4">
                <legend className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  {t("notesSection")}
                </legend>
                <textarea
                  id="notes"
                  name="notes"
                  rows={3}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className={`${fieldClass(false)} resize-y`}
                  disabled={submitting || ratesLoading || ratesLoadError}
                  placeholder={t("notesPlaceholder")}
                />
              </fieldset>
              )}

              {editingClient && (
                <div className="flex items-center justify-between rounded-[var(--radius)] border border-border bg-background/50 p-4">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {editingClient.isActive ? t("archiveTitle") : t("restoreTitle")}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {editingClient.isActive
                        ? t("archiveDescription")
                        : t("restoreDescription")}
                    </p>
                  </div>
                  {editingClient.isActive ? (
                    <Button
                      type="button"
                      onClick={() => handleDelete(editingClient)}
                      variant="outline"
                      className="shrink-0 border-destructive/30 text-destructive hover:bg-destructive/10"
                    >
                      {t("archiveClientButton")}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      onClick={() => handleRestore(editingClient)}
                      variant="outline"
                      className="shrink-0 border-success/30 text-success hover:bg-success/10"
                    >
                      {t("restoreClientButton")}
                    </Button>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-3 border-t border-border pt-5">
                <Button
                  type="button"
                  onClick={() => createStep > 1 && !editingClient ? setCreateStep((current) => current === 3 ? 2 : 1) : handleCancelEdit()}
                  variant="outline"
                  disabled={submitting || ratesLoading}
                >
                  {createStep > 1 && !editingClient ? t("createFlow.back") : t("cancel")}
                </Button>
                <Button
                  type="submit"
                  disabled={submitting || ratesLoading || ratesLoadError}
                >
                  {submitting
                    ? t("saving")
                    : editingClient
                      ? t("updateClientButton")
                      : createStep < 3
                        ? t("createFlow.continue")
                        : t("saveClientButton")}
                </Button>
              </div>
            </form>
          </div>
        )}

        <section aria-labelledby="clients-list-title" className="space-y-4">
          <div className="flex flex-col gap-3 border-b border-border pb-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 id="clients-list-title" className="font-display text-lg font-semibold text-foreground">
                {t("workspaceListTitle")}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{t("workspaceListDescription")}</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative min-w-0 sm:w-72">
                <label htmlFor="client-search" className="sr-only">{t("searchLabel")}</label>
                <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <input
                  id="client-search"
                  name="clientSearch"
                  type="search"
                  value={clientSearch}
                  onChange={(event) => setClientSearch(event.target.value)}
                  placeholder={t("searchPlaceholder")}
                  autoComplete="off"
                  className={`${fieldClass(false)} ps-10`}
                />
              </div>
              <div className="inline-flex min-h-11 rounded-[var(--radius)] border border-border bg-card p-1" aria-label={t("filterLabel")}>
                {(["active", "attention", "archived"] as const).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    aria-pressed={clientFilter === filter}
                    onClick={() => setClientFilter(filter)}
                    className={`rounded-[calc(var(--radius)-0.25rem)] px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      clientFilter === filter
                        ? "bg-foreground text-background"
                        : "text-muted-foreground hover:bg-surface hover:text-foreground"
                    }`}
                  >
                    {t(`filter.${filter}`)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-card">
          {clientsLoading ? (
            <div className="space-y-3 p-5" role="status" aria-live="polite">
              <span className="sr-only">{t("loadingClients")}</span>
              {[0, 1, 2].map((row) => (
                <div key={row} className="h-20 animate-pulse rounded-[var(--radius)] bg-surface" />
              ))}
            </div>
          ) : clientsLoadError ? (
            <div className="m-4 rounded-[var(--radius)] border border-destructive/20 bg-destructive/10 p-6 text-center text-sm text-destructive" role="alert">
              {t("errorLoadClient")}
            </div>
          ) : clients.length === 0 ? (
            <EmptyState
              icon={Users}
              message={t("emptyTitle")}
              description={t("emptyDescription")}
              actionLabel={t("emptyAction")}
              onAction={() => setShowForm(true)}
            />
          ) : filteredClients.length === 0 ? (
            <div className="p-10 text-center">
              <p className="font-medium text-foreground">{t("noFilterResults")}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t("noFilterResultsHint")}</p>
            </div>
          ) : (
            <>
              <div className="hidden grid-cols-[minmax(14rem,1.6fr)_minmax(9rem,1fr)_minmax(7rem,0.7fr)_minmax(13rem,1.2fr)_3rem] gap-5 border-b border-border bg-surface px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground lg:grid">
                <span>{t("colClient")}</span>
                <span>{t("colBillingModel")}</span>
                <span>{t("colProjects")}</span>
                <span>{t("colMoneyStatus")}</span>
                <span className="sr-only">{t("colActions")}</span>
              </div>
              <ul className="divide-y divide-border">
                {filteredClients.map((client) => {
                  const needsAttention = client.unbilledTotal > 0 || client.outstandingTotal > 0;
                  return (
                    <li key={client.id} className="group p-4 transition-colors hover:bg-surface/70 lg:grid lg:grid-cols-[minmax(14rem,1.6fr)_minmax(9rem,1fr)_minmax(7rem,0.7fr)_minmax(13rem,1.2fr)_3rem] lg:items-center lg:gap-5 lg:px-5 lg:py-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Link href={`/clients/${client.id}`} className="truncate font-semibold text-foreground underline-offset-4 hover:underline">
                            {client.name}
                          </Link>
                          {lockedIds.has(client.id) && (
                            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                              <Lock className="h-3 w-3" aria-hidden="true" />{t("usage.locked")}
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex min-w-0 flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          {client.contactName && <span>{client.contactName}</span>}
                          {client.email && <span className="inline-flex min-w-0 items-center gap-1"><Mail className="h-3 w-3 shrink-0" aria-hidden="true" /><bdi className="truncate">{client.email}</bdi></span>}
                          {client.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" aria-hidden="true" /><bdi>{client.phone}</bdi></span>}
                          {!client.contactName && !client.email && !client.phone && <span>{t("contactMissing")}</span>}
                        </div>
                      </div>

                      <div className="mt-4 lg:mt-0">
                        <span className="text-xs text-muted-foreground lg:sr-only">{t("colBillingModel")}</span>
                        <p className="mt-1 text-sm font-medium text-foreground lg:mt-0">
                          {client.isRetainer
                            ? t("billingModelRetainer")
                            : client.defaultRate
                              ? t("billingModelHourly", { amount: formatCurrency(client.defaultRate, client.currency, locale) })
                              : t("billingModelFlexible")}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground"><bdi>{client.currency}</bdi></p>
                      </div>

                      <div className="mt-4 lg:mt-0">
                        <span className="text-xs text-muted-foreground lg:sr-only">{t("colProjects")}</span>
                        <p className="mt-1 text-sm font-medium text-foreground lg:mt-0">{t("activeProjectsCount", { active: client.activeProjectCount, total: client.projectCount })}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{t("hoursTracked", { hours: Number(client.totalHours).toFixed(1) })}</p>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4 lg:mt-0 lg:border-0 lg:pt-0">
                        <div>
                          <p className="text-xs text-muted-foreground">{t("unbilledLabel")}</p>
                          <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-foreground"><bdi>{formatCurrency(client.unbilledTotal, client.currency, locale)}</bdi></p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">{t("outstandingLabel")}</p>
                          <p className={`mt-0.5 font-mono text-sm font-semibold tabular-nums ${client.outstandingTotal > 0 ? "text-warning" : "text-foreground"}`}><bdi>{formatCurrency(client.outstandingTotal, client.currency, locale)}</bdi></p>
                        </div>
                        {(needsAttention || client.hasOtherCurrency) && (
                          <p className="col-span-2 text-xs text-muted-foreground">
                            {client.hasOtherCurrency ? t("otherCurrencyHint") : t("attentionHint")}
                          </p>
                        )}
                      </div>

                      <div className="mt-4 flex items-center justify-end lg:mt-0">
                        {lockedIds.has(client.id) ? (
                          <Button onClick={() => handleMakeActive(client.id)} disabled={makingActiveId === client.id} size="sm">
                            {makingActiveId === client.id ? t("saving") : t("usage.makeActive")}
                          </Button>
                        ) : (
                          <Link href={`/clients/${client.id}`} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-[var(--radius)] text-muted-foreground transition-colors hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={t("openClient", { name: client.name })}>
                            <ArrowUpLeft className={`h-4 w-4 ${locale === "en" ? "scale-x-[-1]" : ""}`} aria-hidden="true" />
                          </Link>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
          </div>
        </section>
      </PageContainer>
      {/* Delete Confirmation Dialog */}
      <Dialog open={!!clientToDelete} onOpenChange={(open) => { if (!open) cancelDelete(); }}>
        <DialogContent showCloseButton={false} className="motion-safe:animate-scale-in border-destructive/20">
          <DialogHeader>
            <DialogTitle>{t("archiveClientButton")}</DialogTitle>
            <DialogDescription>
              {t("archiveConfirmBody", { name: clientToDelete?.name ?? "" })}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button
              onClick={cancelDelete}
              disabled={deleting}
              variant="outline"
            >
              {t("cancel")}
            </Button>
            <Button
              onClick={confirmDelete}
              disabled={deleting}
              variant="destructive"
            >
              {deleting ? t("archiving") : t("archiveAction")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
