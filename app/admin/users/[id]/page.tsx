"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/app-layout";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowRight,
  Shield,
  KeyRound,
  MailCheck,
  LogOut,
  Trash2,
  Copy,
  Check,
} from "lucide-react";
import Link from "next/link";

interface UserDetail {
  id: string;
  email: string;
  emailVerified: boolean;
  role: string;
  createdAt: string;
}

interface Profile {
  business_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  tax_id: string | null;
  website: string | null;
  default_currency: string | null;
  preferred_pdf_template: string | null;
  logo_url: string | null;
}

interface Client {
  id: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  is_active: boolean;
  created_at: string;
}

interface Project {
  id: string;
  name: string;
  client_id: string;
  pricing_model: string;
  currency: string;
  status: string;
  created_at: string;
}

interface Entry {
  id: string;
  description: string;
  date: string;
  duration: number;
  start_time: string | null;
  end_time: string | null;
  project_id: string;
}

interface Session {
  id: string;
  createdAt: string;
  expiresAt: string;
  isExpired: boolean;
}

type TabId = "profile" | "clients" | "projects" | "entries" | "sessions" | "actions";

const tabs: { id: TabId; label: string }[] = [
  { id: "profile", label: "פרופיל" },
  { id: "clients", label: "לקוחות" },
  { id: "projects", label: "פרויקטים" },
  { id: "entries", label: "רשומות" },
  { id: "sessions", label: "הפעלות" },
  { id: "actions", label: "פעולות" },
];

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}:${String(m).padStart(2, "0")}`;
}

export default function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: userId } = use(params);
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>("profile");
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserDetail | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch(`/api/admin/users/${userId}`);
        if (response.status === 403) {
          router.push("/dashboard");
          return;
        }
        const data = await response.json();
        if (data.success) {
          setUser(data.user);
          setProfile(data.profile);
          setClients(data.clients);
          setProjects(data.projects);
          setEntries(data.recentEntries);
          setSessions(data.sessions);
        }
      } catch (err) {
        console.error("Error fetching user detail:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [userId, router]);

  const performAction = async (action: string) => {
    setActionLoading(action);
    setActionResult(null);
    setTempPassword(null);
    try {
      const response = await fetch(`/api/admin/users/${userId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await response.json();
      if (data.success) {
        setActionResult({ type: "success", message: data.message });
        if (data.tempPassword) {
          setTempPassword(data.tempPassword);
        }
        if (action === "delete_user") {
          setTimeout(() => router.push("/admin/users"), 1500);
        }
        if (action === "toggle_role" && user) {
          setUser({ ...user, role: data.newRole });
        }
        if (action === "verify_email" && user) {
          setUser({ ...user, emailVerified: true });
        }
        if (action === "delete_sessions") {
          setSessions([]);
        }
      } else {
        setActionResult({ type: "error", message: data.message });
      }
    } catch (err) {
      console.error("Action error:", err);
      setActionResult({ type: "error", message: "שגיאה בביצוע הפעולה" });
    } finally {
      setActionLoading(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <AppLayout>
        <PageContainer>
          <Skeleton className="h-8 w-48 mb-4" />
          <Skeleton className="h-64 w-full rounded-[14px]" />
        </PageContainer>
      </AppLayout>
    );
  }

  if (!user) {
    return (
      <AppLayout>
        <PageContainer>
          <div className="text-center py-12">
            <p className="text-muted-foreground">משתמש לא נמצא</p>
            <Link href="/admin/users" className="text-primary text-sm mt-2 inline-block">
              חזרה לרשימת המשתמשים
            </Link>
          </div>
        </PageContainer>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageContainer>
        {/* Back link */}
        <Link
          href="/admin/users"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
        >
          <ArrowRight className="h-4 w-4" />
          חזרה לרשימת המשתמשים
        </Link>

        <PageHeader title={user.email}>
          {user.role === "admin" && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded-full">
              <Shield className="h-3 w-3" />
              מנהל
            </span>
          )}
        </PageHeader>

        {/* Tabs */}
        <div className="border-b border-border mb-6 overflow-x-auto">
          <div className="flex gap-0 min-w-max" role="tablist">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
                role="tab"
                aria-selected={activeTab === tab.id}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        {activeTab === "profile" && (
          <div className="rounded-[14px] bg-card border border-border/50 p-6 shadow-sm">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">אימייל</p>
                <p className="text-sm text-foreground">{user.email}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">אימייל מאומת</p>
                <p className="text-sm text-foreground">{user.emailVerified ? "כן" : "לא"}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">תפקיד</p>
                <p className="text-sm text-foreground">{user.role === "admin" ? "מנהל" : "משתמש"}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">תאריך רישום</p>
                <p className="text-sm text-foreground">
                  {new Date(user.createdAt).toLocaleDateString("he-IL", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
              {profile && (
                <>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">שם עסק</p>
                    <p className="text-sm text-foreground">{profile.business_name || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">טלפון</p>
                    <p className="text-sm text-foreground">{profile.phone || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">כתובת</p>
                    <p className="text-sm text-foreground">{profile.address || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">ח.פ / ע.מ</p>
                    <p className="text-sm text-foreground">{profile.tax_id || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">מטבע</p>
                    <p className="text-sm text-foreground">{profile.default_currency || "ILS"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">תבנית PDF</p>
                    <p className="text-sm text-foreground">{profile.preferred_pdf_template || "modern"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">לוגו</p>
                    <p className="text-sm text-foreground">{profile.logo_url ? "הועלה" : "לא הועלה"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">אתר</p>
                    <p className="text-sm text-foreground">{profile.website || "—"}</p>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {activeTab === "clients" && (
          <div className="rounded-[14px] bg-card border border-border/50 shadow-sm overflow-hidden">
            {clients.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">אין לקוחות</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-start px-4 py-3 font-medium text-muted-foreground">שם</th>
                    <th className="text-start px-4 py-3 font-medium text-muted-foreground">איש קשר</th>
                    <th className="text-start px-4 py-3 font-medium text-muted-foreground">אימייל</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground">סטטוס</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((c) => (
                    <tr key={c.id} className="border-b border-border/50">
                      <td className="px-4 py-3 font-medium text-foreground">{c.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{c.contact_name || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{c.email || "—"}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${c.is_active ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                          {c.is_active ? "פעיל" : "לא פעיל"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === "projects" && (
          <div className="rounded-[14px] bg-card border border-border/50 shadow-sm overflow-hidden">
            {projects.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">אין פרויקטים</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-start px-4 py-3 font-medium text-muted-foreground">שם</th>
                    <th className="text-start px-4 py-3 font-medium text-muted-foreground">מודל תמחור</th>
                    <th className="text-start px-4 py-3 font-medium text-muted-foreground">מטבע</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground">סטטוס</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((p) => (
                    <tr key={p.id} className="border-b border-border/50">
                      <td className="px-4 py-3 font-medium text-foreground">{p.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.pricing_model}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.currency}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          p.status === "active" ? "bg-success/10 text-success" :
                          p.status === "paused" ? "bg-accent/10 text-accent" :
                          "bg-muted text-muted-foreground"
                        }`}>
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === "entries" && (
          <div className="rounded-[14px] bg-card border border-border/50 shadow-sm overflow-hidden">
            {entries.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">אין רשומות זמן</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-start px-4 py-3 font-medium text-muted-foreground">תיאור</th>
                    <th className="text-start px-4 py-3 font-medium text-muted-foreground">תאריך</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground">משך</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.id} className="border-b border-border/50">
                      <td className="px-4 py-3 font-medium text-foreground max-w-xs truncate">{e.description}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Date(e.date).toLocaleDateString("he-IL")}
                      </td>
                      <td className="px-4 py-3 text-center font-mono tabular-nums">
                        {formatDuration(e.duration)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === "sessions" && (
          <div className="space-y-4">
            <div className="rounded-[14px] bg-card border border-border/50 shadow-sm overflow-hidden">
              {sessions.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">אין הפעלות</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="text-start px-4 py-3 font-medium text-muted-foreground">נוצר</th>
                      <th className="text-start px-4 py-3 font-medium text-muted-foreground">פג תוקף</th>
                      <th className="text-center px-4 py-3 font-medium text-muted-foreground">סטטוס</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((s) => (
                      <tr key={s.id} className="border-b border-border/50">
                        <td className="px-4 py-3 text-muted-foreground">
                          {new Date(s.createdAt).toLocaleDateString("he-IL", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {new Date(s.expiresAt).toLocaleDateString("he-IL", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            s.isExpired ? "bg-muted text-muted-foreground" : "bg-success/10 text-success"
                          }`}>
                            {s.isExpired ? "פג תוקף" : "פעיל"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {activeTab === "actions" && (
          <div className="space-y-4">
            {/* Action result */}
            {actionResult && (
              <div className={`rounded-lg p-4 text-sm ${
                actionResult.type === "success"
                  ? "bg-success/10 text-success"
                  : "bg-destructive/10 text-destructive"
              }`}>
                {actionResult.message}
              </div>
            )}

            {/* Temp password display */}
            {tempPassword && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
                <p className="text-sm font-medium text-foreground mb-2">סיסמה זמנית:</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-muted px-3 py-2 rounded text-sm font-mono" dir="ltr">
                    {tempPassword}
                  </code>
                  <button
                    onClick={() => copyToClipboard(tempPassword)}
                    className="p-2 rounded-lg border border-border hover:bg-muted transition-colors"
                    title="העתק"
                  >
                    {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">שמור את הסיסמה - היא לא תוצג שוב</p>
              </div>
            )}

            <div className="rounded-[14px] bg-card border border-border/50 p-6 shadow-sm space-y-4">
              {/* Reset password */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">איפוס סיסמה</p>
                  <p className="text-xs text-muted-foreground">יצירת סיסמה זמנית חדשה וניתוק כל ההפעלות</p>
                </div>
                <button
                  onClick={() => performAction("reset_password")}
                  disabled={actionLoading !== null}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg border border-border hover:bg-muted disabled:opacity-50 transition-colors"
                >
                  <KeyRound className="h-4 w-4" />
                  {actionLoading === "reset_password" ? "מאפס..." : "איפוס"}
                </button>
              </div>

              {/* Verify email */}
              {!user.emailVerified && (
                <div className="flex items-center justify-between border-t border-border pt-4">
                  <div>
                    <p className="text-sm font-medium text-foreground">אימות אימייל</p>
                    <p className="text-xs text-muted-foreground">סימון האימייל כמאומת ידנית</p>
                  </div>
                  <button
                    onClick={() => performAction("verify_email")}
                    disabled={actionLoading !== null}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg border border-border hover:bg-muted disabled:opacity-50 transition-colors"
                  >
                    <MailCheck className="h-4 w-4" />
                    {actionLoading === "verify_email" ? "מאמת..." : "אמת"}
                  </button>
                </div>
              )}

              {/* Delete sessions */}
              <div className="flex items-center justify-between border-t border-border pt-4">
                <div>
                  <p className="text-sm font-medium text-foreground">ניתוק הפעלות</p>
                  <p className="text-xs text-muted-foreground">מחיקת כל ההפעלות הפעילות</p>
                </div>
                <button
                  onClick={() => performAction("delete_sessions")}
                  disabled={actionLoading !== null}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg border border-border hover:bg-muted disabled:opacity-50 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  {actionLoading === "delete_sessions" ? "מנתק..." : "נתק הכל"}
                </button>
              </div>

              {/* Toggle role */}
              <div className="flex items-center justify-between border-t border-border pt-4">
                <div>
                  <p className="text-sm font-medium text-foreground">שינוי תפקיד</p>
                  <p className="text-xs text-muted-foreground">
                    {user.role === "admin" ? "הורדה למשתמש רגיל" : "הפיכה למנהל"}
                  </p>
                </div>
                <button
                  onClick={() => performAction("toggle_role")}
                  disabled={actionLoading !== null}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg border border-border hover:bg-muted disabled:opacity-50 transition-colors"
                >
                  <Shield className="h-4 w-4" />
                  {actionLoading === "toggle_role" ? "משנה..." : user.role === "admin" ? "הורד" : "הפוך למנהל"}
                </button>
              </div>

              {/* Delete user */}
              <div className="flex items-center justify-between border-t border-destructive/30 pt-4">
                <div>
                  <p className="text-sm font-medium text-destructive">מחיקת משתמש</p>
                  <p className="text-xs text-muted-foreground">מחיקת המשתמש וכל הנתונים שלו לצמיתות</p>
                </div>
                {deleteConfirm ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        performAction("delete_user");
                        setDeleteConfirm(false);
                      }}
                      disabled={actionLoading !== null}
                      className="px-4 py-2 text-sm rounded-lg bg-destructive text-white hover:bg-destructive/90 disabled:opacity-50 transition-colors"
                    >
                      {actionLoading === "delete_user" ? "מוחק..." : "אישור מחיקה"}
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(false)}
                      className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-muted transition-colors"
                    >
                      ביטול
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeleteConfirm(true)}
                    disabled={actionLoading !== null}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/10 disabled:opacity-50 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                    מחק
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </PageContainer>
    </AppLayout>
  );
}
