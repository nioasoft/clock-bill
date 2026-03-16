"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { AppLayout } from "@/components/app-layout";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Users } from "lucide-react";
import { showSuccessToast, showErrorToast } from "@/lib/toast";
import {
  validateRequired,
  validateEmail,
  validatePhone,
  validateNumber,
} from "@/lib/validation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

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
  totalBilled: number;
  totalHours: number;
}

const CURRENCIES = [
  { value: "ILS", label: "₪ ILS" },
  { value: "USD", label: "$ USD" },
  { value: "USDT", label: "₮ USDT" },
  { value: "BTC", label: "₿ BTC" },
  { value: "ETH", label: "Ξ ETH" },
] as const;

const CURRENCY_SYMBOLS: Record<string, string> = {
  ILS: "₪",
  USD: "$",
  USDT: "₮",
  BTC: "₿",
  ETH: "Ξ",
};

export default function ClientsPage() {
  return (
    <Suspense>
      <ClientsPageContent />
    </Suspense>
  );
}

function ClientsPageContent() {
  const searchParams = useSearchParams();
  const [clients, setClients] = useState<Client[]>([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    contactName: "",
    email: "",
    phone: "",
    address: "",
    defaultRate: "",
    currency: "ILS",
    isRetainer: false,
    retainerHours: "",
    retainerMonthlyFee: "",
    hasOverageRate: false,
    overageRate: "",
    notes: "",
  });
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Field validation errors
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    email?: string;
    phone?: string;
    defaultRate?: string;
  }>({});

  // Auto-open create form via URL params
  useEffect(() => {
    if (searchParams.get("create") === "true") {
      setShowForm(true);
    }
  }, [searchParams]);

  useEffect(() => {
    const fetchClients = async () => {
      try {
        setClientsLoading(true);
        const response = await fetch("/api/clients");
        const data = await response.json();

        if (data.success) {
          setClients(data.clients || []);
        }
      } catch (error) {
        console.error("Error fetching clients:", error);
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

    // Validate form fields
    const errors: typeof fieldErrors = {};

    // Name is required
    const nameValidation = validateRequired(formData.name, "שם הלקוח");
    if (!nameValidation.isValid) {
      errors.name = nameValidation.error;
    }

    // Email is optional but must be valid if provided
    if (formData.email && formData.email.trim()) {
      const emailValidation = validateEmail(formData.email, false);
      if (!emailValidation.isValid) {
        errors.email = emailValidation.error;
      }
    }

    // Phone is optional but must be valid if provided
    if (formData.phone && formData.phone.trim()) {
      const phoneValidation = validatePhone(formData.phone, false);
      if (!phoneValidation.isValid) {
        errors.phone = phoneValidation.error;
      }
    }

    // Default rate is optional but must be valid number if provided
    if (formData.defaultRate && formData.defaultRate.trim()) {
      const rateValidation = validateNumber(formData.defaultRate, false, 0);
      if (!rateValidation.isValid) {
        errors.defaultRate = rateValidation.error;
      }
    }

    // If there are errors, display them and don't submit
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setSubmitting(true);

    try {
      const isEditing = editingClient !== null;
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
          isRetainer: formData.isRetainer,
          retainerHours: formData.isRetainer && formData.retainerHours ? parseFloat(formData.retainerHours) : undefined,
          retainerMonthlyFee: formData.isRetainer && formData.retainerMonthlyFee ? parseFloat(formData.retainerMonthlyFee) : undefined,
          overageRate: formData.isRetainer && formData.hasOverageRate && formData.overageRate ? parseFloat(formData.overageRate) : undefined,
          notes: formData.notes || undefined,
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
        }
        // Reset form and close
        setFormData({
          name: "",
          contactName: "",
          email: "",
          phone: "",
          address: "",
          defaultRate: "",
          currency: "ILS",
          isRetainer: false,
          retainerHours: "",
          retainerMonthlyFee: "",
          hasOverageRate: false,
          overageRate: "",
          notes: "",
        });
        setShowForm(false);
        setEditingClient(null);
      } else {
        setFormError(data.message || isEditing ? "שגיאה בעדכון הלקוח" : "שגיאה ביצירת הלקוח");
      }
    } catch (error) {
      console.error("Error saving client:", error);
      setFormError(editingClient ? "שגיאה בעדכון הלקוח" : "שגיאה ביצירת הלקוח");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setFormData({
      name: client.name,
      contactName: client.contactName || "",
      email: client.email || "",
      phone: client.phone || "",
      address: client.address || "",
      defaultRate: client.defaultRate?.toString() || "",
      currency: client.currency || "ILS",
      isRetainer: client.isRetainer ?? false,
      retainerHours: client.retainerHours?.toString() || "",
      retainerMonthlyFee: client.retainerMonthlyFee?.toString() || "",
      hasOverageRate: (client.overageRate ?? 0) > 0,
      overageRate: client.overageRate?.toString() || "",
      notes: client.notes || "",
    });
    setShowForm(true);
  };

  const handleCancelEdit = () => {
    setEditingClient(null);
    setFormData({
      name: "",
      contactName: "",
      email: "",
      phone: "",
      address: "",
      defaultRate: "",
      currency: "ILS",
      isRetainer: false,
      retainerHours: "",
      retainerMonthlyFee: "",
      hasOverageRate: false,
      overageRate: "",
      notes: "",
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
        setClientToDelete(null);
        // Close edit form if open
        setShowForm(false);
        setEditingClient(null);
        showSuccessToast("הלקוח הועבר לארכיון");
      } else {
        showErrorToast(data.message || "שגיאה במחיקת הלקוח");
      }
    } catch (error) {
      console.error("Error deleting client:", error);
      showErrorToast("שגיאה במחיקת הלקוח");
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
        // Close edit form if open
        setShowForm(false);
        setEditingClient(null);
        showSuccessToast("הלקוח שוחזר בהצלחה");
      } else {
        showErrorToast(data.message || "שגיאה בשחזור הלקוח");
      }
    } catch (error) {
      console.error("Error restoring client:", error);
      showErrorToast("שגיאה בשחזור הלקוח");
    }
  };

  const cancelDelete = () => {
    setClientToDelete(null);
  };

  return (
    <AppLayout>
      <PageContainer>
        <PageHeader title="לקוחות">
          <button
            onClick={() => setShowForm(!showForm)}
            className="rounded-[14px] bg-primary px-4 py-2 text-white hover:bg-primary/90"
          >
            {showForm ? "ביטול" : "+ לקוח חדש"}
          </button>
        </PageHeader>
        {/* Add/Edit Client Form */}
        {showForm && (
          <div className="mb-8 rounded-[14px] bg-surface p-6 shadow motion-safe:animate-scale-in">
            <h2 className="text-xl font-semibold text-foreground mb-4">
              {editingClient ? "ערוך לקוח" : "הוסף לקוח חדש"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              {formError && (
                <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-foreground">
                    שם הלקוח *
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
                    className={`mt-1 block w-full rounded-[var(--radius)] border bg-card px-3 py-2.5 shadow-sm focus:outline-none focus:ring-primary disabled:opacity-50 ${
                      fieldErrors.name
                        ? "border-destructive/30 focus:border-destructive focus:ring-destructive/20"
                        : "border-border focus:border-primary"
                    }`}
                    disabled={submitting}
                  />
                  {fieldErrors.name && <p className="mt-1 text-sm text-destructive">{fieldErrors.name}</p>}
                </div>

                <div>
                  <label htmlFor="contactName" className="block text-sm font-medium text-foreground">
                    איש קשר
                  </label>
                  <input
                    type="text"
                    id="contactName"
                    value={formData.contactName}
                    onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                    className="mt-1 block w-full rounded-[var(--radius)] border border-border bg-card px-3 py-2.5 shadow-sm focus:border-primary focus:outline-none focus:ring-primary disabled:opacity-50"
                    disabled={submitting}
                  />
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-foreground">
                    אימייל
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={formData.email}
                    onChange={(e) => {
                      setFormData({ ...formData, email: e.target.value });
                      setFieldErrors({ ...fieldErrors, email: undefined });
                    }}
                    className={`mt-1 block w-full rounded-[var(--radius)] border bg-card px-3 py-2.5 shadow-sm focus:outline-none focus:ring-primary disabled:opacity-50 ${
                      fieldErrors.email
                        ? "border-destructive/30 focus:border-destructive focus:ring-destructive/20"
                        : "border-border focus:border-primary"
                    }`}
                    disabled={submitting}
                  />
                  {fieldErrors.email && <p className="mt-1 text-sm text-destructive">{fieldErrors.email}</p>}
                </div>

                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-foreground">
                    טלפון
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => {
                      setFormData({ ...formData, phone: e.target.value });
                      setFieldErrors({ ...fieldErrors, phone: undefined });
                    }}
                    className={`mt-1 block w-full rounded-[var(--radius)] border bg-card px-3 py-2.5 shadow-sm focus:outline-none focus:ring-primary disabled:opacity-50 ${
                      fieldErrors.phone
                        ? "border-destructive/30 focus:border-destructive focus:ring-destructive/20"
                        : "border-border focus:border-primary"
                    }`}
                    disabled={submitting}
                  />
                  {fieldErrors.phone && <p className="mt-1 text-sm text-destructive">{fieldErrors.phone}</p>}
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="address" className="block text-sm font-medium text-foreground">
                    כתובת
                  </label>
                  <input
                    type="text"
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="mt-1 block w-full rounded-[var(--radius)] border border-border bg-card px-3 py-2.5 shadow-sm focus:border-primary focus:outline-none focus:ring-primary"
                    disabled={submitting}
                    placeholder="רחוב, מספר, עיר"
                  />
                </div>

                <div className="w-32">
                  <label htmlFor="currency" className="block text-sm font-medium text-foreground">
                    מטבע
                  </label>
                  <select
                    id="currency"
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                    className="mt-1 block w-full rounded-[var(--radius)] border border-border bg-card px-3 py-2.5 shadow-sm focus:border-primary focus:outline-none focus:ring-primary disabled:opacity-50"
                    disabled={submitting}
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>

                {/* Retainer toggle */}
                <div className="sm:col-span-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isRetainer}
                      onChange={(e) => setFormData({ ...formData, isRetainer: e.target.checked })}
                      className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                      disabled={submitting}
                    />
                    <span className="text-sm font-medium text-foreground">לקוח בריטיינר</span>
                  </label>
                </div>

                {/* Hourly rate - shown only when NOT retainer */}
                {!formData.isRetainer && (
                  <div>
                    <label htmlFor="defaultRate" className="block text-sm font-medium text-foreground">
                      תעריף שעתי ({CURRENCY_SYMBOLS[formData.currency] || "₪"})
                    </label>
                    <input
                      type="number"
                      id="defaultRate"
                      min="0"
                      step="0.01"
                      value={formData.defaultRate}
                      onChange={(e) => {
                        setFormData({ ...formData, defaultRate: e.target.value });
                        setFieldErrors({ ...fieldErrors, defaultRate: undefined });
                      }}
                      className={`mt-1 block w-full rounded-[var(--radius)] border bg-card px-3 py-2.5 shadow-sm focus:outline-none focus:ring-primary disabled:opacity-50 ${
                        fieldErrors.defaultRate
                          ? "border-destructive/30 focus:border-destructive focus:ring-destructive/20"
                          : "border-border focus:border-primary"
                      }`}
                      disabled={submitting}
                    />
                    {fieldErrors.defaultRate && (
                      <p className="mt-1 text-sm text-destructive">{fieldErrors.defaultRate}</p>
                    )}
                  </div>
                )}

                {/* Retainer fields - shown only when isRetainer is true */}
                {formData.isRetainer && (
                  <>
                    <div>
                      <label htmlFor="retainerHours" className="block text-sm font-medium text-foreground">
                        שעות בריטיינר
                      </label>
                      <input
                        type="number"
                        id="retainerHours"
                        min="0"
                        step="0.5"
                        value={formData.retainerHours}
                        onChange={(e) => setFormData({ ...formData, retainerHours: e.target.value })}
                        className="mt-1 block w-full rounded-[var(--radius)] border border-border bg-card px-3 py-2.5 shadow-sm focus:border-primary focus:outline-none focus:ring-primary disabled:opacity-50"
                        disabled={submitting}
                        placeholder="למשל 40"
                      />
                    </div>
                    <div>
                      <label htmlFor="retainerMonthlyFee" className="block text-sm font-medium text-foreground">
                        סכום חודשי ({CURRENCY_SYMBOLS[formData.currency] || "₪"})
                      </label>
                      <input
                        type="number"
                        id="retainerMonthlyFee"
                        min="0"
                        step="0.01"
                        value={formData.retainerMonthlyFee}
                        onChange={(e) => setFormData({ ...formData, retainerMonthlyFee: e.target.value })}
                        className="mt-1 block w-full rounded-[var(--radius)] border border-border bg-card px-3 py-2.5 shadow-sm focus:border-primary focus:outline-none focus:ring-primary disabled:opacity-50"
                        disabled={submitting}
                        placeholder="למשל 10000"
                      />
                    </div>

                    {/* Overflow rate toggle */}
                    <div className="sm:col-span-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.hasOverageRate}
                          onChange={(e) => setFormData({ ...formData, hasOverageRate: e.target.checked })}
                          className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                          disabled={submitting}
                        />
                        <span className="text-sm font-medium text-foreground">תעריף נפרד מעל הריטיינר</span>
                      </label>
                    </div>

                    {/* Overflow rate field */}
                    {formData.hasOverageRate && (
                      <div>
                        <label htmlFor="overageRate" className="block text-sm font-medium text-foreground">
                          תעריף שעתי מעל הריטיינר ({CURRENCY_SYMBOLS[formData.currency] || "₪"})
                        </label>
                        <input
                          type="number"
                          id="overageRate"
                          min="0"
                          step="0.01"
                          value={formData.overageRate}
                          onChange={(e) => setFormData({ ...formData, overageRate: e.target.value })}
                          className="mt-1 block w-full rounded-[var(--radius)] border border-border bg-card px-3 py-2.5 shadow-sm focus:border-primary focus:outline-none focus:ring-primary disabled:opacity-50"
                          disabled={submitting}
                        />
                      </div>
                    )}
                  </>
                )}
              </div>

              <div>
                <label htmlFor="notes" className="block text-sm font-medium text-foreground">
                  הערות
                </label>
                <textarea
                  id="notes"
                  rows={3}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="mt-1 block w-full rounded-[var(--radius)] border border-border bg-card px-3 py-2.5 shadow-sm focus:border-primary focus:outline-none focus:ring-primary"
                  disabled={submitting}
                />
              </div>

              {editingClient && (
                <div className="border-t border-border pt-4 mt-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {editingClient.isActive ? "העבר לארכיון" : "שחזר מארכיון"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {editingClient.isActive
                          ? "הלקוח יוסתר מהרשימה אך יישמר במערכת"
                          : "הלקוח יוחזר לרשימה הפעילה"}
                      </p>
                    </div>
                    {editingClient.isActive ? (
                      <button
                        type="button"
                        onClick={() => handleDelete(editingClient)}
                        className="rounded-[14px] border border-destructive/30 px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10"
                      >
                        ארכב לקוח
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleRestore(editingClient)}
                        className="rounded-[14px] border border-success/30 px-3 py-1.5 text-sm text-success hover:bg-success/10"
                      >
                        שחזר לקוח
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="rounded-[14px] border border-border px-4 py-2 text-foreground hover:bg-muted"
                  disabled={submitting}
                >
                  ביטול
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-[14px] bg-primary px-4 py-2 text-white hover:bg-primary/90 disabled:opacity-50"
                >
                  {submitting ? "שומר..." : editingClient ? "עדכן" : "שמור"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Clients List */}
        <div className="rounded-[14px] bg-card shadow">
          {clientsLoading ? (
            <div className="p-8 text-center text-muted-foreground">טוען לקוחות...</div>
          ) : clients.length === 0 ? (
            <EmptyState
              icon={Users}
              message="אין לקוחות עדיין"
              description="צור לקוח ראשון כדי להתחיל לנהל את הפרויקטים שלך"
              actionLabel="הוסף לקוח ראשון"
              onAction={() => setShowForm(true)}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border">
                <thead className="bg-surface">
                  <tr>
                    <th className="px-6 py-3 text-start text-xs uppercase tracking-wider font-semibold text-foreground">
                      שם
                    </th>
                    <th className="px-6 py-3 text-start text-xs uppercase tracking-wider font-semibold text-foreground">
                      איש קשר
                    </th>
                    <th className="px-6 py-3 text-start text-xs uppercase tracking-wider font-semibold text-foreground">
                      אימייל
                    </th>
                    <th className="px-6 py-3 text-start text-xs uppercase tracking-wider font-semibold text-foreground">
                      טלפון
                    </th>
                    <th className="px-6 py-3 text-start text-xs uppercase tracking-wider font-semibold text-foreground">
                      כתובת
                    </th>
                    <th className="px-6 py-3 text-start text-xs uppercase tracking-wider font-semibold text-foreground">
                      תעריף שעתי
                    </th>
                    <th className="px-6 py-3 text-start text-xs uppercase tracking-wider font-semibold text-foreground">
                      סך חויב
                    </th>
                    <th className="px-6 py-3 text-start text-xs uppercase tracking-wider font-semibold text-foreground">
                      שעות
                    </th>
                    <th className="px-6 py-3 text-start text-xs uppercase tracking-wider font-semibold text-foreground">
                      סטטוס
                    </th>
                    <th className="px-6 py-3 text-start text-xs uppercase tracking-wider font-semibold text-foreground">
                      פעולות
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-card">
                  {clients.map((client) => (
                    <tr key={client.id} className="even:bg-surface/50 hover:bg-surface">
                      <td className="whitespace-nowrap px-6 py-4">
                        <Link
                          href={`/clients/${client.id}`}
                          className="text-sm font-medium text-primary hover:text-primary/90"
                        >
                          {client.name}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="text-sm text-foreground">{client.contactName || "-"}</div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="text-sm text-foreground">{client.email || "-"}</div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="text-sm text-foreground">{client.phone || "-"}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-foreground max-w-xs truncate">{client.address || "-"}</div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="text-sm text-foreground">
                          {client.defaultRate ? `${CURRENCY_SYMBOLS[client.currency] || "₪"}${client.defaultRate}/שעה` : "-"}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="text-sm font-medium text-foreground">
                          {Number(client.totalBilled) > 0 ? `₪${Number(client.totalBilled).toFixed(2)}` : "₪0"}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="text-sm text-foreground">
                          {Number(client.totalHours) > 0 ? `${Number(client.totalHours).toFixed(1)} שעות` : "0 שעות"}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        {client.isActive ? (
                          <span className="inline-flex rounded-full bg-success/10 text-success px-3 py-0.5 text-xs font-semibold">
                            פעיל
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-muted text-muted-foreground px-3 py-0.5 text-xs font-semibold">
                            לא פעיל
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm">
                        <button
                          onClick={() => handleEdit(client)}
                          className="text-primary hover:text-primary/90 font-medium ms-2"
                        >
                          ערוך
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </PageContainer>
      {/* Delete Confirmation Dialog */}
      <Dialog open={!!clientToDelete} onOpenChange={(open) => { if (!open) cancelDelete(); }}>
        <DialogContent showCloseButton={false} className="motion-safe:animate-scale-in border-destructive/20">
          <DialogHeader>
            <DialogTitle>ארכב לקוח</DialogTitle>
            <DialogDescription>
              האם לארכב את הלקוח &quot;{clientToDelete?.name}&quot;? הלקוח יוסתר מהרשימה אך יישמר במערכת.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <button
              onClick={cancelDelete}
              disabled={deleting}
              className="rounded-[14px] border border-border px-4 py-2 text-foreground hover:bg-muted disabled:opacity-50"
            >
              ביטול
            </button>
            <button
              onClick={confirmDelete}
              disabled={deleting}
              className="rounded-[14px] bg-destructive px-4 py-2 text-white hover:bg-destructive/90 disabled:opacity-50"
            >
              {deleting ? "מארכב..." : "ארכב"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
