import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { query } from "@/lib/db";

// GET /api/backup/export - Export all user data as JSON
export async function GET(_request: NextRequest) {
  try {
    // Check authentication
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ success: false, message: "לא מחובר" }, { status: 401 });
    }

    const userId = user.id;

    // Fetch all user data in parallel
    const [
      profileResult,
      clientsResult,
      projectsResult,
      entriesResult,
      tagsResult,
      ratesResult,
      tasksResult,
    ] = await Promise.all([
      // User profile
      query(
        `SELECT id, user_id as "userId", business_name as "businessName", logo_url as "logoUrl",
         phone, email, address, tax_id as "taxId", website, default_currency as "defaultCurrency",
         preferred_pdf_template as "preferredPdfTemplate", invoice_prefix as "invoicePrefix",
         next_invoice_number as "nextInvoiceNumber", payment_terms as "paymentTerms",
         bank_name as "bankName", bank_account_number as "bankAccountNumber",
         bank_branch as "bankBranch", bank_swift as "bankSwift", signature_url as "signatureUrl",
         pdf_primary_color as "pdfPrimaryColor", pdf_accent_color as "pdfAccentColor",
         working_hours as "workingHours",
         long_timer_enabled as "longTimerEnabled", long_timer_threshold as "longTimerThreshold",
         daily_reminder_enabled as "dailyReminderEnabled", daily_reminder_time as "dailyReminderTime",
         last_reminder_date as "lastReminderDate",
         date_format as "dateFormat", time_format as "timeFormat", first_day_of_week as "firstDayOfWeek",
         created_at as "createdAt", updated_at as "updatedAt"
         FROM user_profiles WHERE user_id = $1`,
        [userId]
      ),
      // Clients
      query(
        `SELECT id, user_id as "userId", name, contact_name as "contactName",
         email, phone, address, default_rate as "defaultRate",
         currency, is_retainer as "isRetainer", retainer_hours as "retainerHours",
         retainer_monthly_fee as "retainerMonthlyFee", overage_rate as "overageRate",
         notes, is_active as "isActive", created_at as "createdAt", updated_at as "updatedAt"
         FROM clients WHERE user_id = $1 ORDER BY created_at DESC`,
        [userId]
      ),
      // Projects
      query(
        `SELECT p.id, p.client_id as "clientId", p.name,
         p.status, p.start_date as "startDate", p.end_date as "endDate",
         p.fixed_monthly_enabled as "fixedMonthlyEnabled",
         p.fixed_monthly_fee as "fixedMonthlyFee",
         p.fixed_monthly_start_date as "fixedMonthlyStartDate",
         p.fixed_monthly_end_date as "fixedMonthlyEndDate",
         p.notes, p.created_at as "createdAt", p.updated_at as "updatedAt",
         c.name as "clientName"
         FROM projects p
         JOIN clients c ON p.client_id = c.id
         WHERE p.user_id = $1 ORDER BY p.created_at DESC`,
        [userId]
      ),
      // Time entries
      query(
        `SELECT id, user_id as "userId", project_id as "projectId", task_id as "taskId",
         description, start_time as "startTime", end_time as "endTime", duration,
         date, tags, notes, is_billable as "isBillable",
         paused_at as "pausedAt", total_paused_time as "totalPausedTime",
         created_at as "createdAt", updated_at as "updatedAt"
         FROM time_entries WHERE user_id = $1 ORDER BY date DESC, created_at DESC`,
        [userId]
      ),
      // Custom tags
      query(
        `SELECT id, user_id as "userId", name, color, is_default as "isDefault",
         created_at as "createdAt", updated_at as "updatedAt"
         FROM custom_tags WHERE user_id = $1 ORDER BY name`,
        [userId]
      ),
      // Currency rates (global table, not per-user)
      query(
        `SELECT id, base_currency as "baseCurrency",
         target_currency as "targetCurrency", rate,
         updated_at as "updatedAt"
         FROM currency_rates ORDER BY base_currency, target_currency`,
        []
      ),
      // Tasks
      query(
        `SELECT id, project_id as "projectId", user_id as "userId", name, description,
         status, created_at as "createdAt", updated_at as "updatedAt"
         FROM tasks WHERE user_id = $1`,
        [userId]
      ),
    ]);

    const profile = profileResult.rows[0] || null;
    const clients = clientsResult.rows;
    const projects = projectsResult.rows;
    const entries = entriesResult.rows;
    const tags = tagsResult.rows;
    const rates = ratesResult.rows;
    const tasks = tasksResult.rows;

    // Create backup object
    const backup = {
      version: "1.0",
      exportDate: new Date().toISOString(),
      userProfile: profile,
      clients,
      projects,
      timeEntries: entries,
      customTags: tags,
      currencyRates: rates,
      tasks,
    };

    // Generate filename with date and business name
    const dateStr = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    const businessNameSlug = profile?.businessName
      ? (profile.businessName as string).replace(/[^a-zא-ת0-9]/gi, "-").toLowerCase()
      : "backup";
    const filename = `clockbill-${businessNameSlug}-${dateStr}.json`;

    // Return JSON file
    return new NextResponse(JSON.stringify(backup, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Error exporting backup:", error);
    return NextResponse.json(
      { success: false, message: "שגיאה ביצירת הגיבוי" },
      { status: 500 }
    );
  }
}
