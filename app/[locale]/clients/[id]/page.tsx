"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
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
import { useTranslations, useLocale } from "next-intl";
import { SimpleSelect } from "@/components/ui/simple-select";
import { resolveDocumentLocale } from "@/lib/document-language";

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
    })) as ClientRateInput[],
    documentLanguage: (client.documentLanguage ?? "") as "" | "he" | "en",
    vatMode: (client.vatMode ?? "") as "" | "add" | "exempt",
  };
}

export default function ClientDetailsPage() {
  const t = useTranslations("Clients");
  const tRoot = useTranslations();
  const tRounding = useTranslations("Rounding");
  const intlLocale = useLocale() === "en" ? "en-US" : "he-IL";
  const router = useRouter();
  const params = useParams();
  const clientId = params.id as string;

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
  });
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [clientProjects, setClientProjects] = useState<{id: string; name: string; status: string}[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const editFormRef = useRef<HTMLDivElement>(null);
  const ratesEditorRef = useRef<HTMLDivElement>(null);
  // When the edit form is opened via "ערוך תעריפים", land on the rates editor
  // rather than the top of the form.
  const [focusRatesOnOpen, setFocusRatesOnOpen] = useState(false);

  const openEditForm = (focusRates = false) => {
    setFocusRatesOnOpen(focusRates);
    setShowEditForm(true);
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
    const fetchClientProjects = async () => {
      if (!clientId) return;
      try {
        setProjectsLoading(true);
        const response = await fetch(`/api/projects?clientId=${clientId}`);
        const data = await response.json();
        if (data.success) {
          setClientProjects(data.projects || []);
        }
      } catch (error) {
        console.error("Error fetching client projects:", error);
      } finally {
        setProjectsLoading(false);
      }
    };
    fetchClientProjects();
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
        }),
      });

      const data = await response.json();

      if (data.success) {
        setClient(data.client);
        setFormData(clientToFormData(data.client));
        setShowEditForm(false);
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
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setFormError("");
                }}
                className="rounded-[var(--radius-card)] border border-border px-4 py-2 text-foreground hover:bg-muted bg-card"
                disabled={submitting}
              >
                {t("cancel")}
              </button>
              <button
                onClick={handleDelete}
                disabled={submitting}
                className="rounded-[var(--radius-card)] bg-destructive px-4 py-2 text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
              >
                {submitting ? t("deleting") : t("deleteClient")}
              </button>
            </div>
          </div>
        )}

        {showEditForm && (
          <div ref={editFormRef} className="mb-6 mx-auto max-w-2xl rounded-[var(--radius-card)] bg-card p-5 border border-border scroll-mt-20">
            <h2 className="font-display text-lg font-semibold text-foreground mb-4">{t("editClientButton")}</h2>
            <form onSubmit={handleEdit} className="space-y-4">
              {formError && (
                <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-foreground">
                    {t("clientNameLabel")} <span className="text-primary">*</span>
                  </label>
                  <input
                    type="text"
                    id="name"
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
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className={fieldClass(false)}
                    disabled={submitting}
                    placeholder={t("addressPlaceholder")}
                  />
                </div>
              </div>

              {/* Billing — currency, rounding, rates/items, retainer */}
              <div className="space-y-4 border-t border-border pt-4">
                <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="currency" className="mb-1.5 block text-sm font-medium text-foreground">
                      {t("currencyLabel")}
                    </label>
                    <SimpleSelect
                      id="currency"
                      value={formData.currency}
                      onChange={(v) => setFormData({ ...formData, currency: v })}
                      disabled={submitting}
                      options={CURRENCIES.map((c) => ({ value: c.value, label: c.label }))}
                    />
                  </div>

                  <div>
                    <label htmlFor="billingRounding" className="mb-1.5 block text-sm font-medium text-foreground">
                      {t("billingRoundingLabel")}
                    </label>
                    <SimpleSelect
                      id="billingRounding"
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

              <div>
                <label htmlFor="notes" className="mb-1.5 block text-sm font-medium text-foreground">
                  {t("notesSection")}
                </label>
                <textarea
                  id="notes"
                  rows={3}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className={`${fieldClass(false)} resize-y`}
                  disabled={submitting}
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditForm(false);
                    setFormError("");
                    if (client) {
                      setFormData(clientToFormData(client));
                    }
                  }}
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
                  {submitting ? t("saving") : t("saveChanges")}
                </button>
              </div>
            </form>
          </div>
        )}

        {clientLoading ? (
          <div className="rounded-[var(--radius-card)] bg-card p-8 border border-border text-center text-muted-foreground">
            {t("loadingClientData")}
          </div>
        ) : error ? (
          <div className="rounded-[var(--radius-card)] bg-card p-8 border border-border">
            <div className="rounded-md bg-destructive/10 p-4 text-destructive">{error}</div>
          </div>
        ) : !client ? (
          <div className="rounded-[var(--radius-card)] bg-card p-8 border border-border text-center text-muted-foreground">
            {t("clientNotFound")}
          </div>
        ) : (
          <div className="rounded-[var(--radius-card)] bg-card p-5 border border-border">
            <div className="flex items-start justify-between gap-3 border-b border-border pb-4 mb-4">
              <div className="min-w-0">
                <h2 className="font-display text-2xl font-bold tracking-tight text-foreground truncate">{client.name}</h2>
                {client.contactName && (
                  <p className="text-sm text-muted-foreground mt-0.5">{t("contactNameInline", { name: client.contactName })}</p>
                )}
              </div>
              <span className={`inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                client.isActive ? "bg-success/10 text-success" : "bg-muted text-foreground"
              }`}>
                {client.isActive ? t("statusActive") : t("statusInactive")}
              </span>
            </div>

            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2 text-sm">
              <div className="flex items-baseline gap-1.5">
                <span className="text-muted-foreground">{t("emailLabel")}</span>
                {client.email ? (
                  <a href={`mailto:${client.email}`} dir="ltr" className="text-primary hover:text-primary/90">{client.email}</a>
                ) : <span className="text-muted-foreground">—</span>}
              </div>
              <span className="text-border">|</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-muted-foreground">{t("phoneLabel")}</span>
                {client.phone ? (
                  <a href={`tel:${client.phone}`} dir="ltr" className="text-primary hover:text-primary/90">{client.phone}</a>
                ) : <span className="text-muted-foreground">—</span>}
              </div>
              {client.address && (
                <>
                  <span className="text-border">|</span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-muted-foreground">{t("addressLabel")}</span>
                    <span className="text-foreground">{client.address}</span>
                  </div>
                </>
              )}
              <span className="text-border">|</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-muted-foreground">{t("currencyLabel")}</span>
                <span className="text-foreground">{CURRENCIES.find((c) => c.value === client.currency)?.label || client.currency}</span>
              </div>
              <span className="text-border">|</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-muted-foreground">{t("createdLabel")}</span>
                <span className="text-foreground tabular-nums">{new Date(client.createdAt).toLocaleDateString(intlLocale)}</span>
              </div>
            </div>

            {/* Rates & items */}
            {(() => {
              const symbol = CURRENCY_SYMBOLS[client.currency] || "₪";
              const hourly = (client.rates ?? []).filter((r) => r.kind === "hourly");
              const items = (client.rates ?? []).filter((r) => r.kind === "item");
              const hasAny = hourly.length > 0 || items.length > 0 || client.isRetainer;
              return (
                <div className="mt-6 border-t border-border pt-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-display text-base font-semibold text-foreground">{t("ratesAndItems")}</h3>
                      {client.billingRounding != null && (
                        <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                          {tRounding(client.billingRounding as RoundingMode)}
                        </span>
                      )}
                    </div>
                    {client.isActive && (
                      <button
                        onClick={() => openEditForm(true)}
                        className="text-sm font-medium text-primary hover:text-primary/90"
                      >
                        {t("editRates")}
                      </button>
                    )}
                  </div>
                  {!hasAny ? (
                    <p className="text-sm text-muted-foreground">
                      {t("noRatesDefined", { action: t("editRates") })}
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {hourly.length > 0 && (
                        <div>
                          <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("hourlyRatesHeader")}</h4>
                          <ul className="space-y-1">
                            {hourly.map((r) => (
                              <li key={r.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-[var(--radius)] bg-background/40 px-3 py-2">
                                <span className="text-sm font-medium text-foreground">{r.name}</span>
                                <span className="font-mono text-sm tabular-nums text-foreground">
                                  {symbol}{r.rate}<span className="text-muted-foreground">{t("perHourSuffix")}</span>
                                </span>
                                {r.isDefault && (
                                  <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">
                                    {t("defaultBadge")}
                                  </span>
                                )}
                                {r.projectId && (
                                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                                    {clientProjects.find((p) => p.id === r.projectId)?.name ?? t("rateScopeAria")}
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {items.length > 0 && (
                        <div>
                          <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("itemsHeader")}</h4>
                          <ul className="space-y-1">
                            {items.map((r) => (
                              <li key={r.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-[var(--radius)] bg-background/40 px-3 py-2">
                                <span className="text-sm font-medium text-foreground">{r.name}</span>
                                <span className="font-mono text-sm tabular-nums text-foreground">
                                  {symbol}{r.rate}<span className="text-muted-foreground">{t("perUnitSuffix")}</span>
                                </span>
                                {r.projectId && (
                                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                                    {clientProjects.find((p) => p.id === r.projectId)?.name ?? t("rateScopeAria")}
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {client.isRetainer && (
                        <div>
                          <h4 className="text-sm font-medium text-muted-foreground mb-2">{t("retainerHeader")}</h4>
                          <div className="rounded-[var(--radius)] border border-border bg-background/50 px-3 py-2 text-sm text-foreground">
                            <span className="tabular-nums">
                              {t("retainerSummary", { hours: client.retainerHours ?? 0, symbol, fee: client.retainerMonthlyFee ?? 0 })}
                            </span>
                            {client.overageRate != null && (
                              <span className="block text-muted-foreground">
                                {t("overageRateSummary", { symbol, rate: client.overageRate })}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            {client.notes && (
              <div className="mt-6">
                <h3 className="text-sm font-medium text-muted-foreground mb-2">{t("notesSection")}</h3>
                <div className="rounded-md bg-muted p-3">
                  <p className="text-foreground whitespace-pre-wrap">{client.notes}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {client && (
          <div className="mt-6 rounded-[var(--radius-card)] bg-card p-5 border border-border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-base font-semibold text-foreground">{t("projectsHeader")}</h3>
              <a
                href={`/projects?create=true&clientId=${clientId}`}
                className="text-sm text-primary hover:text-primary/90 font-medium"
              >
                {t("addProject")}
              </a>
            </div>
            {projectsLoading ? (
              <p className="text-sm text-muted-foreground">{t("loadingProjects")}</p>
            ) : clientProjects.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noProjectsYet")}</p>
            ) : (
              <div className="space-y-2">
                {clientProjects.map((project) => (
                  <a
                    key={project.id}
                    href={`/projects/${project.id}`}
                    className="flex items-center justify-between rounded-[var(--radius)] px-3 py-2.5 hover:bg-muted transition-colors"
                  >
                    <span className="text-sm font-medium text-foreground">{project.name}</span>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                      project.status === "active" ? "bg-success/10 text-success" :
                      project.status === "completed" ? "bg-secondary-light text-secondary" :
                      project.status === "paused" ? "bg-accent text-accent-foreground" :
                      "bg-muted text-foreground"
                    }`}>
                      {project.status === "active" ? t("projectStatusActive") :
                       project.status === "completed" ? t("projectStatusCompleted") :
                       project.status === "paused" ? t("projectStatusPaused") :
                       project.status === "archived" ? t("projectStatusArchived") : project.status}
                    </span>
                  </a>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Actions — kept at the bottom */}
        {client && client.isActive && (
          <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-border pt-5">
            <button
              onClick={() => openEditForm()}
              className="rounded-[var(--radius)] border border-border px-3.5 py-2 text-sm text-foreground hover:bg-muted"
            >
              {t("editClientButton")}
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="rounded-[var(--radius)] px-3.5 py-2 text-sm text-destructive hover:bg-destructive/10"
            >
              {t("deleteClient")}
            </button>
          </div>
        )}
      </PageContainer>
    </AppLayout>
  );
}
