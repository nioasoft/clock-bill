"use client";

import { useState, useEffect, Suspense } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Link } from "@/src/i18n/navigation";
import { Gauge, CheckCircle2 } from "lucide-react";
import { authClient } from "@/lib/auth/client";
import { useAuthErrorMessage } from "@/lib/auth/error-messages";
import { ClockFaceMarks } from "@/components/ui/thematic-elements";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { PublicAccessibilityLink } from "@/components/public-accessibility-link";

function ResetPasswordForm() {
  const t = useTranslations("Auth");
  const resolveAuthError = useAuthErrorMessage();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      setError(t("reset.errors.invalidToken"));
    }
  }, [token, t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validate passwords match
    if (password !== confirmPassword) {
      setError(t("reset.errors.passwordsMismatch"));
      return;
    }

    // Validate password length
    if (password.length < 8) {
      setError(t("reset.errors.passwordTooShort"));
      return;
    }

    setLoading(true);

    try {
      const { error: authError } = await authClient.resetPassword({
        newPassword: password,
        token: token ?? "",
      });

      if (authError) {
        setError(resolveAuthError(authError, t("reset.errors.resetFailed")));
      } else {
        setSuccess(true);
      }
    } catch {
      setError(t("common.networkError"));
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
              {t("reset.successMessage")}
            </p>
          </div>
        </div>
        <div className="text-center">
          <Link
            href="/login"
            className="font-medium text-primary hover:text-primary/80"
          >
            {t("reset.goToLogin")}
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
            {t("reset.newPasswordLabel")}
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="block w-full rounded-[var(--radius)] border border-border bg-background px-3 py-2.5 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors"
            placeholder={t("common.minCharsPlaceholder")}
            disabled={!token}
          />
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-foreground mb-2">
            {t("common.confirmPasswordLabel")}
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="block w-full rounded-[var(--radius)] border border-border bg-background px-3 py-2.5 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors"
            placeholder={t("reset.confirmPasswordPlaceholder")}
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
        {loading ? t("reset.submitting") : t("reset.submit")}
      </button>

      <div className="text-center">
        <p className="text-sm text-muted-foreground">
          <Link
            href="/login"
            className="font-medium text-primary hover:text-primary/80"
          >
            {t("common.backToLogin")}
          </Link>
        </p>
      </div>
    </form>
  );
}

export default function ResetPasswordPage() {
  const t = useTranslations("Auth");
  return (
    <main id="main-content" tabIndex={-1} className="flex min-h-screen items-center justify-center bg-surface px-4">
      <LocaleSwitcher isCollapsed className="fixed top-4 end-4 z-50" />
      <div className="w-full max-w-md">
        <div className="bg-card rounded-[var(--radius-card)] border border-border p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center relative">
                <ClockFaceMarks size={40} color="rgba(212,160,74,0.4)" className="absolute inset-0 m-auto" />
                <Gauge className="h-6 w-6 text-accent relative z-10" />
              </div>
              <span className="text-2xl font-display font-bold text-foreground">{t("common.appName")}</span>
            </div>
            <h1 className="text-3xl font-display font-bold tracking-tight text-foreground">
              {t("reset.title")}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("reset.subtitle")}
            </p>
          </div>

          <Suspense fallback={<div className="text-center">{t("common.loading")}</div>}>
            <ResetPasswordForm />
          </Suspense>
          <p className="mt-6 text-center text-xs text-muted-foreground">
            <PublicAccessibilityLink className="hover:text-foreground" />
          </p>
        </div>
      </div>
    </main>
  );
}
