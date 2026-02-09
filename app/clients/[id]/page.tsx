"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { AppLayout } from "@/components/app-layout";
import { PageContainer } from "@/components/page-container";
import { Breadcrumb } from "@/components/breadcrumb";

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
  const [clientProjects, setClientProjects] = useState<{id: string; name: string; status: string}[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);

  useEffect(() => {
    const fetchClient = async () => {
      if (!clientId) return;
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
                  className="rounded-[14px] border border-border px-4 py-2 text-foreground hover:bg-muted"
                >
                  ערוך
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="rounded-[14px] border border-destructive/30 px-4 py-2 text-destructive hover:bg-destructive/10"
                >
                  מחק
                </button>
              </div>
            )}
          </div>
        {showDeleteConfirm && (
          <div className="mb-6 rounded-[14px] bg-destructive/10 p-6 border border-border/50 shadow-sm border border-destructive/20">
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
                className="rounded-[14px] border border-border px-4 py-2 text-foreground hover:bg-muted bg-card"
                disabled={submitting}
              >
                ביטול
              </button>
              <button
                onClick={handleDelete}
                disabled={submitting}
                className="rounded-[14px] bg-destructive px-4 py-2 text-white hover:bg-destructive/90 disabled:opacity-50"
              >
                {submitting ? "מוחק..." : "מחק לקוח"}
              </button>
            </div>
          </div>
        )}

        {showEditForm && (
          <div className="mb-6 rounded-[14px] bg-card p-6 border border-border/50 shadow-sm">
            <h2 className="text-xl font-semibold text-foreground mb-4">ערוך לקוח</h2>
            <form onSubmit={handleEdit} className="space-y-4">
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
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-border/50 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary"
                    disabled={submitting}
                  />
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
                    className="mt-1 block w-full rounded-md border border-border/50 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary"
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
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-border/50 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary"
                    disabled={submitting}
                  />
                </div>

                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-foreground">
                    טלפון
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-border/50 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary"
                    disabled={submitting}
                  />
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
                    className="mt-1 block w-full rounded-md border border-border/50 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary"
                    disabled={submitting}
                    placeholder="רחוב, מספר, עיר"
                  />
                </div>

                <div>
                  <label htmlFor="defaultRate" className="block text-sm font-medium text-foreground">
                    תעריף שעתי (₪)
                  </label>
                  <input
                    type="number"
                    id="defaultRate"
                    min="0"
                    step="0.01"
                    value={formData.defaultRate}
                    onChange={(e) => setFormData({ ...formData, defaultRate: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-border/50 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary"
                    disabled={submitting}
                  />
                </div>
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
                  className="mt-1 block w-full rounded-md border border-border px-3 py-2 border border-border/50 border border-border/50 shadow-sm-sm focus:border-primary focus:outline-none focus:ring-primary"
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
                  {submitting ? "שומר..." : "שמור שינויים"}
                </button>
              </div>
            </form>
          </div>
        )}

        {clientLoading ? (
          <div className="rounded-[14px] bg-card p-8 border border-border/50 shadow-sm text-center text-muted-foreground">
            טוען נתוני לקוח...
          </div>
        ) : error ? (
          <div className="rounded-[14px] bg-card p-8 border border-border/50 shadow-sm">
            <div className="rounded-md bg-destructive/10 p-4 text-destructive">{error}</div>
          </div>
        ) : !client ? (
          <div className="rounded-[14px] bg-card p-8 border border-border/50 shadow-sm text-center text-muted-foreground">
            הלקוח לא נמצא
          </div>
        ) : (
          <div className="rounded-[14px] bg-card p-6 border border-border/50 shadow-sm">
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
                <h3 className="text-sm font-medium text-muted-foreground mb-1">תעריף שעתי</h3>
                <p className="text-foreground">
                  {client.defaultRate ? `₪${client.defaultRate}/שעה` : <span className="text-muted-foreground">לא צוין</span>}
                </p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-1">נוצר בתאריך</h3>
                <p className="text-foreground">
                  {new Date(client.createdAt).toLocaleDateString('he-IL')}
                </p>
              </div>
            </div>

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
          <div className="mt-6 rounded-[14px] bg-card p-6 border border-border/50 shadow-sm">
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
                      project.status === "paused" ? "bg-accent text-foreground" :
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
