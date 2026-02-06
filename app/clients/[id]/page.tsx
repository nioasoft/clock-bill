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
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
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
          <div className="space-y-6">
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

            <div className="flex justify-end gap-3">
              <Link href="/clients" className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50">
                חזור לרשימה
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
