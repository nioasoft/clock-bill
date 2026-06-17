"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/src/i18n/navigation";
import { Gauge, CheckCircle2 } from "lucide-react";
import { authClient } from "@/lib/auth/client";
import { useAuthErrorMessage } from "@/lib/auth/error-messages";
import { ClockFaceMarks } from "@/components/ui/thematic-elements";
import { LocaleSwitcher } from "@/components/locale-switcher";

export default function ForgotPasswordPage() {
  const t = useTranslations("Auth");
  const resolveAuthError = useAuthErrorMessage();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setLoading(true);

    try {
      const { error: authError } = await authClient.requestPasswordReset({
        email,
        redirectTo: "/reset-password",
      });

      if (authError) {
        setError(resolveAuthError(authError, t("forgot.errors.requestFailed")));
      } else {
        setSuccess(true);
      }
    } catch {
      setError(t("common.networkError"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
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
              {t("forgot.title")}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("forgot.subtitle")}
            </p>
          </div>

          {success ? (
            <div className="space-y-6">
              <div className="rounded-[var(--radius)] bg-accent/5 border border-accent/20 p-6" role="status">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-accent flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-foreground">
                    {t("forgot.successMessage")}
                  </p>
                </div>
              </div>
              <div className="text-center">
                <Link
                  href="/login"
                  className="font-medium text-primary hover:text-primary/80"
                >
                  {t("common.backToLogin")}
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-foreground mb-2">
                  {t("common.emailLabel")}
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full rounded-[var(--radius)] border border-border bg-background px-3 py-2.5 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors"
                  placeholder={t("common.emailPlaceholder")}
                />
              </div>

              {error && (
                <div className="rounded-[var(--radius)] bg-destructive/10 border border-destructive/20 p-4" role="alert">
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-[var(--radius)] bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
              >
                {loading ? t("common.sending") : t("forgot.submit")}
              </button>

              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  {t("forgot.rememberedPassword")}{" "}
                  <Link
                    href="/login"
                    className="font-medium text-primary hover:text-primary/80"
                  >
                    {t("common.signInHere")}
                  </Link>
                </p>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
