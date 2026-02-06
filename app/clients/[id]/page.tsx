"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

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

export default function ClientDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const clientId = params.id as string;

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
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
    defaultRate: "",
    notes: "",
  });
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch("/api/auth/session");
        const data = await response.json();
        if (data.success && data.user) {
          setUser(data.user);
        } else {
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
    const fetchClient = async () => {
      if (!user || !clientId) return;
      try {
        setClientLoading(true);
        const response = await fetch(`/api/clients/${clientId}`);
        const data = await response.json();
        if (data.success) {
          setClient(data.client);
          setFormData({
            name: data.client.name || "",
            contactName: data.client.contactName || "",
            email: data.client.email || "",
            phone: data.client.phone || "",
            address: data.client.address || "",
            defaultRate: data.client.defaultRate?.toString() || "",
            notes: data.client.notes || "",
          });
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
  }, [user, clientId]);

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
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
          defaultRate: formData.defaultRate ? parseFloat(formData.defaultRate) : undefined,
          notes: formData.notes || undefined,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setClient(data.client);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center" dir="rtl">
        <div className="text-gray-600">טוען...</div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-zinc-50" dir="rtl">
      <header className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/clients" className="text-gray-600 hover:text-gray-900">
              ← חזור ללקוחות
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">פרטי לקוח</h1>
          </div>
          {client && client.isActive && (
            <div className="flex gap-2">
              <button
                onClick={() => setShowEditForm(true)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
              >
                ערוך
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="rounded-lg border border-red-300 px-4 py-2 text-red-700 hover:bg-red-50"
              >
                מחק
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        {showDeleteConfirm && (
          <div className="mb-6 rounded-lg bg-red-50 p-6 shadow border border-red-200">
            <h2 className="text-xl font-semibold text-red-900 mb-4">מחק לקוח</h2>
            <p className="text-red-800 mb-4">
              האם אתה בטוח שברצונך למחוק את הלקוח &quot;{client?.name}&quot;? לקוחות שנמחקים יועברו למצב &quot;לא פעיל&quot; ולא יוצגו ברשימה.
            </p>
            {formError && (
              <div className="rounded-md bg-red-100 p-3 text-sm text-red-800 mb-4">
                {formError}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setFormError("");
                }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50 bg-white"
                disabled={submitting}
              >
                ביטול
              </button>
              <button
                onClick={handleDelete}
                disabled={submitting}
                className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:opacity-50"
              >
                {submitting ? "מוחק..." : "מחק לקוח"}
              </button>
            </div>
          </div>
        )}

        {showEditForm && (
          <div className="mb-6 rounded-lg bg-white p-6 shadow">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">ערוך לקוח</h2>
            <form onSubmit={handleEdit} className="space-y-4">
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
                  onClick={() => {
                    setShowEditForm(false);
                    setFormError("");
                    if (client) {
                      setFormData({
                        name: client.name || "",
                        contactName: client.contactName || "",
                        email: client.email || "",
                        phone: client.phone || "",
                        address: client.address || "",
                        defaultRate: client.defaultRate?.toString() || "",
                        notes: client.notes || "",
                      });
                    }
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

        {clientLoading ? (
          <div className="rounded-lg bg-white p-8 shadow text-center text-gray-600">
            טוען נתוני לקוח...
          </div>
        ) : error ? (
          <div className="rounded-lg bg-white p-8 shadow">
            <div className="rounded-md bg-red-50 p-4 text-red-800">{error}</div>
          </div>
        ) : !client ? (
          <div className="rounded-lg bg-white p-8 shadow text-center text-gray-600">
            הלקוח לא נמצא
          </div>
        ) : (
          <div className="rounded-lg bg-white p-6 shadow">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{client.name}</h2>
                {client.contactName && (
                  <p className="text-gray-600 mt-1">איש קשר: {client.contactName}</p>
                )}
              </div>
              {client.isActive ? (
                <span className="inline-flex rounded-full bg-green-100 px-3 py-1 text-sm font-semibold leading-5 text-green-800">
                  פעיל
                </span>
              ) : (
                <span className="inline-flex rounded-full bg-gray-100 px-3 py-1 text-sm font-semibold leading-5 text-gray-800">
                  לא פעיל
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">אימייל</h3>
                <p className="text-gray-900">
                  {client.email ? (
                    <a href={`mailto:${client.email}`} className="text-orange-600 hover:text-orange-900">
                      {client.email}
                    </a>
                  ) : (
                    <span className="text-gray-400">לא צוין</span>
                  )}
                </p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">טלפון</h3>
                <p className="text-gray-900">
                  {client.phone ? (
                    <a href={`tel:${client.phone}`} className="text-orange-600 hover:text-orange-900">
                      {client.phone}
                    </a>
                  ) : (
                    <span className="text-gray-400">לא צוין</span>
                  )}
                </p>
              </div>

              <div className="md:col-span-2">
                <h3 className="text-sm font-medium text-gray-500 mb-1">כתובת</h3>
                <p className="text-gray-900">
                  {client.address || <span className="text-gray-400">לא צוינה</span>}
                </p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">תעריף שעתי</h3>
                <p className="text-gray-900">
                  {client.defaultRate ? `₪${client.defaultRate}/שעה` : <span className="text-gray-400">לא צוין</span>}
                </p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">נוצר בתאריך</h3>
                <p className="text-gray-900">
                  {new Date(client.createdAt).toLocaleDateString('he-IL')}
                </p>
              </div>
            </div>

            {client.notes && (
              <div className="mt-6">
                <h3 className="text-sm font-medium text-gray-500 mb-2">הערות</h3>
                <div className="rounded-md bg-gray-50 p-3">
                  <p className="text-gray-900 whitespace-pre-wrap">{client.notes}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
