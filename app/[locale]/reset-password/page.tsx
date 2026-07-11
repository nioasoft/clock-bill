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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldMessage } from "@/components/ui/field-message";
import { PasswordStrengthIndicator } from "@/components/password-strength-indicator";

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
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
            <p className="text-sm text-foreground">
              {t("reset.successMessage")}
            </p>
          </div>
        </div>
        <div className="text-center">
          <Button asChild variant="outline" className="w-full">
            <Link href="/login">{t("reset.goToLogin")}</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form method="post" onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div>
          <Label htmlFor="password">
            {t("reset.newPasswordLabel")}
          </Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            aria-describedby={password ? "reset-password-strength" : undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t("common.minCharsPlaceholder")}
            disabled={!token}
          />
          <PasswordStrengthIndicator id="reset-password-strength" password={password} />
        </div>

        <div>
          <Label htmlFor="confirmPassword">
            {t("common.confirmPasswordLabel")}
          </Label>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder={t("reset.confirmPasswordPlaceholder")}
            disabled={!token}
          />
        </div>
      </div>

      {error && <FieldMessage variant="error" className="rounded-[var(--radius)] border border-destructive/20 bg-destructive/10 p-4">{error}</FieldMessage>}

      <Button
        type="submit"
        disabled={loading || !token}
        aria-busy={loading}
        className="w-full"
      >
        {loading ? t("reset.submitting") : t("reset.submit")}
      </Button>

      <div className="text-center">
        <p className="text-sm text-muted-foreground">
          <Link
            href="/login"
            className="inline-flex min-h-11 items-center font-medium text-primary hover:text-primary/80"
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
