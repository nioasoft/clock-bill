"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { AlertCircle, Mail, Check, Loader2 } from "lucide-react";

interface User {
  id: string;
  email: string;
  emailVerified: boolean;
}

interface SessionResponse {
  success: boolean;
  user?: User;
  message?: string;
}

export function EmailVerificationNotice() {
  const t = useTranslations("Auth.verifyNotice");
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    async function fetchSession() {
      try {
        const response = await fetch("/api/auth/session");
        const data: SessionResponse = await response.json();
        if (data.success && data.user) {
          setUser(data.user);
        }
      } catch (error) {
        console.error("Failed to fetch session:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchSession();
  }, []);

  const sendVerificationEmail = async () => {
    if (!user) return;

    setSending(true);
    setMessage(null);

    try {
      const response = await fetch("/api/auth/send-verification", {
        method: "POST",
      });

      const data = await response.json();

      if (data.success) {
        setMessage({
          type: "success",
          text: t("success"),
        });
      } else {
        setMessage({
          type: "error",
          text: data.message || t("error"),
        });
      }
    } catch (error) {
      console.error("Failed to send verification email:", error);
      setMessage({
        type: "error",
        text: t("error"),
      });
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return null;
  }

  if (user && !user.emailVerified) {
    return (
      <div className="mb-6 rounded-lg bg-amber-50 border border-amber-200 p-4">
        <div className="flex items-start gap-3">
          <Mail className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-medium text-amber-900">
              {t("heading")}
            </h3>
            <p className="mt-1 text-sm text-amber-700">
              {t.rich("body", {
                email: () => <strong>{user.email}</strong>,
              })}
            </p>
            {message && (
              <div
                className={`mt-3 flex items-center gap-2 text-sm ${
                  message.type === "success"
                    ? "text-success"
                    : "text-destructive"
                }`}
              >
                {message.type === "success" ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                <span>{message.text}</span>
              </div>
            )}
            <div className="mt-3">
              <button
                onClick={sendVerificationEmail}
                disabled={sending}
                className="inline-flex items-center gap-2 rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {sending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("sending")}
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4" />
                    {t("resend")}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
