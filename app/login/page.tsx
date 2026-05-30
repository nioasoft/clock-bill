"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Gauge, LogIn } from "lucide-react";
import { validateEmail, validateRequired } from "@/lib/validation";
import { authClient } from "@/lib/auth/client";
import { ClockFaceMarks, HourglassSVG, GrainOverlay } from "@/components/ui/thematic-elements";
import { GoogleSignInButton } from "@/components/google-sign-in-button";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Validation errors
  const [emailError, setEmailError] = useState<string | undefined>(undefined);
  const [passwordError, setPasswordError] = useState<string | undefined>(undefined);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

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
        setError(authError.message || "שגיאה בהתחברות");
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

  return (
    <div className="flex min-h-screen" dir="rtl">
      {/* Brand Panel */}
      <div className="hidden lg:flex lg:w-[60%] bg-gradient-to-br from-sidebar via-sidebar/95 to-primary/20 relative overflow-hidden">
        <GrainOverlay />
        <div className="relative z-10 flex flex-col justify-center px-16 text-white">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm relative">
              <ClockFaceMarks size={56} color="rgba(212,160,74,0.3)" className="absolute inset-0 m-auto" />
              <Gauge className="h-7 w-7 text-white relative z-10" />
            </div>
            <span className="text-3xl font-display font-bold">מוניט</span>
          </div>
          <h2 className="text-4xl font-display font-bold leading-tight mb-4">ברוך הבא חזרה!</h2>
          <p className="text-lg text-white/80 mb-12 max-w-md">התחבר כדי להמשיך לנהל את הזמן וההכנסות שלך</p>
          <div className="space-y-4">
            {["הטיימר שלך מחכה לך", "ראה את ההכנסות של החודש", "צור דוח ושלח ללקוח"].map((feature, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-accent flex-shrink-0" />
                <span className="text-white/90">{feature}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="absolute top-0 left-0 w-full h-full">
          <div className="absolute top-20 left-10 w-72 h-72 bg-white/5 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
        </div>
        <HourglassSVG size={200} className="absolute bottom-8 left-8 text-white opacity-[0.05] hidden lg:block" />
      </div>

      {/* Form Panel */}
      <div className="flex-1 flex items-center justify-center bg-background px-4 lg:px-16">
        <div className="w-full max-w-md space-y-8">
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center relative">
                <ClockFaceMarks size={32} color="rgba(168,98,45,0.2)" className="absolute inset-0 m-auto" />
                <Gauge className="h-6 w-6 text-primary-foreground relative z-10" />
              </div>
              <span className="text-2xl font-display font-bold text-foreground">מוניט</span>
            </div>
          </div>
          <div className="text-center lg:text-start">
            <div className="w-12 h-1 bg-accent rounded-full mb-6 mx-auto lg:mx-0" />
            <h1 className="text-3xl font-display font-bold tracking-tight text-foreground">התחבר לחשבון שלך</h1>
            <p className="mt-2 text-sm text-muted-foreground">נהל את שעות העבודה והפרויקטים שלך</p>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-6">
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

            <div className="relative">
              <div className="absolute inset-0 flex items-center" aria-hidden="true">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-background px-3 text-muted-foreground">או</span>
              </div>
            </div>

            <GoogleSignInButton label="התחבר עם Google" />

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
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
