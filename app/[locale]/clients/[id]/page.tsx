"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useRouter } from "@/src/i18n/navigation";
import { AppLayout } from "@/components/app-layout";
import { PageContainer } from "@/components/page-container";
import { Breadcrumb } from "@/components/breadcrumb";
import { fieldClass } from "@/lib/form-styles";
import { CURRENCY_SYMBOLS } from "@/lib/currency";
import { ClientRatesEditor } from "@/components/client-rates-editor";
import { cleanClientRates } from "@/lib/schemas/rates";
import type { ClientRate, ClientRateInput } from "@/lib/schemas/rates";
import { ROUNDING_MODES, type RoundingMode } from "@/lib/rounding";
import { messageForError } from "@/lib/api-error";
import { useTranslations } from "next-intl";
import { SimpleSelect } from "@/components/ui/simple-select";
import { Button } from "@/components/ui/button";
import { resolveDocumentLocale } from "@/lib/document-language";
import { showSuccessToast } from "@/lib/toast";
import {
  ClientWorkspace,
  type ClientWorkspaceData,
  type ClientWorkspaceTab,
} from "@/components/clients/client-workspace";

const CURRENCIES = [
  { value: "ILS", label: "₪ ILS" },
  { value: "USD", label: "$ USD" },
  { value: "USDT", label: "₮ USDT" },
  { value: "BTC", label: "₿ BTC" },
  { value: "ETH", label: "Ξ ETH" },
] as const;

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
  rates?: ClientRate[];
  documentLanguage: string | null;
  vatMode: string | null;
  settlementBillingDay: number | null;
}

/** Map a loaded client into the edit form's controlled state. */
function clientToFormData(client: Client) {
  return {
    name: client.name || "",
    contactName: client.contactName || "",
    email: client.email || "",
    phone: client.phone || "",
    address: client.address || "",
    currency: client.currency || "ILS",
    billingRounding: (client.billingRounding ?? "") as "" | RoundingMode,
    isRetainer: !!client.isRetainer,
    retainerHours: client.retainerHours?.toString() || "",
    retainerMonthlyFee: client.retainerMonthlyFee?.toString() || "",
    hasOverageRate: client.overageRate != null,
    overageRate: client.overageRate?.toString() || "",
    notes: client.notes || "",
    rates: (client.rates ?? []).map((r) => ({
      kind: r.kind,
      name: r.name,
      rate: r.rate,
      isDefault: r.isDefault,
      unit: r.unit ?? null,
      projectId: r.projectId ?? null,
    })) as ClientRateInput[],
    documentLanguage: (client.documentLanguage ?? "") as "" | "he" | "en",
    vatMode: (client.vatMode ?? "") as "" | "add" | "exempt",
    settlementBillingDay: client.settlementBillingDay ?? null,
  };
}

export default function ClientDetailsPage() {
  const t = useTranslations("Clients");
  const tRoot = useTranslations();
  const tRounding = useTranslations("Rounding");
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const clientId = params.id as string;
  const requestedTab = searchParams.get("tab");
  const activeTab: ClientWorkspaceTab =
    requestedTab === "projects" || requestedTab === "billing" || requestedTab === "details"
      ? requestedTab
      : "overview";

  const [client, setClient] = useState<Client | null>(null);
  const [clientLoading, setClientLoading] = useState(true);
  const [error, setError] = useState("");
  const [showEditForm, setShowEditForm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    contactName: "",
    email: "",
    phone: "",
    address: "",
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
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [clientProjects, setClientProjects] = useState<{id: string; name: string; status: string}[]>([]);
  const [workspaceData, setWorkspaceData] = useState<ClientWorkspaceData | null>(null);
  const [workspaceLoading, setWorkspaceLoading] = useState(true);
  const [workspaceError, setWorkspaceError] = useState(false);
  const editFormRef = useRef<HTMLDivElement>(null);
  const ratesEditorRef = useRef<HTMLDivElement>(null);
  // When the edit form is opened via "ערוך תעריפים", land on the rates editor
  // rather than the top of the form.
  const [focusRatesOnOpen, setFocusRatesOnOpen] = useState(false);
  const isDirty = useMemo(
    () => Boolean(client) && JSON.stringify(formData) !== JSON.stringify(clientToFormData(client!)),
    [client, formData]
  );

  const openEditForm = (focusRates = false) => {
    setFocusRatesOnOpen(focusRates);
    setShowDiscardConfirm(false);
    setShowEditForm(true);
  };

  const closeEditForm = () => {
    setShowEditForm(false);
    setShowDiscardConfirm(false);
    setFormError("");
    if (client) setFormData(clientToFormData(client));
  };

  // The edit form renders inline near the top of the page. The "ערוך תעריפים"
  // trigger lives far down in the rates section, so without this the form
  // opens off-screen and feels like nothing happened — scroll it into view.
  useEffect(() => {
    if (!showEditForm) return;
    const target = focusRatesOnOpen ? ratesEditorRef.current : editFormRef.current;
    target?.scrollIntoView({ behavior: "smooth", block: focusRatesOnOpen ? "center" : "start" });
  }, [showEditForm, focusRatesOnOpen]);

  useEffect(() => {
    if (!showEditForm || !isDirty) return;
    const guard = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [isDirty, showEditForm]);

  useEffect(() => {
    const fetchClient = async () => {
      if (!clientId) return;
      try {
        setClientLoading(true);
        const response = await fetch(`/api/clients/${clientId}`);
        const data = await response.json();
        if (data.success) {
          setClient(data.client);
          setFormData(clientToFormData(data.client));
        } else {
          setError(data.error_code ? messageForError(data, tRoot) : t("errorLoadClient"));
        }
      } catch (error) {
        console.error("Error fetching client:", error);
        setError(t("errorLoadClient"));
      } finally {
        setClientLoading(false);
      }
    };
    fetchClient();
  }, [clientId, t, tRoot]);

  useEffect(() => {
    const fetchWorkspace = async () => {
      if (!clientId) return;
      try {
        setWorkspaceLoading(true);
        setWorkspaceError(false);
        const response = await fetch(`/api/clients/${clientId}/workspace`);
        const data = await response.json();
        if (data.success) {
          setWorkspaceData(data.workspace);
          setClientProjects(
            (data.workspace.projects ?? []).map((project: { id: string; name: string; status: string }) => ({
              id: project.id,
              name: project.name,
              status: project.status,
            }))
          );
        } else {
          setWorkspaceError(true);
        }
      } catch (error) {
        console.error("Error fetching client workspace:", error);
        setWorkspaceError(true);
      } finally {
        setWorkspaceLoading(false);
      }
    };
    fetchWorkspace();
  }, [clientId]);

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    // Rows with a price but no name are likely mistakes — block submit.
    if (formData.rates.some((r) => r.name.trim() === "" && r.rate > 0)) {
      setFormError(t("errorRateNameRequired"));
      return;
    }

    const cleanedRates = cleanClientRates(formData.rates);
    setSubmitting(true);

    try {
      const response = await fetch(`/api/clients/${clientId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formData.name,
          contactName: formData.contactName || undefined,
          email: formData.email || undefined,
          phone: formData.phone || undefined,
          address: formData.address || undefined,
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
        setClient(data.client);
        setFormData(clientToFormData(data.client));
        setShowEditForm(false);
        showSuccessToast(t("workspace.saved"));
      } else {
        setFormError(data.error_code ? messageForError(data, tRoot) : t("errorUpdateClient"));
      }
    } catch (error) {
      console.error("Error updating client:", error);
      setFormError(t("errorUpdateClient"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setFormError("");
    setSubmitting(true);

    try {
      const response = await fetch(`/api/clients/${clientId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (data.success) {
        router.push("/clients");
      } else {
        setFormError(data.error_code ? messageForError(data, tRoot) : t("errorDeleteClient"));
        setShowDeleteConfirm(false);
      }
    } catch (error) {
      console.error("Error deleting client:", error);
      setFormError(t("errorDeleteClient"));
      setShowDeleteConfirm(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppLayout>
      <PageContainer maxWidth="max-w-5xl">
          <div className="mb-6">
            <Breadcrumb
              items={[
                { label: t("pageTitle"), href: "/clients" },
                { label: client?.name || t("clientDetails") },
              ]}
            />
          </div>
        {showDeleteConfirm && (
          <div className="mb-6 rounded-[var(--radius-card)] bg-card p-6 border border-destructive/30">
            <h2 className="text-xl font-semibold text-destructive mb-4">{t("deleteClient")}</h2>
            <p className="text-destructive mb-4">
              {t("deleteConfirmBody", { name: client?.name ?? "" })}
            </p>
            {formError && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive mb-4">
                {formError}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setFormError("");
                }}
                variant="outline"
                disabled={submitting}
              >
                {t("cancel")}
              </Button>
              <Button
                onClick={handleDelete}
                disabled={submitting}
                variant="destructive"
              >
                {submitting ? t("deleting") : t("deleteClient")}
              </Button>
            </div>
          </div>
        )}

        {showEditForm && (
          <div ref={editFormRef} className="mb-6 rounded-[var(--radius-card)] border border-border bg-card p-5 scroll-mt-20 sm:p-6">
            <div className="mb-6 border-b border-border pb-4">
              <h2 className="font-display text-xl font-semibold text-foreground">
                {focusRatesOnOpen ? t("workspace.billing.edit") : t("workspace.editDetails")}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {focusRatesOnOpen ? t("workspace.editBillingHint") : t("workspace.editDetailsHint")}
              </p>
            </div>
            <form onSubmit={handleEdit} className="space-y-4">
              {formError && (
                <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
                  {formError}
                </div>
              )}

              {!focusRatesOnOpen && (
              <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
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
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className={fieldClass(false)}
                    disabled={submitting}
                  />
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
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className={`${fieldClass(false)} text-end`}
                    disabled={submitting}
                  />
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
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className={`${fieldClass(false)} text-end`}
                    disabled={submitting}
                  />
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
              )}

              {/* Billing — currency, rounding, rates/items, retainer */}
              {focusRatesOnOpen && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
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
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("roundingHint")}
                    </p>
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
                </div>

                <div ref={ratesEditorRef} className="space-y-1.5 scroll-mt-20">
                  <span className="text-sm font-medium text-foreground">{t("ratesAndItems")}</span>
                  <ClientRatesEditor
                    rates={formData.rates}
                    currency={formData.currency}
                    onChange={(rates) => setFormData((prev) => ({ ...prev, rates }))}
                    projects={clientProjects}
                    disabled={submitting}
                  />
                </div>

                {/* Retainer toggle */}
                <label className="flex cursor-pointer items-center justify-between rounded-[var(--radius)] border border-border bg-background px-4 py-2.5">
                  <span className="text-sm font-medium text-foreground">{t("retainerClient")}</span>
                  <input
                    type="checkbox"
                    checked={formData.isRetainer}
                    onChange={(e) => setFormData({ ...formData, isRetainer: e.target.checked })}
                    className="h-4 w-4 rounded border-border accent-primary"
                    disabled={submitting}
                  />
                </label>

                {/* Retainer fields */}
                {formData.isRetainer && (
                  <div className="space-y-3 rounded-[var(--radius)] border border-border bg-background/50 p-4">
                    <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
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
              </div>
              )}

              {!focusRatesOnOpen && (
              <div>
                <label htmlFor="notes" className="mb-1.5 block text-sm font-medium text-foreground">
                  {t("notesSection")}
                </label>
                <textarea
                  id="notes"
                  name="notes"
                  rows={3}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className={`${fieldClass(false)} resize-y`}
                  disabled={submitting}
                />
              </div>
              )}

              {isDirty && (
                <p className="text-sm font-medium text-warning" role="status" aria-live="polite">
                  {t("workspace.unsaved")}
                </p>
              )}

              {showDiscardConfirm && (
                <div className="flex flex-col gap-3 rounded-[var(--radius)] border border-warning/30 bg-warning/10 p-4 sm:flex-row sm:items-center sm:justify-between" role="alert">
                  <p className="text-sm text-foreground">{t("workspace.discardPrompt")}</p>
                  <div className="flex gap-2">
                    <Button type="button" variant="ghost" size="sm" onClick={() => setShowDiscardConfirm(false)}>{t("workspace.keepEditing")}</Button>
                    <Button type="button" variant="outline" size="sm" onClick={closeEditForm}>{t("workspace.discard")}</Button>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  onClick={() => isDirty ? setShowDiscardConfirm(true) : closeEditForm()}
                  variant="outline"
                  disabled={submitting}
                >
                  {t("cancel")}
                </Button>
                <Button
                  type="submit"
                  disabled={submitting || !isDirty}
                >
                  {submitting ? t("saving") : t("saveChanges")}
                </Button>
              </div>
            </form>
          </div>
        )}

        {clientLoading ? (
          <div className="space-y-4" role="status" aria-live="polite">
            <span className="sr-only">{t("loadingClientData")}</span>
            <div className="h-28 animate-pulse rounded-[var(--radius-card)] bg-surface" />
            <div className="h-14 animate-pulse rounded-[var(--radius)] bg-surface" />
            <div className="h-64 animate-pulse rounded-[var(--radius-card)] bg-surface" />
          </div>
        ) : error ? (
          <div className="rounded-[var(--radius)] border border-destructive/25 bg-destructive/10 p-5 text-destructive" role="alert">{error}</div>
        ) : client ? (
          <ClientWorkspace
            client={client}
            data={workspaceData}
            dataLoading={workspaceLoading}
            dataError={workspaceError}
            activeTab={activeTab}
            onEditDetails={() => openEditForm(false)}
            onEditBilling={() => openEditForm(true)}
            onArchive={() => setShowDeleteConfirm(true)}
          />
        ) : (
          <div className="rounded-[var(--radius)] border border-border p-8 text-center text-muted-foreground">{t("clientNotFound")}</div>
        )}

      </PageContainer>
    </AppLayout>
  );
}
