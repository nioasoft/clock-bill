"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { validateEmail, validatePassword, validatePasswordConfirm } from "@/lib/validation";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Validation errors
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Clear previous errors
    setEmailError(null);
    setPasswordError(null);
    setConfirmPasswordError(null);

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

    setLoading(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, businessName }),
      });

      const data = await response.json();

      if (data.success) {
        router.push("/dashboard");
        router.refresh();
      } else {
        setError(data.message || "שגיאה בהרשמה");
      }
    } catch {
      setError("שגיאת תקשורת. אנא נסה שוב.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4" dir="rtl">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            צור חשבון חדש
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            התחל לנהל את שעות העבודה שלך
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <div className="space-y-4 rounded-md shadow-sm">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
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
                  setEmailError(null);
                }}
                className={`mt-1 block w-full rounded-md px-3 py-2 shadow-sm focus:outline-none focus:ring-orange-500 ${
                  emailError
                    ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                    : "border-gray-300 focus:border-orange-500"
                }`}
                placeholder="your@email.com"
              />
              {emailError && <p className="mt-1 text-sm text-red-600">{emailError}</p>}
            </div>

            <div>
              <label htmlFor="businessName" className="block text-sm font-medium text-gray-700">
                שם העסק (אופציונלי)
              </label>
              <input
                id="businessName"
                name="businessName"
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-orange-500"
                placeholder="שם העסק שלך"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
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
                  setPasswordError(null);
                }}
                className={`mt-1 block w-full rounded-md px-3 py-2 shadow-sm focus:outline-none focus:ring-orange-500 ${
                  passwordError
                    ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                    : "border-gray-300 focus:border-orange-500"
                }`}
                placeholder="לפחות 8 תווים"
              />
              {passwordError && <p className="mt-1 text-sm text-red-600">{passwordError}</p>}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                אימות סיסמה
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setConfirmPasswordError(null);
                }}
                className={`mt-1 block w-full rounded-md px-3 py-2 shadow-sm focus:outline-none focus:ring-orange-500 ${
                  confirmPasswordError
                    ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                    : "border-gray-300 focus:border-orange-500"
                }`}
                placeholder="הקלד את הסיסמה שוב"
              />
              {confirmPasswordError && (
                <p className="mt-1 text-sm text-red-600">{confirmPasswordError}</p>
              )}
            </div>
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative flex w-full justify-center rounded-md border border-transparent bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "נרשם..." : "הרשם"}
            </button>
          </div>

          <div className="text-center">
            <p className="text-sm text-gray-600">
              יש לך כבר חשבון?{" "}
              <Link
                href="/login"
                className="font-medium text-orange-600 hover:text-orange-500"
              >
                התחבר כאן
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
