"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/src/i18n/navigation";
import { Link } from "@/src/i18n/navigation";
import { Gauge, UserPlus } from "lucide-react";
import { validateEmail, validatePassword, validatePasswordConfirm } from "@/lib/validation";
import { authClient } from "@/lib/auth/client";
import { useAuthErrorMessage } from "@/lib/auth/error-messages";
import { PasswordStrengthIndicator } from "@/components/password-strength-indicator";
import { GoogleSignInButton } from "@/components/google-sign-in-button";
import { ClockFaceMarks } from "@/components/ui/thematic-elements";
import { LocaleSwitcher } from "@/components/locale-switcher";

export default function RegisterPage() {
  const t = useTranslations("Auth");
  const resolveAuthError = useAuthErrorMessage();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendNote, setResendNote] = useState("");

  // Validation errors
  const [emailError, setEmailError] = useState<string | undefined>(undefined);
  const [passwordError, setPasswordError] = useState<string | undefined>(undefined);
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | undefined>(undefined);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Clear previous errors
    setEmailError(undefined);
    setPasswordError(undefined);
    setConfirmPasswordError(undefined);

    // Validate email
    const emailValidation = validateEmail(email);
    if (!emailValidation.isValid) {
      setEmailError(emailValidation.error);
      return;
    }

    // Validate password
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      setPasswordError(passwordValidation.error);
      return;
    }

    // Validate password confirmation
    const confirmValidation = validatePasswordConfirm(password, confirmPassword);
    if (!confirmValidation.isValid) {
      setConfirmPasswordError(confirmValidation.error);
      return;
    }

    // Require explicit consent to terms + privacy
    if (!consent) {
      setError(t("register.consentRequired"));
      return;
    }

    setLoading(true);

    try {
      const { data, error: authError } = await authClient.signUp.email({
        email,
        password,
        name: businessName || email.split("@")[0],
      });

      if (authError) {
        setError(resolveAuthError(authError, t("register.errors.signUpFailed")));
      } else if (data?.token) {
        // A session was created (email verification is disabled) — sign straight in.
        if (businessName.trim()) {
          try {
            await fetch("/api/profile", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ businessName: businessName.trim() }),
            });
          } catch {
            // Non-fatal: profile can be edited later in settings.
          }
        }
        router.push("/dashboard");
        router.refresh();
      } else {
        // Verification required, no session yet — stash the business name and
        // apply it on the first authenticated load (AppLayout).
        if (businessName.trim()) {
          localStorage.setItem("pendingBusinessName", businessName.trim());
        }
        setVerificationSent(true);
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
      setResendNote(t("register.resendSuccess"));
    } catch {
      setResendNote(t("common.resendFailed"));
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <LocaleSwitcher isCollapsed className="fixed top-4 end-4 z-50" />
      <div className="w-full max-w-md space-y-8">
        {/* Logo — centered, always visible */}
        <div className="text-center">
          <div className="inline-flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center relative">
              <ClockFaceMarks size={32} color="rgba(168,98,45,0.2)" className="absolute inset-0 m-auto" />
              <Gauge className="h-6 w-6 text-primary-foreground relative z-10" />
            </div>
            <span className="text-2xl font-display font-bold text-foreground">{t("common.appName")}</span>
          </div>
        </div>

          {verificationSent ? (
            <div className="rounded-[var(--radius-card)] border border-border bg-card p-6 text-center" role="status" aria-live="polite">
              <div className="w-12 h-1 bg-accent rounded-full mb-6 mx-auto" />
              <h1 className="text-2xl font-display font-bold tracking-tight text-foreground">
                {t("register.verify.title")}
              </h1>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                {t("register.verify.sentTo")}{" "}
                <span className="font-medium text-foreground" dir="ltr">{email}</span>.{" "}
                {t("register.verify.instructions")}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {t("register.verify.notReceived")}
              </p>
              <button
                type="button"
                onClick={handleResend}
                disabled={resending}
                className="mt-5 w-full rounded-[var(--radius)] border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50 transition-colors"
              >
                {resending ? t("common.sending") : t("register.resendVerification")}
              </button>
              {resendNote && (
                <p className="mt-2 text-sm text-muted-foreground">{resendNote}</p>
              )}
              <p className="mt-5 text-sm text-muted-foreground">
                {t("register.alreadyVerified")}{" "}
                <Link href="/login" className="font-medium text-primary hover:text-primary/80">
                  {t("register.signInHere")}
                </Link>
              </p>
            </div>
          ) : (
          <>
          <div className="text-center">
            <div className="w-12 h-1 bg-accent rounded-full mb-5 mx-auto" />
            <h1 className="text-2xl font-display font-bold tracking-tight text-foreground">
              {t("register.title")}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("register.subtitle")}
            </p>
          </div>

          <div className="rounded-[var(--radius-card)] border border-border bg-card p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <GoogleSignInButton label={t("register.googleSignUp")} disabled={!consent} />

            <div className="relative">
              <div className="absolute inset-0 flex items-center" aria-hidden="true">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-card px-3 text-muted-foreground">{t("register.orWithEmail")}</span>
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
                  placeholder={t("common.emailPlaceholder")}
                />
                {emailError && <p className="mt-1 text-sm text-destructive">{emailError}</p>}
              </div>

              <div>
                <label htmlFor="businessName" className="block text-sm font-medium text-foreground">
                  {t("register.businessNameLabel")}
                </label>
                <input
                  id="businessName"
                  name="businessName"
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="mt-1 block w-full rounded-[var(--radius)] border border-border bg-card px-3 py-2.5 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors"
                  placeholder={t("register.businessNamePlaceholder")}
                />
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
                  placeholder={t("common.minCharsPlaceholder")}
                />
                <PasswordStrengthIndicator password={password} />
                {passwordError && <p className="mt-1 text-sm text-destructive">{passwordError}</p>}
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-foreground">
                  {t("common.confirmPasswordLabel")}
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setConfirmPasswordError(undefined);
                  }}
                  className={`mt-1 block w-full rounded-[var(--radius)] border bg-card px-3 py-2.5 focus:outline-none focus:ring-2 transition-colors ${
                    confirmPasswordError
                      ? "border-destructive focus:border-destructive focus:ring-destructive/20"
                      : "border-border focus:border-primary focus:ring-primary/50"
                  }`}
                  placeholder={t("register.confirmPasswordPlaceholder")}
                />
                {confirmPasswordError && (
                  <p className="mt-1 text-sm text-destructive">{confirmPasswordError}</p>
                )}
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <input
                id="consent"
                name="consent"
                type="checkbox"
                checked={consent}
                onChange={(e) => {
                  setConsent(e.target.checked);
                  if (e.target.checked) setError("");
                }}
                className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-border bg-card accent-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />
              <label htmlFor="consent" className="cursor-pointer text-xs leading-relaxed text-muted-foreground">
                {t.rich("register.termsAgreement", {
                  terms: (chunks) => (
                    <Link href="/terms" className="text-primary hover:text-primary/80">{chunks}</Link>
                  ),
                  privacy: (chunks) => (
                    <Link href="/privacy" className="text-primary hover:text-primary/80">{chunks}</Link>
                  ),
                })}
              </label>
            </div>

            {error && (
              <div className="rounded-[var(--radius)] bg-destructive/10 p-4" role="alert">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={loading || !consent}
                className="group relative flex w-full items-center justify-center gap-2 rounded-[var(--radius)] border border-transparent bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
              >
                <UserPlus className="h-4 w-4" />
                {loading ? t("register.submitting") : t("register.submit")}
              </button>
            </div>

            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                {t("register.haveAccount")}{" "}
                <Link
                  href="/login"
                  className="font-medium text-primary hover:text-primary/80"
                >
                  {t("register.signInHere")}
                </Link>
              </p>
            </div>
          </form>
          </div>
          </>
          )}
        </div>
    </div>
  );
}
