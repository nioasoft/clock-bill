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
