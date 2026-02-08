"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppLayout } from "@/components/app-layout";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, ChevronLeft, ChevronRight, Shield } from "lucide-react";

interface UserRow {
  id: string;
  email: string;
  role: string;
  createdAt: string;
  businessName: string | null;
  entryCount: number;
  projectCount: number;
  lastEntryDate: string | null;
}

interface Pagination {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
}

export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const fetchUsers = useCallback(async (searchQuery: string, pageNum: number) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchQuery) params.set("search", searchQuery);
      params.set("page", String(pageNum));

      const response = await fetch(`/api/admin/users?${params}`);
      const data = await response.json();

      if (response.status === 403) {
        router.push("/dashboard");
        return;
      }

      if (data.success) {
        setUsers(data.users);
        setPagination(data.pagination);
      }
    } catch (err) {
      console.error("Error fetching users:", err);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchUsers(search, page);
  }, [page, fetchUsers, search]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchUsers(search, 1);
  };

  return (
    <AppLayout>
      <PageContainer>
        <PageHeader title="ניהול משתמשים" subtitle="צפה וניהל את כל המשתמשים במערכת" />

        {/* Search */}
        <form onSubmit={handleSearch} className="mb-6">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="חיפוש לפי אימייל או שם עסק..."
              className="w-full rounded-lg border border-border bg-card pe-10 ps-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              aria-label="חיפוש משתמשים"
            />
          </div>
        </form>

        {/* Users Table */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="rounded-[14px] bg-card border border-border/50 shadow-sm overflow-hidden">
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-start px-4 py-3 font-medium text-muted-foreground">אימייל</th>
                    <th className="text-start px-4 py-3 font-medium text-muted-foreground">שם עסק</th>
                    <th className="text-start px-4 py-3 font-medium text-muted-foreground">תאריך רישום</th>
                    <th className="text-start px-4 py-3 font-medium text-muted-foreground">פעילות אחרונה</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground">רשומות</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground">פרויקטים</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground">תפקיד</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr
                      key={user.id}
                      className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => router.push(`/admin/users/${user.id}`)}
                      tabIndex={0}
                      role="link"
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') router.push(`/admin/users/${user.id}`); }}
                    >
                      <td className="px-4 py-3 font-medium text-foreground">{user.email}</td>
                      <td className="px-4 py-3 text-muted-foreground">{user.businessName || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Date(user.createdAt).toLocaleDateString("he-IL")}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {user.lastEntryDate
                          ? new Date(user.lastEntryDate).toLocaleDateString("he-IL")
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-center font-mono tabular-nums">{user.entryCount}</td>
                      <td className="px-4 py-3 text-center font-mono tabular-nums">{user.projectCount}</td>
                      <td className="px-4 py-3 text-center">
                        {user.role === "admin" ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                            <Shield className="h-3 w-3" />
                            מנהל
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">משתמש</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                        לא נמצאו משתמשים
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-border">
              {users.map((user) => (
                <Link
                  key={user.id}
                  href={`/admin/users/${user.id}`}
                  className="block p-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-foreground text-sm">{user.email}</span>
                    {user.role === "admin" && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                        <Shield className="h-3 w-3" />
                        מנהל
                      </span>
                    )}
                  </div>
                  {user.businessName && (
                    <p className="text-xs text-muted-foreground mb-1">{user.businessName}</p>
                  )}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>{user.entryCount} רשומות</span>
                    <span>{user.projectCount} פרויקטים</span>
                    <span>{new Date(user.createdAt).toLocaleDateString("he-IL")}</span>
                  </div>
                </Link>
              ))}
              {users.length === 0 && (
                <div className="p-8 text-center text-muted-foreground">לא נמצאו משתמשים</div>
              )}
            </div>
          </div>
        )}

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="mt-4 flex items-center justify-center gap-4">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="flex items-center gap-1 px-3 py-2 text-sm rounded-lg border border-border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
              הקודם
            </button>
            <span className="text-sm text-muted-foreground">
              עמוד {pagination.page} מתוך {pagination.totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={page >= pagination.totalPages}
              className="flex items-center gap-1 px-3 py-2 text-sm rounded-lg border border-border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              הבא
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>
        )}
      </PageContainer>
    </AppLayout>
  );
}
