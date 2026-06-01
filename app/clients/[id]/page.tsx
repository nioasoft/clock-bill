"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { AppLayout } from "@/components/app-layout";
import { PageContainer } from "@/components/page-container";
import { Breadcrumb } from "@/components/breadcrumb";
import { fieldClass } from "@/lib/form-styles";
import { CURRENCY_SYMBOLS } from "@/lib/currency";
import { ClientRatesEditor } from "@/components/client-rates-editor";
import { cleanClientRates } from "@/lib/schemas/rates";
import type { ClientRate, ClientRateInput } from "@/lib/schemas/rates";

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
  isRetainer: boolean;
  retainerHours: number | null;
  retainerMonthlyFee: number | null;
  overageRate: number | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  rates?: ClientRate[];
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
    })) as ClientRateInput[],
  };
}

export default function ClientDetailsPage() {
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
    isRetainer: false,
    retainerHours: "",
    retainerMonthlyFee: "",
    hasOverageRate: false,
    overageRate: "",
    notes: "",
    rates: [] as ClientRateInput[],
  });
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [clientProjects, setClientProjects] = useState<{id: string; name: string; status: string}[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const editFormRef = useRef<HTMLDivElement>(null);

  // The edit form renders inline near the top of the page. The "ערוך תעריפים"
  // trigger lives far down in the rates section, so without this the form
  // opens off-screen and feels like nothing happened — scroll it into view.
  useEffect(() => {
    if (showEditForm) {
      editFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [showEditForm]);

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
          setError(data.message || "שגיאה בטעינת הלקוח");
        }
      } catch (error) {
        console.error("Error fetching client:", error);
        setError("שגיאה בטעינת הלקוח");
      } finally {
        setClientLoading(false);
      }
    };
    fetchClient();
  }, [clientId]);

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
      setFormError("יש להזין שם לכל תעריף עם מחיר");
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
          isRetainer: formData.isRetainer,
          retainerHours: formData.isRetainer && formData.retainerHours ? parseFloat(formData.retainerHours) : undefined,
          retainerMonthlyFee: formData.isRetainer && formData.retainerMonthlyFee ? parseFloat(formData.retainerMonthlyFee) : undefined,
          overageRate: formData.isRetainer && formData.hasOverageRate && formData.overageRate ? parseFloat(formData.overageRate) : undefined,
          notes: formData.notes || undefined,
          rates: cleanedRates,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setClient(data.client);
        setFormData(clientToFormData(data.client));
        setShowEditForm(false);
      } else {
        setFormError(data.message || "שגיאה בעדכון הלקוח");
      }
    } catch (error) {
      console.error("Error updating client:", error);
      setFormError("שגיאה בעדכון הלקוח");
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
        setFormError(data.message || "שגיאה במחיקת הלקוח");
        setShowDeleteConfirm(false);
      }
    } catch (error) {
      console.error("Error deleting client:", error);
      setFormError("שגיאה במחיקת הלקוח");
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
                { label: "לקוחות", href: "/clients" },
                { label: client?.name || "פרטי לקוח" },
              ]}
            />
          </div>
          <div className="flex justify-between items-center mb-6">
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">פרטי לקוח</h1>
            {client && client.isActive && (
              <div className="flex gap-2">
                <button
                  onClick={() => setShowEditForm(true)}
                  className="rounded-[var(--radius-card)] border border-border px-4 py-2 text-foreground hover:bg-muted"
                >
                  ערוך
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="rounded-[var(--radius-card)] border border-destructive/30 px-4 py-2 text-destructive hover:bg-destructive/10"
                >
                  מחק
                </button>
              </div>
            )}
          </div>
        {showDeleteConfirm && (
          <div className="mb-6 rounded-[var(--radius-card)] bg-destructive/10 p-6 border border-border/50 shadow-sm border border-destructive/20">
            <h2 className="text-xl font-semibold text-destructive mb-4">מחק לקוח</h2>
            <p className="text-destructive mb-4">
              האם אתה בטוח שברצונך למחוק את הלקוח &quot;{client?.name}&quot;? לקוחות שנמחקים יועברו למצב &quot;לא פעיל&quot; ולא יוצגו ברשימה.
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
                ביטול
              </button>
              <button
                onClick={handleDelete}
                disabled={submitting}
                className="rounded-[var(--radius-card)] bg-destructive px-4 py-2 text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
              >
                {submitting ? "מוחק..." : "מחק לקוח"}
              </button>
            </div>
          </div>
        )}

        {showEditForm && (
          <div ref={editFormRef} className="mb-6 rounded-[var(--radius-card)] bg-card p-6 border border-border/50 shadow-sm scroll-mt-20">
            <h2 className="text-xl font-semibold text-foreground mb-4">ערוך לקוח</h2>
            <form onSubmit={handleEdit} className="space-y-4">
              {formError && (
                <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-foreground">
                    שם הלקוח <span className="text-primary">*</span>
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
                    איש קשר
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
                    אימייל
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
                    טלפון
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
                    כתובת
                  </label>
                  <input
                    type="text"
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className={fieldClass(false)}
                    disabled={submitting}
                    placeholder="רחוב, מספר, עיר"
                  />
                </div>
              </div>

              {/* Billing — currency, rates/items, retainer */}
              <div className="space-y-4 border-t border-border pt-4">
                <div className="sm:max-w-[calc(50%-0.5rem)]">
                  <label htmlFor="currency" className="mb-1.5 block text-sm font-medium text-foreground">
                    מטבע
                  </label>
                  <select
                    id="currency"
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                    className={fieldClass(false)}
                    disabled={submitting}
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <span className="text-sm font-medium text-foreground">תעריפים ופריטים</span>
                  <ClientRatesEditor
                    rates={formData.rates}
                    currency={formData.currency}
                    onChange={(rates) => setFormData((prev) => ({ ...prev, rates }))}
                    disabled={submitting}
                  />
                </div>

                {/* Retainer toggle */}
                <label className="flex cursor-pointer items-center justify-between rounded-[var(--radius)] border border-border bg-background px-4 py-3">
                  <span className="text-sm font-medium text-foreground">לקוח בריטיינר</span>
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
                  <div className="space-y-4 rounded-[var(--radius)] border border-border bg-background/50 p-4">
                    <div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
                      <div>
                        <label htmlFor="retainerHours" className="mb-1.5 block text-sm font-medium text-foreground">
                          שעות בריטיינר
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
                          סכום חודשי ({CURRENCY_SYMBOLS[formData.currency] || "₪"})
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
                      <span className="text-sm font-medium text-foreground">תעריף נפרד מעל הריטיינר</span>
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
                          תעריף שעתי מעל הריטיינר ({CURRENCY_SYMBOLS[formData.currency] || "₪"})
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
                  הערות
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
                  ביטול
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-[var(--radius-card)] bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {submitting ? "שומר..." : "שמור שינויים"}
                </button>
              </div>
            </form>
          </div>
        )}

        {clientLoading ? (
          <div className="rounded-[var(--radius-card)] bg-card p-8 border border-border/50 shadow-sm text-center text-muted-foreground">
            טוען נתוני לקוח...
          </div>
        ) : error ? (
          <div className="rounded-[var(--radius-card)] bg-card p-8 border border-border/50 shadow-sm">
            <div className="rounded-md bg-destructive/10 p-4 text-destructive">{error}</div>
          </div>
        ) : !client ? (
          <div className="rounded-[var(--radius-card)] bg-card p-8 border border-border/50 shadow-sm text-center text-muted-foreground">
            הלקוח לא נמצא
          </div>
        ) : (
          <div className="rounded-[var(--radius-card)] bg-card p-6 border border-border/50 shadow-sm">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-bold text-foreground">{client.name}</h2>
                {client.contactName && (
                  <p className="text-muted-foreground mt-1">איש קשר: {client.contactName}</p>
                )}
              </div>
              {client.isActive ? (
                <span className="inline-flex rounded-full bg-success/10 px-3 py-1 text-sm font-semibold leading-5 text-success">
                  פעיל
                </span>
              ) : (
                <span className="inline-flex rounded-full bg-muted px-3 py-1 text-sm font-semibold leading-5 text-foreground">
                  לא פעיל
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-1">אימייל</h3>
                <p className="text-foreground">
                  {client.email ? (
                    <a href={`mailto:${client.email}`} className="text-primary hover:text-primary/90">
                      {client.email}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">לא צוין</span>
                  )}
                </p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-1">טלפון</h3>
                <p className="text-foreground">
                  {client.phone ? (
                    <a href={`tel:${client.phone}`} className="text-primary hover:text-primary/90">
                      {client.phone}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">לא צוין</span>
                  )}
                </p>
              </div>

              <div className="md:col-span-2">
                <h3 className="text-sm font-medium text-muted-foreground mb-1">כתובת</h3>
                <p className="text-foreground">
                  {client.address || <span className="text-muted-foreground">לא צוינה</span>}
                </p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-1">מטבע</h3>
                <p className="text-foreground">
                  {CURRENCIES.find((c) => c.value === client.currency)?.label || client.currency}
                </p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-1">נוצר בתאריך</h3>
                <p className="text-foreground">
                  {new Date(client.createdAt).toLocaleDateString('he-IL')}
                </p>
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
                    <h3 className="font-display text-lg font-semibold text-foreground">תעריפים ופריטים</h3>
                    {client.isActive && (
                      <button
                        onClick={() => setShowEditForm(true)}
                        className="text-sm font-medium text-primary hover:text-primary/90"
                      >
                        ערוך תעריפים
                      </button>
                    )}
                  </div>
                  {!hasAny ? (
                    <p className="text-sm text-muted-foreground">
                      לא הוגדרו תעריפים ללקוח זה — לחץ &quot;ערוך תעריפים&quot; כדי להוסיף.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {hourly.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-muted-foreground mb-2">תעריפים שעתיים</h4>
                          <ul className="space-y-1.5">
                            {hourly.map((r) => (
                              <li key={r.id} className="flex items-center justify-between rounded-[var(--radius)] border border-border bg-background/50 px-3 py-2">
                                <span className="flex items-center gap-2 text-sm text-foreground">
                                  {r.name}
                                  {r.isDefault && (
                                    <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">
                                      ברירת מחדל
                                    </span>
                                  )}
                                </span>
                                <span className="font-mono text-sm tabular-nums text-foreground">
                                  {symbol}{r.rate}/שעה
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {items.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-muted-foreground mb-2">פריטים (מחיר ליחידה)</h4>
                          <ul className="space-y-1.5">
                            {items.map((r) => (
                              <li key={r.id} className="flex items-center justify-between rounded-[var(--radius)] border border-border bg-background/50 px-3 py-2">
                                <span className="text-sm text-foreground">{r.name}</span>
                                <span className="font-mono text-sm tabular-nums text-foreground">
                                  {symbol}{r.rate}/יח׳
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {client.isRetainer && (
                        <div>
                          <h4 className="text-sm font-medium text-muted-foreground mb-2">ריטיינר</h4>
                          <div className="rounded-[var(--radius)] border border-border bg-background/50 px-3 py-2 text-sm text-foreground">
                            <span className="tabular-nums">
                              {client.retainerHours ?? 0} שעות בחודש · {symbol}{client.retainerMonthlyFee ?? 0} לחודש
                            </span>
                            {client.overageRate != null && (
                              <span className="block text-muted-foreground">
                                תעריף מעל הריטיינר: {symbol}{client.overageRate}/שעה
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
                <h3 className="text-sm font-medium text-muted-foreground mb-2">הערות</h3>
                <div className="rounded-md bg-muted p-3">
                  <p className="text-foreground whitespace-pre-wrap">{client.notes}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {client && (
          <div className="mt-6 rounded-[var(--radius-card)] bg-card p-6 border border-border/50 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-lg font-semibold text-foreground">פרויקטים</h3>
              <a
                href={`/projects?create=true&clientId=${clientId}`}
                className="text-sm text-primary hover:text-primary/90 font-medium"
              >
                + הוסף פרויקט
              </a>
            </div>
            {projectsLoading ? (
              <p className="text-sm text-muted-foreground">טוען פרויקטים...</p>
            ) : clientProjects.length === 0 ? (
              <p className="text-sm text-muted-foreground">אין פרויקטים עדיין ללקוח זה</p>
            ) : (
              <div className="space-y-2">
                {clientProjects.map((project) => (
                  <a
                    key={project.id}
                    href={`/projects/${project.id}`}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors"
                  >
                    <span className="text-sm font-medium text-foreground">{project.name}</span>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                      project.status === "active" ? "bg-success/10 text-success" :
                      project.status === "completed" ? "bg-secondary-light text-secondary" :
                      project.status === "paused" ? "bg-accent text-accent-foreground" :
                      "bg-muted text-foreground"
                    }`}>
                      {project.status === "active" ? "פעיל" :
                       project.status === "completed" ? "הושלם" :
                       project.status === "paused" ? "מושהה" :
                       project.status === "archived" ? "בארכיון" : project.status}
                    </span>
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
      </PageContainer>
    </AppLayout>
  );
}
