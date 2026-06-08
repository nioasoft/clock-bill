/**
 * Profile API endpoint
 * GET: Retrieve user profile
 * PATCH: Update user profile
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { parseBody } from "@/lib/api-validation";
import { createLogger } from "@/lib/logger";
import { isThemeId } from "@/lib/themes";
import { isProfessionId } from "@/lib/professions";
import { ROUNDING_MODES } from "@/lib/rounding";

const logger = createLogger("api:profile");

/**
 * Body schema for updating the user profile. Every field is optional; only the
 * keys present in the body get applied (partial update), matching prior behavior.
 */
// All user_profiles columns are nullable, and the settings form sends `null`
// to clear an empty field (e.g. `businessName || null`). The schema therefore
// accepts `null` (clears the column) as well as `undefined` (field omitted →
// left untouched). Without `.nullable()` an empty field fails with
// "expected string, received null" and the whole save is rejected.
const updateProfileSchema = z.object({
  businessName: z.string().max(500).nullable().optional(),
  phone: z.string().max(100).nullable().optional(),
  email: z.string().max(200).nullable().optional(),
  address: z.string().max(1000).nullable().optional(),
  taxId: z.string().max(100).nullable().optional(),
  website: z.string().max(500).nullable().optional(),
  defaultCurrency: z.string().max(10).nullable().optional(),
  preferredPdfTemplate: z.string().max(100).nullable().optional(),
  invoicePrefix: z.string().max(100).nullable().optional(),
  nextInvoiceNumber: z.number().nullable().optional(),
  paymentTerms: z.string().max(2000).nullable().optional(),
  bankName: z.string().max(200).nullable().optional(),
  bankAccountNumber: z.string().max(100).nullable().optional(),
  bankBranch: z.string().max(100).nullable().optional(),
  bankSwift: z.string().max(100).nullable().optional(),
  pdfPrimaryColor: z.string().max(50).nullable().optional(),
  pdfAccentColor: z.string().max(50).nullable().optional(),
  longTimerEnabled: z.boolean().optional(),
  longTimerThreshold: z.number().optional(),
  dailyReminderEnabled: z.boolean().optional(),
  dailyReminderTime: z.string().max(50).nullable().optional(),
  workingHours: z.number().optional(),
  dateFormat: z.string().max(50).nullable().optional(),
  timeFormat: z.string().max(50).nullable().optional(),
  firstDayOfWeek: z.string().max(50).nullable().optional(),
  locale: z.enum(["he", "en"]).optional(),
  // Validated against the theme registry (isThemeId) in the handler, not here,
  // so an invalid value returns a Hebrew 400 instead of a generic Zod error.
  theme: z.string().max(50).optional(),
  // Onboarding / billing base. profession + defaultBillingRounding are
  // allow-list-checked in the handler (Hebrew 400 on bad value).
  profession: z.string().max(50).nullable().optional(),
  defaultRate: z.number().nullable().optional(),
  defaultBillingRounding: z.string().max(50).optional(),
  onboarded: z.boolean().optional(),
});

export interface Profile {
  id: string;
  userId: string;
  businessName: string | null;
  logoUrl: string | null;
  signatureUrl: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  taxId: string | null;
  website: string | null;
  defaultCurrency: string;
  preferredPdfTemplate: string;
  invoicePrefix: string | null;
  nextInvoiceNumber: number | null;
  paymentTerms: string | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  bankBranch: string | null;
  bankSwift: string | null;
  pdfPrimaryColor: string;
  pdfAccentColor: string;
  longTimerEnabled: boolean;
  longTimerThreshold: number;
  dailyReminderEnabled: boolean;
  dailyReminderTime: string;
  lastReminderDate: string | null;
  workingHours: number;
  dateFormat: string;
  timeFormat: string;
  firstDayOfWeek: string;
  locale: string;
  theme: string;
  profession: string | null;
  defaultRate: number | null;
  defaultBillingRounding: string;
  onboarded: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProfileResponse {
  success: boolean;
  message?: string;
  profile?: Profile;
}

/**
 * GET handler - retrieve user profile
 */
export async function GET(): Promise<NextResponse> {
  let userId: string | undefined;
  try {
    // Get current user from session
    const user = await getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error_code: "UNAUTHORIZED", message: "לא מחובר" },
        { status: 401 }
      );
    }

    userId = user.id;

    // Get user profile
    const result = await query<Record<string, unknown>>(
      `SELECT id, user_id as "userId", business_name as "businessName",
              logo_url as "logoUrl", signature_url as "signatureUrl", phone, email, address, tax_id as "taxId", website,
              default_currency as "defaultCurrency", preferred_pdf_template as "preferredPdfTemplate",
              invoice_prefix as "invoicePrefix", next_invoice_number as "nextInvoiceNumber",
              payment_terms as "paymentTerms", bank_name as "bankName",
              bank_account_number as "bankAccountNumber", bank_branch as "bankBranch",
              bank_swift as "bankSwift", pdf_primary_color as "pdfPrimaryColor",
              pdf_accent_color as "pdfAccentColor",
              long_timer_enabled as "longTimerEnabled", long_timer_threshold as "longTimerThreshold",
              daily_reminder_enabled as "dailyReminderEnabled", daily_reminder_time as "dailyReminderTime",
              last_reminder_date as "lastReminderDate", working_hours as "workingHours",
              date_format as "dateFormat", time_format as "timeFormat",
              first_day_of_week as "firstDayOfWeek",
              COALESCE(locale, 'he') as "locale",
              COALESCE(theme, 'dark') as "theme",
              profession as "profession",
              default_rate as "defaultRate",
              COALESCE(default_billing_rounding, 'none') as "defaultBillingRounding",
              COALESCE(onboarded, false) as "onboarded",
              created_at as "createdAt", updated_at as "updatedAt"
       FROM user_profiles
       WHERE user_id = $1`,
      [user.id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error_code: "PROFILE_NOT_FOUND", message: "פרופיל לא נמצא" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      profile: result.rows[0],
    }, {
      headers: {
        'Cache-Control': 'private, max-age=120, stale-while-revalidate=300'
      }
    });
  } catch (error) {
    logger.error("Failed to get profile", error, userId ? { userId } : undefined);
    return NextResponse.json(
      { success: false, error_code: "SERVER_ERROR", message: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH handler - update user profile
 */
export async function PATCH(request: Request): Promise<NextResponse> {
  let userId: string | undefined;
  try {
    // Get current user from session
    const user = await getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error_code: "UNAUTHORIZED", message: "לא מחובר" },
        { status: 401 }
      );
    }

    userId = user.id;

    const parsed = await parseBody(request, updateProfileSchema);
    if (!parsed.ok) return parsed.response;
    // Inferred from the Zod schema (fields may be string | null | undefined).
    const body = parsed.data;

    // Build update query dynamically based on provided fields
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (body.businessName !== undefined) {
      updates.push(`business_name = $${paramIndex++}`);
      values.push(body.businessName);
    }

    if (body.phone !== undefined) {
      updates.push(`phone = $${paramIndex++}`);
      values.push(body.phone);
    }

    if (body.email !== undefined) {
      updates.push(`email = $${paramIndex++}`);
      values.push(body.email);
    }

    if (body.address !== undefined) {
      updates.push(`address = $${paramIndex++}`);
      values.push(body.address);
    }

    if (body.taxId !== undefined) {
      updates.push(`tax_id = $${paramIndex++}`);
      values.push(body.taxId);
    }

    if (body.website !== undefined) {
      updates.push(`website = $${paramIndex++}`);
      values.push(body.website);
    }

    if (body.defaultCurrency !== undefined) {
      updates.push(`default_currency = $${paramIndex++}`);
      values.push(body.defaultCurrency);
    }

    if (body.preferredPdfTemplate !== undefined) {
      updates.push(`preferred_pdf_template = $${paramIndex++}`);
      values.push(body.preferredPdfTemplate);
    }

    if (body.invoicePrefix !== undefined) {
      updates.push(`invoice_prefix = $${paramIndex++}`);
      values.push(body.invoicePrefix);
    }

    if (body.nextInvoiceNumber !== undefined) {
      updates.push(`next_invoice_number = $${paramIndex++}`);
      values.push(body.nextInvoiceNumber);
    }

    if (body.paymentTerms !== undefined) {
      updates.push(`payment_terms = $${paramIndex++}`);
      values.push(body.paymentTerms);
    }

    if (body.bankName !== undefined) {
      updates.push(`bank_name = $${paramIndex++}`);
      values.push(body.bankName);
    }

    if (body.bankAccountNumber !== undefined) {
      updates.push(`bank_account_number = $${paramIndex++}`);
      values.push(body.bankAccountNumber);
    }

    if (body.bankBranch !== undefined) {
      updates.push(`bank_branch = $${paramIndex++}`);
      values.push(body.bankBranch);
    }

    if (body.bankSwift !== undefined) {
      updates.push(`bank_swift = $${paramIndex++}`);
      values.push(body.bankSwift);
    }

    if (body.pdfPrimaryColor !== undefined) {
      updates.push(`pdf_primary_color = $${paramIndex++}`);
      values.push(body.pdfPrimaryColor);
    }

    if (body.pdfAccentColor !== undefined) {
      updates.push(`pdf_accent_color = $${paramIndex++}`);
      values.push(body.pdfAccentColor);
    }

    if (body.longTimerEnabled !== undefined) {
      updates.push(`long_timer_enabled = $${paramIndex++}`);
      values.push(body.longTimerEnabled);
    }

    if (body.longTimerThreshold !== undefined) {
      updates.push(`long_timer_threshold = $${paramIndex++}`);
      values.push(body.longTimerThreshold);
    }

    if (body.dailyReminderEnabled !== undefined) {
      updates.push(`daily_reminder_enabled = $${paramIndex++}`);
      values.push(body.dailyReminderEnabled);
    }

    if (body.dailyReminderTime !== undefined) {
      updates.push(`daily_reminder_time = $${paramIndex++}`);
      values.push(body.dailyReminderTime);
    }

    if (body.workingHours !== undefined) {
      updates.push(`working_hours = $${paramIndex++}`);
      values.push(body.workingHours);
    }

    if (body.dateFormat !== undefined) {
      updates.push(`date_format = $${paramIndex++}`);
      values.push(body.dateFormat);
    }

    if (body.timeFormat !== undefined) {
      updates.push(`time_format = $${paramIndex++}`);
      values.push(body.timeFormat);
    }

    if (body.firstDayOfWeek !== undefined) {
      updates.push(`first_day_of_week = $${paramIndex++}`);
      values.push(body.firstDayOfWeek);
    }

    if (body.locale !== undefined) {
      updates.push(`locale = $${paramIndex++}`);
      values.push(body.locale);
    }

    if (body.theme !== undefined) {
      // Server-side allow-list check against the theme registry — never trust an
      // arbitrary string from the client (validate at every boundary).
      if (!isThemeId(body.theme)) {
        return NextResponse.json(
          { success: false, error_code: "INVALID_THEME", message: "ערכת נושא לא חוקית" },
          { status: 400 }
        );
      }
      updates.push(`theme = $${paramIndex++}`);
      values.push(body.theme);
    }

    if (body.profession !== undefined) {
      // null clears the column; a value must be a known preset id.
      if (body.profession !== null && !isProfessionId(body.profession)) {
        return NextResponse.json(
          { success: false, error_code: "INVALID_PROFESSION", message: "מקצוע לא תקין" },
          { status: 400 }
        );
      }
      updates.push(`profession = $${paramIndex++}`);
      values.push(body.profession);
    }

    if (body.defaultRate !== undefined) {
      updates.push(`default_rate = $${paramIndex++}`);
      values.push(body.defaultRate);
    }

    if (body.defaultBillingRounding !== undefined) {
      if (!(ROUNDING_MODES as readonly string[]).includes(body.defaultBillingRounding)) {
        return NextResponse.json(
          { success: false, error_code: "INVALID_ROUNDING", message: "עיגול חיוב לא תקין" },
          { status: 400 }
        );
      }
      updates.push(`default_billing_rounding = $${paramIndex++}`);
      values.push(body.defaultBillingRounding);
    }

    if (body.onboarded !== undefined) {
      updates.push(`onboarded = $${paramIndex++}`);
      values.push(body.onboarded);
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { success: false, error_code: "NO_FIELDS_TO_UPDATE", message: "No fields to update" },
        { status: 400 }
      );
    }

    // Add updated_at and user_id
    updates.push(`updated_at = $${paramIndex++}`);
    values.push(new Date().toISOString());
    values.push(user.id);

    // Execute update
    const result = await query<Record<string, unknown>>(
      `UPDATE user_profiles
       SET ${updates.join(", ")}
       WHERE user_id = $${paramIndex}
       RETURNING id, user_id as "userId", business_name as "businessName",
                 logo_url as "logoUrl", signature_url as "signatureUrl", phone, email, address, tax_id as "taxId", website,
                 default_currency as "defaultCurrency", preferred_pdf_template as "preferredPdfTemplate",
                 invoice_prefix as "invoicePrefix", next_invoice_number as "nextInvoiceNumber",
                 payment_terms as "paymentTerms", bank_name as "bankName",
                 bank_account_number as "bankAccountNumber", bank_branch as "bankBranch",
                 bank_swift as "bankSwift", pdf_primary_color as "pdfPrimaryColor",
                 pdf_accent_color as "pdfAccentColor",
                 long_timer_enabled as "longTimerEnabled", long_timer_threshold as "longTimerThreshold",
                 daily_reminder_enabled as "dailyReminderEnabled", daily_reminder_time as "dailyReminderTime",
                 last_reminder_date as "lastReminderDate", working_hours as "workingHours",
                 date_format as "dateFormat", time_format as "timeFormat",
                 first_day_of_week as "firstDayOfWeek",
                 COALESCE(locale, 'he') as "locale",
                 COALESCE(theme, 'dark') as "theme",
                 profession as "profession",
                 default_rate as "defaultRate",
                 COALESCE(default_billing_rounding, 'none') as "defaultBillingRounding",
                 COALESCE(onboarded, false) as "onboarded",
                 created_at as "createdAt", updated_at as "updatedAt"`,
      values
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error_code: "PROFILE_NOT_FOUND", message: "פרופיל לא נמצא" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Profile updated successfully",
      profile: result.rows[0],
    });
  } catch (error) {
    logger.error("Failed to update profile", error, userId ? { userId } : undefined);
    return NextResponse.json(
      { success: false, error_code: "SERVER_ERROR", message: "Internal server error" },
      { status: 500 }
    );
  }
}
