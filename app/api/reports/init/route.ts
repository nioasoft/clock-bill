import { NextResponse } from "next/server";
import type { PoolClient } from "pg";
import { getUser } from "@/lib/auth";
import { withTransaction } from "@/lib/db";
import { createLogger } from "@/lib/logger";

const logger = createLogger("api:reports:init");

/**
 * GET /api/reports/init
 *
 * One-shot bootstrap for the reports page. Replaces five separate fetches
 * (profile, clients, projects, presets, currency-rates) — which each opened
 * their own DB transaction and re-resolved the session — with a single request
 * that runs all five queries inside ONE transaction (one tenant-context bind).
 *
 * The queries below are kept byte-for-byte in sync with their source routes:
 *   /api/profile · /api/clients · /api/projects · /api/reports/presets · /api/currency-rates
 * If you change a source query, mirror it here.
 */
export async function GET(): Promise<NextResponse> {
  let userId: string | undefined;
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ success: false, error_code: "UNAUTHORIZED", message: "לא מחובר" }, { status: 401 });
    }
    userId = user.id;

    const data = await withTransaction(async (client: PoolClient) => {
      // ── profile (mirror: /api/profile GET) ──────────────────────────────
      const profileRes = await client.query(
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
                created_at as "createdAt", updated_at as "updatedAt"
         FROM user_profiles
         WHERE user_id = $1`,
        [user.id]
      );

      // ── clients (mirror: /api/clients GET) ──────────────────────────────
      const clientsRes = await client.query(
        `SELECT c.id, c.name, c.contact_name, c.email, c.phone, c.address, c.default_rate,
                c.currency, c.is_retainer, c.retainer_hours, c.retainer_monthly_fee, c.overage_rate,
                c.notes, c.is_active, c.created_at,
                COALESCE(SUM(
                  CASE
                    WHEN te.is_billable = TRUE THEN
                      COALESCE(c.default_rate, 0) * (te.duration / 60.0)
                    ELSE 0
                  END
                ), 0) as total_billed,
                COALESCE(SUM(te.duration), 0) / 60.0 as total_hours
         FROM clients c
         LEFT JOIN projects p ON p.client_id = c.id
         LEFT JOIN time_entries te ON te.project_id = p.id
         WHERE c.user_id = $1
         GROUP BY c.id, c.name, c.contact_name, c.email, c.phone, c.address, c.default_rate,
                c.currency, c.is_retainer, c.retainer_hours, c.retainer_monthly_fee, c.overage_rate,
                c.notes, c.is_active, c.created_at
         ORDER BY c.created_at DESC`,
        [user.id]
      );

      // ── projects (mirror: /api/projects GET, default = exclude archived) ─
      const projectsRes = await client.query(
        `SELECT p.id, p.name, p.client_id, c.name as client_name,
                p.status, p.start_date, p.end_date,
                p.fixed_monthly_enabled, p.fixed_monthly_fee, p.fixed_monthly_start_date, p.fixed_monthly_end_date,
                p.notes, p.created_at
         FROM projects p
         JOIN clients c ON p.client_id = c.id
         WHERE p.user_id = $1 AND p.status != 'archived'
         ORDER BY p.created_at DESC`,
        [user.id]
      );

      // ── presets (mirror: /api/reports/presets GET) ──────────────────────
      const presetsRes = await client.query(
        `SELECT id, name, client_id, project_id, start_date, end_date, created_at, updated_at
         FROM report_presets
         WHERE user_id = $1
         ORDER BY created_at DESC`,
        [user.id]
      );

      // ── currency rates (mirror: /api/currency-rates GET) ────────────────
      const ratesRes = await client.query(
        `SELECT id, user_id, from_currency as "fromCurrency", to_currency as "toCurrency", rate, created_at as "createdAt", updated_at as "updatedAt"
         FROM currency_rates
         WHERE user_id = $1
         ORDER BY from_currency, to_currency`,
        [user.id]
      );

      return { profileRes, clientsRes, projectsRes, presetsRes, ratesRes };
    });

    const profile = data.profileRes.rows[0] ?? null;

    const clients = data.clientsRes.rows.map((c) => ({
      id: c.id,
      name: c.name,
      contactName: c.contact_name,
      email: c.email,
      phone: c.phone,
      address: c.address,
      defaultRate: c.default_rate,
      currency: c.currency || "ILS",
      isRetainer: c.is_retainer ?? false,
      retainerHours: c.retainer_hours,
      retainerMonthlyFee: c.retainer_monthly_fee,
      overageRate: c.overage_rate,
      notes: c.notes,
      isActive: c.is_active,
      createdAt: c.created_at,
      totalBilled: c.total_billed ? parseFloat(c.total_billed) : 0,
      totalHours: c.total_hours || 0,
    }));

    const projects = data.projectsRes.rows.map((p) => ({
      id: p.id,
      name: p.name,
      clientId: p.client_id,
      clientName: p.client_name,
      status: p.status,
      startDate: p.start_date,
      endDate: p.end_date,
      fixedMonthlyEnabled: p.fixed_monthly_enabled,
      fixedMonthlyFee: p.fixed_monthly_fee,
      fixedMonthlyStartDate: p.fixed_monthly_start_date,
      fixedMonthlyEndDate: p.fixed_monthly_end_date,
      notes: p.notes,
      createdAt: p.created_at,
    }));

    const presets = data.presetsRes.rows.map((row) => ({
      id: row.id,
      name: row.name,
      clientId: row.client_id,
      projectId: row.project_id,
      startDate: row.start_date,
      endDate: row.end_date,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return NextResponse.json(
      { success: true, profile, clients, projects, presets, rates: data.ratesRes.rows },
      { headers: { "Cache-Control": "private, max-age=120, stale-while-revalidate=300" } }
    );
  } catch (error) {
    logger.error("Failed to load reports init", error, userId ? { userId } : undefined);
    return NextResponse.json(
      { success: false, error_code: "REPORTS_INIT_LOAD_ERROR", message: "שגיאה בטעינת נתוני הדוחות" },
      { status: 500 }
    );
  }
}
