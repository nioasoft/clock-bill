"use client";

import { useEffect, useState, use } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "@/src/i18n/navigation";
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
import { Link } from "@/src/i18n/navigation";
import { messageForError } from "@/lib/api-error";

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

const tabIds: TabId[] = ["profile", "clients", "projects", "entries", "sessions", "actions"];

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
  const t = useTranslations("Admin");
  const tRoot = useTranslations();
  const intlLocale = useLocale() === "en" ? "en-US" : "he-IL";
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
        setActionResult({ type: "error", message: data.error_code ? messageForError(data, tRoot) : (data.message || t("detail.actionError")) });
      }
    } catch (err) {
      console.error("Action error:", err);
      setActionResult({ type: "error", message: t("detail.actionError") });
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
          <div role="status" aria-busy="true" aria-label={t("users.title")}>
            <Skeleton className="h-8 w-48 mb-4" />
            <Skeleton className="h-64 w-full rounded-[var(--radius-card)]" />
          </div>
        </PageContainer>
      </AppLayout>
    );
  }

  if (!user) {
    return (
      <AppLayout>
        <PageContainer>
          <div role="status" className="text-center py-12">
            <p className="text-muted-foreground">{t("detail.notFound")}</p>
            <Link href="/admin/users" className="mt-2 inline-flex min-h-11 items-center rounded-[var(--radius)] px-3 text-sm text-primary hover:bg-primary/10">
              {t("detail.backToUsers")}
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
          className="mb-4 inline-flex min-h-11 touch-manipulation items-center gap-1 rounded-[var(--radius)] px-2 text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
        >
          <ArrowRight className="h-4 w-4 rtl:-scale-x-100" aria-hidden="true" />
          {t("detail.backToUsers")}
        </Link>

        <PageHeader title={user.email}>
          {user.role === "admin" && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded-full">
              <Shield className="h-3 w-3" />
              {t("detail.roleAdmin")}
            </span>
          )}
        </PageHeader>

        {/* Tabs */}
        <div className="border-b border-border mb-6 overflow-x-auto">
          <div className="flex gap-0 min-w-max" role="tablist">
            {tabIds.map((tabId) => (
              <button
                key={tabId}
                onClick={() => setActiveTab(tabId)}
                className={`min-h-11 touch-manipulation whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                  activeTab === tabId
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
                role="tab"
                aria-selected={activeTab === tabId}
              >
                {t(`detail.tabs.${tabId}`)}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        {activeTab === "profile" && (
          <div className="rounded-[var(--radius-card)] bg-card border border-border/50 p-6">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">{t("detail.profile.email")}</p>
                <p className="text-sm text-foreground">{user.email}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">{t("detail.profile.emailVerified")}</p>
                <p className="text-sm text-foreground">{user.emailVerified ? t("detail.yes") : t("detail.no")}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">{t("detail.profile.role")}</p>
                <p className="text-sm text-foreground">{user.role === "admin" ? t("detail.roleAdmin") : t("detail.roleUser")}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">{t("detail.profile.registrationDate")}</p>
                <p className="text-sm text-foreground">
                  {new Date(user.createdAt).toLocaleDateString(intlLocale, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
              {profile && (
                <>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">{t("detail.profile.businessName")}</p>
                    <p className="text-sm text-foreground">{profile.business_name || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">{t("detail.profile.phone")}</p>
                    <p className="text-sm text-foreground">{profile.phone || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">{t("detail.profile.address")}</p>
                    <p className="text-sm text-foreground">{profile.address || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">{t("detail.profile.taxId")}</p>
                    <p className="text-sm text-foreground">{profile.tax_id || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">{t("detail.profile.currency")}</p>
                    <p className="text-sm text-foreground">{profile.default_currency || "ILS"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">{t("detail.profile.pdfTemplate")}</p>
                    <p className="text-sm text-foreground">{profile.preferred_pdf_template || "modern"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">{t("detail.profile.logo")}</p>
                    <p className="text-sm text-foreground">{profile.logo_url ? t("detail.profile.logoUploaded") : t("detail.profile.logoNotUploaded")}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">{t("detail.profile.website")}</p>
                    <p className="text-sm text-foreground">{profile.website || "—"}</p>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {activeTab === "clients" && (
          <div className="rounded-[var(--radius-card)] bg-card border border-border/50 overflow-hidden">
            {clients.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">{t("detail.clients.empty")}</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-start px-4 py-3 font-medium text-muted-foreground">{t("detail.clients.colName")}</th>
                    <th className="text-start px-4 py-3 font-medium text-muted-foreground">{t("detail.clients.colContact")}</th>
                    <th className="text-start px-4 py-3 font-medium text-muted-foreground">{t("detail.clients.colEmail")}</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground">{t("detail.clients.colStatus")}</th>
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
                          {c.is_active ? t("detail.clients.active") : t("detail.clients.inactive")}
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
          <div className="rounded-[var(--radius-card)] bg-card border border-border/50 overflow-hidden">
            {projects.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">{t("detail.projects.empty")}</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-start px-4 py-3 font-medium text-muted-foreground">{t("detail.projects.colName")}</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground">{t("detail.projects.colStatus")}</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((p) => (
                    <tr key={p.id} className="border-b border-border/50">
                      <td className="px-4 py-3 font-medium text-foreground">{p.name}</td>
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
          <div className="rounded-[var(--radius-card)] bg-card border border-border/50 overflow-hidden">
            {entries.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">{t("detail.entries.empty")}</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-start px-4 py-3 font-medium text-muted-foreground">{t("detail.entries.colDescription")}</th>
                    <th className="text-start px-4 py-3 font-medium text-muted-foreground">{t("detail.entries.colDate")}</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground">{t("detail.entries.colDuration")}</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.id} className="border-b border-border/50">
                      <td className="px-4 py-3 font-medium text-foreground max-w-xs truncate">{e.description}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Date(e.date).toLocaleDateString(intlLocale)}
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
            <div className="rounded-[var(--radius-card)] bg-card border border-border/50 overflow-hidden">
              {sessions.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">{t("detail.sessions.empty")}</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="text-start px-4 py-3 font-medium text-muted-foreground">{t("detail.sessions.colCreated")}</th>
                      <th className="text-start px-4 py-3 font-medium text-muted-foreground">{t("detail.sessions.colExpires")}</th>
                      <th className="text-center px-4 py-3 font-medium text-muted-foreground">{t("detail.sessions.colStatus")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((s) => (
                      <tr key={s.id} className="border-b border-border/50">
                        <td className="px-4 py-3 text-muted-foreground">
                          {new Date(s.createdAt).toLocaleDateString(intlLocale, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {new Date(s.expiresAt).toLocaleDateString(intlLocale, {
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
                            {s.isExpired ? t("detail.sessions.expired") : t("detail.sessions.active")}
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
              <div role={actionResult.type === "success" ? "status" : "alert"} className={`rounded-lg p-4 text-sm ${
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
                <p className="text-sm font-medium text-foreground mb-2">{t("detail.actions.tempPasswordLabel")}</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-muted px-3 py-2 rounded text-sm font-mono" dir="ltr">
                    {tempPassword}
                  </code>
                  <button
                    onClick={() => copyToClipboard(tempPassword)}
                    className="flex h-11 w-11 touch-manipulation items-center justify-center rounded-[var(--radius)] border border-border transition-colors hover:bg-muted"
                    aria-label={t("detail.actions.copy")}
                  >
                    {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">{t("detail.actions.tempPasswordHint")}</p>
              </div>
            )}

            <div className="rounded-[var(--radius-card)] bg-card border border-border/50 p-6 space-y-4">
              {/* Reset password */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">{t("detail.actions.resetPassword.title")}</p>
                  <p className="text-xs text-muted-foreground">{t("detail.actions.resetPassword.description")}</p>
                </div>
                <button
                  onClick={() => performAction("reset_password")}
                  disabled={actionLoading !== null}
                  className="inline-flex min-h-11 touch-manipulation items-center gap-2 rounded-[var(--radius)] border border-border px-4 py-2 text-sm transition-colors hover:bg-muted disabled:opacity-50"
                >
                  <KeyRound className="h-4 w-4" />
                  {actionLoading === "reset_password" ? t("detail.actions.resetPassword.loading") : t("detail.actions.resetPassword.button")}
                </button>
              </div>

              {/* Verify email */}
              {!user.emailVerified && (
                <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">{t("detail.actions.verifyEmail.title")}</p>
                    <p className="text-xs text-muted-foreground">{t("detail.actions.verifyEmail.description")}</p>
                  </div>
                  <button
                    onClick={() => performAction("verify_email")}
                    disabled={actionLoading !== null}
                    className="inline-flex min-h-11 touch-manipulation items-center gap-2 rounded-[var(--radius)] border border-border px-4 py-2 text-sm transition-colors hover:bg-muted disabled:opacity-50"
                  >
                    <MailCheck className="h-4 w-4" />
                    {actionLoading === "verify_email" ? t("detail.actions.verifyEmail.loading") : t("detail.actions.verifyEmail.button")}
                  </button>
                </div>
              )}

              {/* Delete sessions */}
              <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">{t("detail.actions.deleteSessions.title")}</p>
                  <p className="text-xs text-muted-foreground">{t("detail.actions.deleteSessions.description")}</p>
                </div>
                <button
                  onClick={() => performAction("delete_sessions")}
                  disabled={actionLoading !== null}
                  className="inline-flex min-h-11 touch-manipulation items-center gap-2 rounded-[var(--radius)] border border-border px-4 py-2 text-sm transition-colors hover:bg-muted disabled:opacity-50"
                >
                  <LogOut className="h-4 w-4" />
                  {actionLoading === "delete_sessions" ? t("detail.actions.deleteSessions.loading") : t("detail.actions.deleteSessions.button")}
                </button>
              </div>

              {/* Toggle role */}
              <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">{t("detail.actions.toggleRole.title")}</p>
                  <p className="text-xs text-muted-foreground">
                    {user.role === "admin" ? t("detail.actions.toggleRole.demoteDescription") : t("detail.actions.toggleRole.promoteDescription")}
                  </p>
                </div>
                <button
                  onClick={() => performAction("toggle_role")}
                  disabled={actionLoading !== null}
                  className="inline-flex min-h-11 touch-manipulation items-center gap-2 rounded-[var(--radius)] border border-border px-4 py-2 text-sm transition-colors hover:bg-muted disabled:opacity-50"
                >
                  <Shield className="h-4 w-4" />
                  {actionLoading === "toggle_role" ? t("detail.actions.toggleRole.loading") : user.role === "admin" ? t("detail.actions.toggleRole.demoteButton") : t("detail.actions.toggleRole.promoteButton")}
                </button>
              </div>

              {/* Delete user */}
              <div className="flex flex-col gap-3 border-t border-destructive/30 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-destructive">{t("detail.actions.deleteUser.title")}</p>
                  <p className="text-xs text-muted-foreground">{t("detail.actions.deleteUser.description")}</p>
                </div>
                {deleteConfirm ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        performAction("delete_user");
                        setDeleteConfirm(false);
                      }}
                      disabled={actionLoading !== null}
                      className="min-h-11 rounded-[var(--radius)] bg-destructive px-4 py-2 text-sm text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-50"
                    >
                      {actionLoading === "delete_user" ? t("detail.actions.deleteUser.loading") : t("detail.actions.deleteUser.confirmButton")}
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(false)}
                      className="min-h-11 rounded-[var(--radius)] border border-border px-4 py-2 text-sm transition-colors hover:bg-muted"
                    >
                      {t("detail.actions.deleteUser.cancel")}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeleteConfirm(true)}
                    disabled={actionLoading !== null}
                    className="inline-flex min-h-11 touch-manipulation items-center gap-2 rounded-[var(--radius)] border border-destructive/30 px-4 py-2 text-sm text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    {t("detail.actions.deleteUser.button")}
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
