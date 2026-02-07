"use client";

import { calculatePasswordStrength, PasswordStrength, PasswordStrengthResult } from "@/lib/validation";
import { Check, X } from "lucide-react";

interface PasswordStrengthIndicatorProps {
  password: string;
}

export function PasswordStrengthIndicator({ password }: PasswordStrengthIndicatorProps) {
  // Don't show anything if password is empty
  if (!password) {
    return null;
  }

  const strength: PasswordStrengthResult = calculatePasswordStrength(password);

  // Strength level colors
  const getStrengthColor = (level: PasswordStrength): string => {
    switch (level) {
      case PasswordStrength.WEAK:
        return "bg-destructive";
      case PasswordStrength.FAIR:
        return "bg-primary";
      case PasswordStrength.GOOD:
        return "bg-yellow-500";
      case PasswordStrength.STRONG:
        return "bg-success";
    }
  };

  const getStrengthTextColor = (level: PasswordStrength): string => {
    switch (level) {
      case PasswordStrength.WEAK:
        return "text-destructive";
      case PasswordStrength.FAIR:
        return "text-primary";
      case PasswordStrength.GOOD:
        return "text-yellow-700";
      case PasswordStrength.STRONG:
        return "text-success";
    }
  };

  // Calculate bar width based on score
  const barWidth = `${strength.score}%`;

  return (
    <div className="mt-2 space-y-2">
      {/* Strength bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ease-out ${getStrengthColor(strength.strength)}`}
            style={{ width: barWidth }}
          />
        </div>
        <span className={`text-xs font-medium ${getStrengthTextColor(strength.strength)}`}>
          {strength.feedback}
        </span>
      </div>

      {/* Requirements checklist - shown when typing */}
      {password.length > 0 && password.length < 16 && (
        <div className="text-xs space-y-1 text-muted-foreground">
          <div className="flex items-center gap-1.5">
            {strength.checks.length ? (
              <Check className="h-3.5 w-3.5 text-success" />
            ) : (
              <X className="h-3.5 w-3.5 text-destructive" />
            )}
            <span className={strength.checks.length ? "text-success" : ""}>
              לפחות 8 תווים
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {strength.checks.lowercase ? (
              <Check className="h-3.5 w-3.5 text-success" />
            ) : (
              <X className="h-3.5 w-3.5 text-destructive" />
            )}
            <span className={strength.checks.lowercase ? "text-success" : ""}>
              אות קטנה באנגלית (a-z)
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {strength.checks.uppercase ? (
              <Check className="h-3.5 w-3.5 text-success" />
            ) : (
              <X className="h-3.5 w-3.5 text-destructive" />
            )}
            <span className={strength.checks.uppercase ? "text-success" : ""}>
              אות גדולה באנגלית (A-Z)
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {strength.checks.number ? (
              <Check className="h-3.5 w-3.5 text-success" />
            ) : (
              <X className="h-3.5 w-3.5 text-destructive" />
            )}
            <span className={strength.checks.number ? "text-success" : ""}>
              מספר (0-9)
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {strength.checks.special ? (
              <Check className="h-3.5 w-3.5 text-success" />
            ) : (
              <X className="h-3.5 w-3.5 text-destructive" />
            )}
            <span className={strength.checks.special ? "text-success" : ""}>
              תו מיוחד (!@#$%...)
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
