"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function ResetPasswordForm() {
  const router = useRouter();
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
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(true);
      } else {
        setError(data.message || "שגיאה באיפוס הסיסמה");
      }
    } catch {
      setError("שגיאת תקשורת. אנא נסה שוב.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="mt-8 space-y-6">
        <div className="rounded-md bg-green-50 p-4">
          <p className="text-sm text-green-700 text-center">
            הסיסמה אופסה בהצלחה! כעת תוכל להתחבר עם הסיסמה החדשה.
          </p>
        </div>
        <div className="text-center">
          <Link
            href="/login"
            className="font-medium text-orange-600 hover:text-orange-500"
          >
            מעבר לדף ההתחברות
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-6">
      <div className="space-y-4 rounded-md shadow-sm">
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">
            סיסמה חדשה
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-orange-500"
            placeholder="לפחות 8 תווים"
            disabled={!token}
          />
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
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-orange-500"
            placeholder="הזן את הסיסמה שוב"
            disabled={!token}
          />
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
          disabled={loading || !token}
          className="group relative flex w-full justify-center rounded-md border border-transparent bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "מאפס סיסמה..." : "אפס סיסמה"}
        </button>
      </div>

      <div className="text-center">
        <p className="text-sm text-gray-600">
          <Link
            href="/login"
            className="font-medium text-orange-600 hover:text-orange-500"
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
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4" dir="rtl">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            איפוס סיסמה
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            הזן את הסיסמה החדשה שלך
          </p>
        </div>

        <Suspense fallback={<div className="text-center">טוען...</div>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
