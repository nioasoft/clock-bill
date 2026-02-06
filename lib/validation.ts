/**
 * Form validation utilities with Hebrew error messages
 */

export interface ValidationRule {
  value: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: (value: string) => string | null;
}

export interface ValidationResult {
  isValid: boolean;
  error: string | null;
}

/**
 * Email validation regex
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Israeli phone number pattern (allows various formats)
 */
const PHONE_PATTERN = /^(\+972|0)?[23489]\d{7,8}$/;

/**
 * Validate a single field
 */
export function validateField(rule: ValidationRule): ValidationResult {
  const { value, required, minLength, maxLength, pattern, custom } = rule;

  // Check required
  if (required && (!value || value.trim() === "")) {
    return {
      isValid: false,
      error: "שדה חובה",
    };
  }

  // Skip other validations if field is empty and not required
  if (!value || value.trim() === "") {
    return { isValid: true, error: null };
  }

  // Check minimum length
  if (minLength && value.length < minLength) {
    return {
      isValid: false,
      error: `חייב להכיל לפחות ${minLength} תווים`,
    };
  }

  // Check maximum length
  if (maxLength && value.length > maxLength) {
    return {
      isValid: false,
      error: `חייב להכיל לכל היותר ${maxLength} תווים`,
    };
  }

  // Check pattern
  if (pattern && !pattern.test(value)) {
    return {
      isValid: false,
      error: "פורמט לא תקין",
    };
  }

  // Custom validation
  if (custom) {
    const customError = custom(value);
    if (customError) {
      return {
        isValid: false,
        error: customError,
      };
    }
  }

  return { isValid: true, error: null };
}

/**
 * Validate email field
 */
export function validateEmail(value: string, required = true): ValidationResult {
  return validateField({
    value,
    required,
    pattern: EMAIL_PATTERN,
    custom: (v) => {
      if (!EMAIL_PATTERN.test(v)) {
        return "כתובת אימייל לא תקינה";
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
    return required
      ? { isValid: false, error: "שדה חובה" }
      : { isValid: true, error: null };
  }

  // Remove spaces and dashes for validation
  const cleanedPhone = value.replace(/[\s-]/g, "");

  if (!PHONE_PATTERN.test(cleanedPhone)) {
    return {
      isValid: false,
      error: "מספר טלפון לא תקין",
    };
  }

  return { isValid: true, error: null };
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
        return "הסיסמה חייבת להכיל לפחות 8 תווים";
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
    return {
      isValid: false,
      error: "שדה חובה",
    };
  }

  if (password !== confirmPassword) {
    return {
      isValid: false,
      error: "הסיסמאות אינן תואמות",
    };
  }

  return { isValid: true, error: null };
}

/**
 * Validate number field (rate, budget, etc.)
 */
export function validateNumber(value: string, required = false, min = 0): ValidationResult {
  if (!value || value.trim() === "") {
    return required
      ? { isValid: false, error: "שדה חובה" }
      : { isValid: true, error: null };
  }

  const num = parseFloat(value);

  if (isNaN(num)) {
    return {
      isValid: false,
      error: "חייב להיות מספר",
    };
  }

  if (num < min) {
    return {
      isValid: false,
      error: `חייב להיות גדול או שווה ל-${min}`,
    };
  }

  return { isValid: true, error: null };
}

/**
 * Validate required text field
 */
export function validateRequired(value: string, fieldName?: string): ValidationResult {
  if (!value || value.trim() === "") {
    return {
      isValid: false,
      error: fieldName ? `${fieldName} הוא שדה חובה` : "שדה חובה",
    };
  }

  return { isValid: true, error: null };
}

/**
 * Validate URL field
 */
export function validateUrl(value: string, required = false): ValidationResult {
  if (!value || value.trim() === "") {
    return required
      ? { isValid: false, error: "שדה חובה" }
      : { isValid: true, error: null };
  }

  try {
    new URL(value.startsWith("http") ? value : `https://${value}`);
    return { isValid: true, error: null };
  } catch {
    return {
      isValid: false,
      error: "כתובת אתר לא תקינה",
    };
  }
}

/**
 * Validate a form object with multiple fields
 */
export interface FormErrors {
  [key: string]: string | null;
}

export function validateForm(
  values: Record<string, string>,
  validations: Record<string, (value: string) => ValidationResult>
): { isValid: boolean; errors: FormErrors } {
  const errors: FormErrors = {};
  let isValid = true;

  for (const [field, validationFn] of Object.entries(validations)) {
    const result = validationFn(values[field] || "");
    errors[field] = result.error;

    if (!result.isValid) {
      isValid = false;
    }
  }

  return { isValid, errors };
}

/**
 * Validate date field (YYYY-MM-DD format)
 */
export function validateDate(value: string, required = false): ValidationResult {
  if (!value || value.trim() === "") {
    return required
      ? { isValid: false, error: "שדה חובה" }
      : { isValid: true, error: null };
  }

  // Check if it matches YYYY-MM-DD format
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!datePattern.test(value)) {
    return {
      isValid: false,
      error: "פורמט תאריך לא תקין (YYYY-MM-DD)",
    };
  }

  // Check if it's a valid date
  const date = new Date(value);
  if (isNaN(date.getTime())) {
    return {
      isValid: false,
      error: "תאריך לא תקין",
    };
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
    return {
      isValid: false,
      error: "תאריך לא תקין",
    };
  }

  return { isValid: true, error: null };
}

/**
 * Validate date range (start date before end date)
 */
export function validateDateRange(startDate: string, endDate: string, required = false): ValidationResult {
  // If not required and either field is empty, skip validation
  if (!required && (!startDate || !endDate)) {
    return { isValid: true, error: null };
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
      return {
        isValid: false,
        error: "תאריך התחלה חייב להיות לפני תאריך הסיום",
      };
    }
  }

  return { isValid: true, error: null };
}

/**
 * Validate that date is not in the future
 */
export function validatePastDate(value: string, required = false): ValidationResult {
  if (!value || value.trim() === "") {
    return required
      ? { isValid: false, error: "שדה חובה" }
      : { isValid: true, error: null };
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
    return {
      isValid: false,
      error: "תאריך לא יכול להיות בעתיד",
    };
  }

  return { isValid: true, error: null };
}

/**
 * Validate that date is not in the past
 */
export function validateFutureDate(value: string, required = false): ValidationResult {
  if (!value || value.trim() === "") {
    return required
      ? { isValid: false, error: "שדה חובה" }
      : { isValid: true, error: null };
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
    return {
      isValid: false,
      error: "תאריך לא יכול להיות בעבר",
    };
  }

  return { isValid: true, error: null };
}
