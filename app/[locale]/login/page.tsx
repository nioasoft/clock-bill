"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/src/i18n/navigation";
import { Link } from "@/src/i18n/navigation";
import { Gauge, LogIn } from "lucide-react";
import { validateEmail, validateRequired } from "@/lib/validation";
import { useValidationMessage } from "@/lib/validation-messages";
import { authClient } from "@/lib/auth/client";
import { useAuthErrorMessage } from "@/lib/auth/error-messages";
import { trackEvent } from "@/lib/analytics";
import { ClockFaceMarks } from "@/components/ui/thematic-elements";
import { GoogleSignInButton } from "@/components/google-sign-in-button";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { PublicAccessibilityLink } from "@/components/public-accessibility-link";

export default function LoginPage() {
  const t = useTranslations("Auth");
  const resolveValidation = useValidationMessage();
  const resolveAuthError = useAuthErrorMessage();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendNote, setResendNote] = useState("");

  // Validation errors
  const [emailError, setEmailError] = useState<string | undefined>(undefined);
  const [passwordError, setPasswordError] = useState<string | undefined>(undefined);

  // Funnel: visitor reached the login form.
  useEffect(() => {
    trackEvent("login_page_view");
  }, []);

  // If already signed in (valid session, not just a stale cookie), skip the form.
  const { data: session } = authClient.useSession();
  useEffect(() => {
    if (session?.user) {
      router.replace("/dashboard");
    }
  }, [session, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setNeedsVerification(false);
    setResendNote("");

    // Clear previous errors
    setEmailError(undefined);
    setPasswordError(undefined);

    // Validate email
    const emailValidation = validateEmail(email);
    if (!emailValidation.isValid) {
      setEmailError(resolveValidation(emailValidation.code));
      return;
    }

    // Validate password (required)
    const passwordValidation = validateRequired(password, "password");
    if (!passwordValidation.isValid) {
      setPasswordError(resolveValidation(passwordValidation.code));
      return;
    }

    setLoading(true);

    try {
      const { error: authError } = await authClient.signIn.email({
        email,
        password,
      });

      if (authError) {
        // Email/password account that hasn't confirmed its address yet.
        if (authError.status === 403 || authError.code === "EMAIL_NOT_VERIFIED") {
          setNeedsVerification(true);
          setError(t("login.errors.notVerified"));
        } else {
          setError(resolveAuthError(authError, t("login.errors.signInFailed")));
        }
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } catch {
      setError(t("common.networkError"));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setResendNote("");
    try {
      await authClient.sendVerificationEmail({ email, callbackURL: "/dashboard" });
      setResendNote(t("login.resendSuccess"));
    } catch {
      setResendNote(t("common.resendFailed"));
    } finally {
      setResending(false);
    }
  };

  return (
    <main id="main-content" tabIndex={-1} className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <LocaleSwitcher isCollapsed className="fixed top-4 end-4 z-50" />
      <div className="w-full max-w-md space-y-8">
        {/* Logo + heading — centered, always visible */}
        <div className="text-center">
          <div className="inline-flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center relative">
              <ClockFaceMarks size={32} color="rgba(168,98,45,0.2)" className="absolute inset-0 m-auto" />
              <Gauge className="h-6 w-6 text-primary-foreground relative z-10" />
            </div>
            <span className="text-2xl font-display font-bold text-foreground">{t("common.appName")}</span>
          </div>
          <div className="w-12 h-1 bg-accent rounded-full mb-5 mx-auto" />
          <h1 className="text-2xl font-display font-bold tracking-tight text-foreground">{t("login.title")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t("login.subtitle")}</p>
        </div>

        {/* Form card */}
        <div className="rounded-[var(--radius-card)] border border-border bg-card p-6 sm:p-8">
          <form method="post" onSubmit={handleSubmit} className="space-y-6">
            <GoogleSignInButton label={t("login.googleSignIn")} />

            <div className="relative">
              <div className="absolute inset-0 flex items-center" aria-hidden="true">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-card px-3 text-muted-foreground">{t("login.orWithEmail")}</span>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-foreground">
                  {t("common.emailLabel")}
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setEmailError(undefined);
                  }}
                  className={`mt-1 block w-full rounded-[var(--radius)] border bg-card px-3 py-2.5 focus:outline-none focus:ring-2 transition-colors ${
                    emailError
                      ? "border-destructive focus:border-destructive focus:ring-destructive/20"
                      : "border-border focus:border-primary focus:ring-primary/50"
                  }`}
                  placeholder="your@email.com"
                />
                {emailError && <p className="mt-1 text-sm text-destructive">{emailError}</p>}
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-foreground">
                  {t("common.passwordLabel")}
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setPasswordError(undefined);
                  }}
                  className={`mt-1 block w-full rounded-[var(--radius)] border bg-card px-3 py-2.5 focus:outline-none focus:ring-2 transition-colors ${
                    passwordError
                      ? "border-destructive focus:border-destructive focus:ring-destructive/20"
                      : "border-border focus:border-primary focus:ring-primary/50"
                  }`}
                  placeholder={t("login.passwordPlaceholder")}
                />
                {passwordError && <p className="mt-1 text-sm text-destructive">{passwordError}</p>}
              </div>
            </div>

            {error && (
              <div className="rounded-[var(--radius)] bg-destructive/10 p-4" role="alert">
                <p className="text-sm text-destructive">{error}</p>
                {needsVerification && (
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={handleResend}
                      disabled={resending}
                      className="text-sm font-medium text-primary hover:text-primary/80 disabled:opacity-50"
                    >
                      {resending ? t("common.sending") : t("login.resendVerification")}
                    </button>
                    {resendNote && <p className="mt-1 text-sm text-muted-foreground">{resendNote}</p>}
                  </div>
                )}
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative flex w-full items-center justify-center gap-2 rounded-[var(--radius)] border border-transparent bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
              >
                <LogIn className="h-4 w-4" />
                {loading ? t("login.submitting") : t("login.submit")}
              </button>
            </div>

            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                <Link
                  href="/forgot-password"
                  className="font-medium text-primary hover:text-primary/80"
                >
                  {t("login.forgotPassword")}
                </Link>
              </p>
              <p className="text-sm text-muted-foreground">
                {t("login.noAccount")}{" "}
                <Link
                  href="/register"
                  className="font-medium text-primary hover:text-primary/80"
                >
                  {t("login.registerHere")}
                </Link>
              </p>
              <p className="pt-2 text-xs text-muted-foreground">
                <Link href="/privacy" className="hover:text-foreground">{t("common.privacyPolicy")}</Link>
                <span className="mx-2">·</span>
                <Link href="/terms" className="hover:text-foreground">{t("common.termsOfService")}</Link>
                <span className="mx-2">·</span>
                <PublicAccessibilityLink className="hover:text-foreground" />
              </p>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
