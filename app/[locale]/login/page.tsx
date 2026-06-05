"use client";

import { useState, useEffect } from "react";
import { useRouter } from "@/src/i18n/navigation";
import { Link } from "@/src/i18n/navigation";
import { Gauge, LogIn } from "lucide-react";
import { validateEmail, validateRequired } from "@/lib/validation";
import { authClient } from "@/lib/auth/client";
import { ClockFaceMarks } from "@/components/ui/thematic-elements";
import { GoogleSignInButton } from "@/components/google-sign-in-button";

export default function LoginPage() {
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
      setEmailError(emailValidation.error);
      return;
    }

    // Validate password (required)
    const passwordValidation = validateRequired(password, "הסיסמה");
    if (!passwordValidation.isValid) {
      setPasswordError(passwordValidation.error);
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
          setError("עליך לאמת את כתובת האימייל לפני ההתחברות. בדוק את תיבת הדואר שלך.");
        } else {
          setError(authError.message || "שגיאה בהתחברות");
        }
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } catch {
      setError("שגיאת תקשורת. אנא נסה שוב.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setResendNote("");
    try {
      await authClient.sendVerificationEmail({ email, callbackURL: "/dashboard" });
      setResendNote("שלחנו מייל אימות חדש.");
    } catch {
      setResendNote("שליחה נכשלה. נסה שוב בעוד רגע.");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12" dir="rtl">
      <div className="w-full max-w-md space-y-8">
        {/* Logo + heading — centered, always visible */}
        <div className="text-center">
          <div className="inline-flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center relative">
              <ClockFaceMarks size={32} color="rgba(168,98,45,0.2)" className="absolute inset-0 m-auto" />
              <Gauge className="h-6 w-6 text-primary-foreground relative z-10" />
            </div>
            <span className="text-2xl font-display font-bold text-foreground">מוניט</span>
          </div>
          <div className="w-12 h-1 bg-accent rounded-full mb-5 mx-auto" />
          <h1 className="text-2xl font-display font-bold tracking-tight text-foreground">התחבר לחשבון שלך</h1>
          <p className="mt-2 text-sm text-muted-foreground">נהל את שעות העבודה והפרויקטים שלך</p>
        </div>

        {/* Form card */}
        <div className="rounded-[var(--radius-card)] border border-border bg-card p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <GoogleSignInButton label="התחבר עם Google" />

            <div className="relative">
              <div className="absolute inset-0 flex items-center" aria-hidden="true">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-card px-3 text-muted-foreground">או התחבר עם אימייל</span>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-foreground">
                  כתובת אימייל
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
                  סיסמה
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
                  placeholder="הסיסמה שלך"
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
                      {resending ? "שולח..." : "שלח מייל אימות מחדש"}
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
                {loading ? "מתחבר..." : "התחבר"}
              </button>
            </div>

            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                <Link
                  href="/forgot-password"
                  className="font-medium text-primary hover:text-primary/80"
                >
                  שכחת סיסמה?
                </Link>
              </p>
              <p className="text-sm text-muted-foreground">
                אין לך חשבון עדיין?{" "}
                <Link
                  href="/register"
                  className="font-medium text-primary hover:text-primary/80"
                >
                  הירשם כאן
                </Link>
              </p>
              <p className="pt-2 text-xs text-muted-foreground">
                <Link href="/privacy" className="hover:text-foreground">מדיניות פרטיות</Link>
                <span className="mx-2">·</span>
                <Link href="/terms" className="hover:text-foreground">תנאי שימוש</Link>
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
