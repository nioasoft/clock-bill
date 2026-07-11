"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
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
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
                  <p className="text-sm text-foreground">
                    {t("forgot.successMessage")}
                  </p>
                </div>
              </div>
              <div className="text-center">
                <Button asChild variant="outline" className="w-full">
                  <Link href="/login">{t("common.backToLogin")}</Link>
                </Button>
              </div>
            </div>
          ) : (
            <form method="post" onSubmit={handleSubmit} className="space-y-6">
              <div>
                <Label htmlFor="email">
                  {t("common.emailLabel")}
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("common.emailPlaceholder")}
                />
              </div>

              {error && <FieldMessage variant="error" className="rounded-[var(--radius)] border border-destructive/20 bg-destructive/10 p-4">{error}</FieldMessage>}

              <Button
                type="submit"
                disabled={loading}
                aria-busy={loading}
                className="w-full"
              >
                {loading ? t("common.sending") : t("forgot.submit")}
              </Button>

              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  {t("forgot.rememberedPassword")}{" "}
                  <Link
                    href="/login"
                    className="inline-flex min-h-11 items-center font-medium text-primary hover:text-primary/80"
                  >
                    {t("common.signInHere")}
                  </Link>
                </p>
              </div>
            </form>
          )}
          <p className="mt-6 text-center text-xs text-muted-foreground">
            <PublicAccessibilityLink className="hover:text-foreground" />
          </p>
        </div>
      </div>
    </main>
  );
}
