"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { authClient } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { FieldMessage } from "@/components/ui/field-message";

interface GoogleSignInButtonProps {
  /** Button label (e.g. "התחבר עם Google" / "הירשם עם Google"). */
  label: string;
  /** Where to send the user after a successful Google sign-in. */
  callbackURL?: string;
  /** Hard-disable the button (genuine disabled state, not a consent gate). */
  disabled?: boolean;
  /**
   * When provided, the button checks consent on click instead of looking
   * disabled. If consent has NOT been given, `onRequireConsent` fires and the
   * sign-in is aborted — so the button stays clickable (no dead grey button)
   * and the user gets a clear "please accept the terms" message inline.
   */
  consentGiven?: boolean;
  /** Called when the user clicks but `consentGiven` is false. */
  onRequireConsent?: () => void;
  /** Fired right before redirecting to Google (e.g. for analytics). */
  onBeforeSignIn?: () => void;
}

/**
 * Google OAuth sign-in button. Kicks off Better Auth's social sign-in flow,
 * which redirects to Google and back to `callbackURL`.
 */
export function GoogleSignInButton({
  label,
  callbackURL = "/dashboard",
  disabled = false,
  consentGiven,
  onRequireConsent,
  onBeforeSignIn,
}: GoogleSignInButtonProps) {
  const t = useTranslations("Auth.common");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleClick = async () => {
    setError("");
    // Consent gate: keep the button alive but block until terms are accepted,
    // showing the same instruction the email path uses (rather than greying out
    // the fastest sign-up path and looking broken).
    if (onRequireConsent && consentGiven === false) {
      onRequireConsent();
      return;
    }
    onBeforeSignIn?.();
    setLoading(true);
    try {
      await authClient.signIn.social({ provider: "google", callbackURL });
      // On success the browser redirects to Google; nothing runs after this.
    } catch (error) {
      console.error("Google sign-in failed", error);
      setError(t("googleSignInFailed"));
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <Button
        type="button"
        onClick={handleClick}
        disabled={loading || disabled}
        aria-busy={loading}
        variant="outline"
        className="w-full gap-3"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
        {loading ? t("redirectingToGoogle") : label}
      </Button>
      {error && (
        <FieldMessage variant="error">
          {error}
        </FieldMessage>
      )}
    </div>
  );
}
