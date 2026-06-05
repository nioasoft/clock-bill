"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Link } from "@/src/i18n/navigation";
import { Gauge, CheckCircle2 } from "lucide-react";
import { authClient } from "@/lib/auth/client";
import { ClockFaceMarks } from "@/components/ui/thematic-elements";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("קישור לאיפוס סיסמה לא תקין או שפג תוקפו.");
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validate passwords match
    if (password !== confirmPassword) {
      setError("הסיסמאות אינן תואמות");
      return;
    }

    // Validate password length
    if (password.length < 8) {
      setError("הסיסמה חייבת להכיל לפחות 8 תווים");
      return;
    }

    setLoading(true);

    try {
      const { error: authError } = await authClient.resetPassword({
        newPassword: password,
        token: token ?? "",
      });

      if (authError) {
        setError(authError.message || "שגיאה באיפוס הסיסמה");
      } else {
        setSuccess(true);
      }
    } catch {
      setError("שגיאת תקשורת. אנא נסה שוב.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="space-y-6">
        <div className="rounded-[var(--radius)] bg-accent/5 border border-accent/20 p-6" role="status">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-accent flex-shrink-0 mt-0.5" />
            <p className="text-sm text-foreground">
              הסיסמה אופסה בהצלחה! כעת תוכל להתחבר עם הסיסמה החדשה.
            </p>
          </div>
        </div>
        <div className="text-center">
          <Link
            href="/login"
            className="font-medium text-primary hover:text-primary/80"
          >
            מעבר לדף ההתחברות
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-foreground mb-2">
            סיסמה חדשה
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="block w-full rounded-[var(--radius)] border border-border bg-background px-3 py-2.5 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors"
            placeholder="לפחות 8 תווים"
            disabled={!token}
          />
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-foreground mb-2">
            אימות סיסמה
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="block w-full rounded-[var(--radius)] border border-border bg-background px-3 py-2.5 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors"
            placeholder="הזן את הסיסמה שוב"
            disabled={!token}
          />
        </div>
      </div>

      {error && (
        <div className="rounded-[var(--radius)] bg-destructive/10 border border-destructive/20 p-4" role="alert">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !token}
        className="w-full rounded-[var(--radius)] bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
      >
        {loading ? "מאפס סיסמה..." : "אפס סיסמה"}
      </button>

      <div className="text-center">
        <p className="text-sm text-muted-foreground">
          <Link
            href="/login"
            className="font-medium text-primary hover:text-primary/80"
          >
            חזרה לדף ההתחברות
          </Link>
        </p>
      </div>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4" dir="rtl">
      <div className="w-full max-w-md">
        <div className="bg-card rounded-[var(--radius-card)] border border-border p-8 shadow-sm">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center relative">
                <ClockFaceMarks size={40} color="rgba(212,160,74,0.4)" className="absolute inset-0 m-auto" />
                <Gauge className="h-6 w-6 text-accent relative z-10" />
              </div>
              <span className="text-2xl font-display font-bold text-foreground">מוניט</span>
            </div>
            <h1 className="text-3xl font-display font-bold tracking-tight text-foreground">
              איפוס סיסמה
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              הזן את הסיסמה החדשה שלך
            </p>
          </div>

          <Suspense fallback={<div className="text-center">טוען...</div>}>
            <ResetPasswordForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
