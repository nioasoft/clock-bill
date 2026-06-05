/**
 * Form validation utilities with Hebrew error messages
 */

/**
 * Password strength levels
 */
export enum PasswordStrength {
  WEAK = 0,
  FAIR = 1,
  GOOD = 2,
  STRONG = 3,
}

/**
 * Password strength result
 */
export interface PasswordStrengthResult {
  strength: PasswordStrength;
  score: number; // 0-100
  /**
   * @deprecated Legacy hard-coded Hebrew feedback. Prefer `feedbackCode` +
   * the i18n resolver (`Validation.passwordStrength.<code>`). Kept for
   * backward compatibility with the un-migrated strength indicator.
   */
  feedback: string;
  /** Stable code for the feedback message: WEAK | FAIR | GOOD | STRONG. */
  feedbackCode: "WEAK" | "FAIR" | "GOOD" | "STRONG";
  checks: {
    length: boolean;
    lowercase: boolean;
    uppercase: boolean;
    number: boolean;
    special: boolean;
  };
}

/**
 * Calculate password strength
 * Returns a score from 0-100 and detailed feedback
 */
export function calculatePasswordStrength(password: string): PasswordStrengthResult {
  const checks = {
    length: password.length >= 8,
    lowercase: /[a-z]/.test(password),
    uppercase: /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^a-zA-Z0-9]/.test(password),
  };

  // Calculate base score (0-100)
  let score = 0;

  // Length bonus (up to 40 points)
  if (password.length >= 8) score += 20;
  if (password.length >= 12) score += 10;
  if (password.length >= 16) score += 10;

  // Character variety (up to 60 points)
  if (checks.lowercase) score += 12;
  if (checks.uppercase) score += 12;
  if (checks.number) score += 12;
  if (checks.special) score += 24;

  // Cap at 100
  score = Math.min(score, 100);

  // Determine strength level and feedback
  let strength: PasswordStrength;
  let feedback: string;
  let feedbackCode: PasswordStrengthResult["feedbackCode"];

  if (score < 40) {
    strength = PasswordStrength.WEAK;
    feedbackCode = "WEAK";
    feedback = "סיסמה חלשה - כדאי לחזק אותה";
  } else if (score < 60) {
    strength = PasswordStrength.FAIR;
    feedbackCode = "FAIR";
    feedback = "סיסמה בינונית - עדיין יכולה להיות חזקה יותר";
  } else if (score < 80) {
    strength = PasswordStrength.GOOD;
    feedbackCode = "GOOD";
    feedback = "סיסמה טובה - כמעט שם";
  } else {
    strength = PasswordStrength.STRONG;
    feedbackCode = "STRONG";
    feedback = "סיסמה חזקה מצוינת!";
  }

  return {
    strength,
    score,
    feedback,
    feedbackCode,
    checks,
  };
}

/**
 * Stable, locale-independent description of a validation failure.
 *
 * `code` maps 1:1 to a key under the `Validation` i18n namespace
 * (e.g. `Validation.REQUIRED`). `params` carries ICU interpolation values
 * (e.g. `{ min }`, `{ max }`, `{ field }`). Resolve to a localized string with
 * `resolveValidationError` / `useValidationMessage` from `lib/validation-messages.ts`.
 *
 * Field names are themselves passed as codes under `Validation.fields.*` and are
 * resolved by the same helper, so callers never embed raw Hebrew/English strings.
 */
export type ValidationParams = Record<string, string | number>;

export interface ValidationError {
  code: string;
  params?: ValidationParams;
}

export interface ValidationRule {
  value: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  /**
   * Optional field code resolved under `Validation.fields.*` for messages that
   * embed the field name (currently the `REQUIRED_NAMED` code).
   */
  fieldCode?: string;
  custom?: (value: string) => ValidationError | null;
}

export interface ValidationResult {
  isValid: boolean;
  /**
   * Stable error descriptor (code + params), or `undefined` when valid.
   * Resolve via `lib/validation-messages.ts`. The legacy Hebrew `error` string
   * is kept alongside for callers not yet migrated to the i18n path.
   */
  code: ValidationError | undefined;
  /**
   * @deprecated Legacy hard-coded Hebrew message. Prefer `code` + the i18n
   * resolver. Kept for backward compatibility with un-migrated call sites.
   */
  error: string | undefined;
}

/** Helper: build a valid result. */
function ok(): ValidationResult {
  return { isValid: true, code: undefined, error: undefined };
}

/** Helper: build a failed result from a code + legacy Hebrew fallback string. */
function fail(code: string, error: string, params?: ValidationParams): ValidationResult {
  return { isValid: false, code: { code, params }, error };
}

/**
 * Email validation regex
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Israeli phone number pattern (allows various formats).
 * Second digit covers landline area codes (2,3,4,8,9), mobile (05X) and VoIP (07X).
 */
const PHONE_PATTERN = /^(\+972|0)?[2-9]\d{7,8}$/;

/**
 * Validate a single field
 */
export function validateField(rule: ValidationRule): ValidationResult {
  const { value, required, minLength, maxLength, pattern, fieldCode, custom } = rule;

  // Check required
  if (required && (!value || value.trim() === "")) {
    return fieldCode
      ? fail("REQUIRED_NAMED", "שדה חובה", { field: fieldCode })
      : fail("REQUIRED", "שדה חובה");
  }

  // Skip other validations if field is empty and not required
  if (!value || value.trim() === "") {
    return ok();
  }

  // Check minimum length
  if (minLength && value.length < minLength) {
    return fail("MIN_LENGTH", `חייב להכיל לפחות ${minLength} תווים`, { min: minLength });
  }

  // Check maximum length
  if (maxLength && value.length > maxLength) {
    return fail("MAX_LENGTH", `חייב להכיל לכל היותר ${maxLength} תווים`, { max: maxLength });
  }

  // Check pattern
  if (pattern && !pattern.test(value)) {
    return fail("INVALID_FORMAT", "פורמט לא תקין");
  }

  // Custom validation
  if (custom) {
    const customError = custom(value);
    if (customError) {
      // Re-derive a legacy Hebrew fallback for the custom code so the
      // deprecated `error` field stays populated for un-migrated callers.
      return { isValid: false, code: customError, error: legacyHebrew(customError) };
    }
  }

  return ok();
}

/**
 * Legacy Hebrew fallback for a handful of custom codes, so the deprecated
 * `error` string stays meaningful for call sites not yet on the i18n path.
 */
function legacyHebrew(err: ValidationError): string {
  switch (err.code) {
    case "INVALID_EMAIL":
      return "כתובת אימייל לא תקינה";
    case "PASSWORD_TOO_SHORT":
      return "הסיסמה חייבת להכיל לפחות 8 תווים";
    default:
      return "פורמט לא תקין";
  }
}

/**
 * Validate email field
 */
export function validateEmail(value: string, required = true): ValidationResult {
  // Note: no `pattern` here — the custom validator already checks EMAIL_PATTERN
  // and returns an email-specific message instead of the generic format error.
  return validateField({
    value,
    required,
    custom: (v) => {
      if (!EMAIL_PATTERN.test(v)) {
        return { code: "INVALID_EMAIL" };
      }
      return null;
    },
  });
}

/**
 * Validate phone number field
 */
export function validatePhone(value: string, required = false): ValidationResult {
  if (!value || value.trim() === "") {
    return required ? fail("REQUIRED", "שדה חובה") : ok();
  }

  // Remove spaces and dashes for validation
  const cleanedPhone = value.replace(/[\s-]/g, "");

  if (!PHONE_PATTERN.test(cleanedPhone)) {
    return fail("INVALID_PHONE", "מספר טלפון לא תקין");
  }

  return ok();
}

/**
 * Validate password
 */
export function validatePassword(value: string): ValidationResult {
  const result = validateField({
    value,
    required: true,
    minLength: 8,
    custom: (v) => {
      if (v.length < 8) {
        return { code: "PASSWORD_TOO_SHORT" };
      }
      return null;
    },
  });
  return result;
}

/**
 * Validate password confirmation
 */
export function validatePasswordConfirm(password: string, confirmPassword: string): ValidationResult {
  if (!confirmPassword || confirmPassword.trim() === "") {
    return fail("REQUIRED", "שדה חובה");
  }

  if (password !== confirmPassword) {
    return fail("PASSWORD_MISMATCH", "הסיסמאות אינן תואמות");
  }

  return ok();
}

/**
 * Validate number field (rate, budget, etc.)
 */
export function validateNumber(value: string, required = false, min = 0): ValidationResult {
  if (!value || value.trim() === "") {
    return required ? fail("REQUIRED", "שדה חובה") : ok();
  }

  const num = parseFloat(value);

  if (isNaN(num)) {
    return fail("NOT_A_NUMBER", "חייב להיות מספר");
  }

  if (num < min) {
    return fail("MIN_VALUE", `חייב להיות גדול או שווה ל-${min}`, { min });
  }

  return ok();
}

/**
 * Validate required text field
 */
/**
 * Validate required text field.
 *
 * @param value      The field value.
 * @param fieldCode  Optional field code resolved under `Validation.fields.*`
 *                   (e.g. "project", "description"). When provided, the
 *                   `REQUIRED_NAMED` code is used so the message embeds the
 *                   localized field name. The deprecated `error` string keeps a
 *                   raw fallback (the code itself, not a localized name).
 */
export function validateRequired(value: string, fieldCode?: string): ValidationResult {
  if (!value || value.trim() === "") {
    return fieldCode
      ? fail("REQUIRED_NAMED", `${fieldCode} הוא שדה חובה`, { field: fieldCode })
      : fail("REQUIRED", "שדה חובה");
  }

  return ok();
}

/**
 * Validate URL field
 */
export function validateUrl(value: string, required = false): ValidationResult {
  if (!value || value.trim() === "") {
    return required ? fail("REQUIRED", "שדה חובה") : ok();
  }

  try {
    new URL(value.startsWith("http") ? value : `https://${value}`);
    return ok();
  } catch {
    return fail("INVALID_URL", "כתובת אתר לא תקינה");
  }
}

/**
 * Validate a form object with multiple fields
 */
export interface FormErrors {
  [key: string]: string | undefined;
}

export interface FormErrorCodes {
  [key: string]: ValidationError | undefined;
}

export function validateForm(
  values: Record<string, string>,
  validations: Record<string, (value: string) => ValidationResult>
): { isValid: boolean; errors: FormErrors; codes: FormErrorCodes } {
  const errors: FormErrors = {};
  const codes: FormErrorCodes = {};
  let isValid = true;

  for (const [field, validationFn] of Object.entries(validations)) {
    const result = validationFn(values[field] || "");
    errors[field] = result.error;
    codes[field] = result.code;

    if (!result.isValid) {
      isValid = false;
    }
  }

  return { isValid, errors, codes };
}

/**
 * Validate date field (YYYY-MM-DD format)
 */
export function validateDate(value: string, required = false): ValidationResult {
  if (!value || value.trim() === "") {
    return required ? fail("REQUIRED", "שדה חובה") : ok();
  }

  // Check if it matches YYYY-MM-DD format
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!datePattern.test(value)) {
    return fail("INVALID_DATE_FORMAT", "פורמט תאריך לא תקין (YYYY-MM-DD)");
  }

  // Check if it's a valid date
  const date = new Date(value);
  if (isNaN(date.getTime())) {
    return fail("INVALID_DATE", "תאריך לא תקין");
  }

  // Additional validation: check if the date components match
  // This catches dates like 2024-02-30 (Feb 30 doesn't exist)
  const [year, month, day] = value.split("-").map(Number);
  const constructedDate = new Date(year, month - 1, day);

  if (
    constructedDate.getFullYear() !== year ||
    constructedDate.getMonth() !== month - 1 ||
    constructedDate.getDate() !== day
  ) {
    return fail("INVALID_DATE", "תאריך לא תקין");
  }

  return ok();
}

/**
 * Validate date range (start date before end date)
 */
export function validateDateRange(startDate: string, endDate: string, required = false): ValidationResult {
  // If not required and either field is empty, skip validation
  if (!required && (!startDate || !endDate)) {
    return ok();
  }

  // Validate individual dates first
  const startValidation = validateDate(startDate, required);
  if (!startValidation.isValid) {
    return startValidation;
  }

  const endValidation = validateDate(endDate, required);
  if (!endValidation.isValid) {
    return endValidation;
  }

  // Check if start date is after end date
  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start > end) {
      return fail("DATE_RANGE_ORDER", "תאריך התחלה חייב להיות לפני תאריך הסיום");
    }
  }

  return ok();
}

/**
 * Validate that date is not in the future
 */
export function validatePastDate(value: string, required = false): ValidationResult {
  if (!value || value.trim() === "") {
    return required ? fail("REQUIRED", "שדה חובה") : ok();
  }

  // First validate it's a proper date
  const dateValidation = validateDate(value, required);
  if (!dateValidation.isValid) {
    return dateValidation;
  }

  // Check if date is in the future
  const inputDate = new Date(value);
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Reset time part for accurate comparison

  if (inputDate > today) {
    return fail("DATE_NOT_FUTURE", "תאריך לא יכול להיות בעתיד");
  }

  return ok();
}

/**
 * Validate that date is not in the past
 */
export function validateFutureDate(value: string, required = false): ValidationResult {
  if (!value || value.trim() === "") {
    return required ? fail("REQUIRED", "שדה חובה") : ok();
  }

  // First validate it's a proper date
  const dateValidation = validateDate(value, required);
  if (!dateValidation.isValid) {
    return dateValidation;
  }

  // Check if date is in the past
  const inputDate = new Date(value);
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Reset time part for accurate comparison

  if (inputDate < today) {
    return fail("DATE_NOT_PAST", "תאריך לא יכול להיות בעבר");
  }

  return ok();
}
