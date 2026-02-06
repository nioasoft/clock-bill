"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { Users } from "lucide-react";
import { showSuccessToast, showErrorToast } from "@/lib/toast";

interface User {
  id: string;
  email: string;
}

interface Client {
  id: string;
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  defaultRate: number | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
}

export default function ClientsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
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
    notes: "",
  });
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [deleting, setDeleting] = useState(false);

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
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
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
          defaultRate: formData.defaultRate ? parseFloat(formData.defaultRate) : undefined,
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
        showSuccessToast("הלקוח נמחק בהצלחה");
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

  const cancelDelete = () => {
    setClientToDelete(null);
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
            <h1 className="text-2xl font-bold text-gray-900">לקוחות</h1>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="rounded-lg bg-orange-600 px-4 py-2 text-white hover:bg-orange-700"
          >
            {showForm ? "ביטול" : "+ לקוח חדש"}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Add/Edit Client Form */}
        {showForm && (
          <div className="mb-8 rounded-lg bg-white p-6 shadow">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              {editingClient ? "ערוך לקוח" : "הוסף לקוח חדש"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              {formError && (
                <div className="rounded-md bg-red-50 p-4 text-sm text-red-800">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                    שם הלקוח *
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
                  <label htmlFor="contactName" className="block text-sm font-medium text-gray-700">
                    איש קשר
                  </label>
                  <input
                    type="text"
                    id="contactName"
                    value={formData.contactName}
                    onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-orange-500"
                    disabled={submitting}
                  />
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                    אימייל
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-orange-500"
                    disabled={submitting}
                  />
                </div>

                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                    טלפון
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-orange-500"
                    disabled={submitting}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="address" className="block text-sm font-medium text-gray-700">
                    כתובת
                  </label>
                  <input
                    type="text"
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-orange-500"
                    disabled={submitting}
                    placeholder="רחוב, מספר, עיר"
                  />
                </div>

                <div>
                  <label htmlFor="defaultRate" className="block text-sm font-medium text-gray-700">
                    תעריף שעתי (₪)
                  </label>
                  <input
                    type="number"
                    id="defaultRate"
                    min="0"
                    step="0.01"
                    value={formData.defaultRate}
                    onChange={(e) => setFormData({ ...formData, defaultRate: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-orange-500"
                    disabled={submitting}
                  />
                </div>
              </div>

              <div>
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

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCancelEdit}
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
                  {submitting ? "שומר..." : editingClient ? "עדכן" : "שמור"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Clients List */}
        <div className="rounded-lg bg-white shadow">
          {clientsLoading ? (
            <div className="p-8 text-center text-gray-600">טוען לקוחות...</div>
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
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                      שם
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                      איש קשר
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                      אימייל
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                      טלפון
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                      כתובת
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                      תעריף שעתי
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                      סטטוס
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                      פעולות
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {clients.map((client) => (
                    <tr key={client.id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-6 py-4">
                        <Link
                          href={`/clients/${client.id}`}
                          className="text-sm font-medium text-orange-600 hover:text-orange-900"
                        >
                          {client.name}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="text-sm text-gray-900">{client.contactName || "-"}</div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="text-sm text-gray-900">{client.email || "-"}</div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="text-sm text-gray-900">{client.phone || "-"}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900 max-w-xs truncate">{client.address || "-"}</div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="text-sm text-gray-900">
                          {client.defaultRate ? `₪${client.defaultRate}/שעה` : "-"}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        {client.isActive ? (
                          <span className="inline-flex rounded-full bg-green-100 px-2 text-xs font-semibold leading-5 text-green-800">
                            פעיל
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-gray-100 px-2 text-xs font-semibold leading-5 text-gray-800">
                            לא פעיל
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm">
                        <button
                          onClick={() => handleEdit(client)}
                          className="text-orange-600 hover:text-orange-900 font-medium ms-2"
                        >
                          ערוך
                        </button>
                        {client.isActive && (
                          <button
                            onClick={() => handleDelete(client)}
                            className="text-red-600 hover:text-red-900 font-medium ms-2"
                          >
                            ארכב
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Delete Confirmation Dialog */}
      {clientToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="rounded-lg bg-white p-6 shadow-xl max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">ארכב לקוח</h3>
            <p className="text-gray-600 mb-6">
              האם לארכב את הלקוח "{clientToDelete.name}"? הלקוח יוסתר מהרשימה אך יישמר במערכת.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={cancelDelete}
                disabled={deleting}
                className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                ביטול
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? "מארכב..." : "ארכב"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
