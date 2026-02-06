import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { query } from "@/lib/db";

// GET /api/backup/export - Export all user data as JSON
export async function GET(request: NextRequest) {
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
      overridesResult,
    ] = await Promise.all([
      // User profile
      query(
        `SELECT id, user_id as "userId", business_name as "businessName", logo_url as "logoUrl",
         phone, email, address, tax_id as "taxId", website, default_currency as "defaultCurrency",
         preferred_pdf_template as "preferredPdfTemplate", invoice_prefix as "invoicePrefix",
         next_invoice_number as "nextInvoiceNumber", payment_terms as "paymentTerms",
         bank_name as "bankName", bank_account_number as "bankAccountNumber",
         bank_branch as "bankBranch", bank_swift as "bankSwift",
         pdf_primary_color as "pdfPrimaryColor", pdf_accent_color as "pdfAccentColor",
         long_timer_enabled as "longTimerEnabled", long_timer_threshold as "longTimerThreshold",
         daily_reminder_enabled as "dailyReminderEnabled", daily_reminder_time as "dailyReminderTime",
         created_at as "createdAt", updated_at as "updatedAt"
         FROM user_profiles WHERE user_id = $1`,
        [userId]
      ),
      // Clients
      query(
        `SELECT id, user_id as "userId", name, contact_name as "contactName",
         email, phone, address, default_rate as "defaultRate", notes,
         is_active as "isActive", created_at as "createdAt", updated_at as "updatedAt"
         FROM clients WHERE user_id = $1 ORDER BY created_at DESC`,
        [userId]
      ),
      // Projects
      query(
        `SELECT p.id, p.user_id as "userId", p.client_id as "clientId", p.name,
         p.pricing_model as "pricingModel", p.hourly_rate as "hourlyRate",
         p.package_price as "packagePrice", p.package_hours as "packageHours",
         p.overage_rate as "overageRate", p.fixed_budget as "fixedBudget",
         p.retainer_monthly_fee as "retainerMonthlyFee", p.retainer_hours as "retainerHours",
         p.currency, p.status, p.start_date as "startDate", p.end_date as "endDate",
         p.notes, p.created_at as "createdAt", p.updated_at as "updatedAt",
         c.name as "clientName"
         FROM projects p
         JOIN clients c ON p.client_id = c.id
         WHERE p.user_id = $1 ORDER BY p.created_at DESC`,
        [userId]
      ),
      // Time entries
      query(
        `SELECT id, user_id as "userId", project_id as "projectId", description,
         start_time as "startTime", end_time as "endTime", duration,
         date, tags, notes, is_billable as "isBillable",
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
      // Currency rates
      query(
        `SELECT id, user_id as "userId", from_currency as "fromCurrency",
         to_currency as "toCurrency", rate,
         created_at as "createdAt", updated_at as "updatedAt"
         FROM currency_rates WHERE user_id = $1 ORDER BY from_currency, to_currency`,
        [userId]
      ),
      // Rate overrides (via projects)
      query(
        `SELECT ro.id, ro.project_id as "projectId", ro.tag, ro.rate,
         ro.created_at as "createdAt", ro.updated_at as "updatedAt"
         FROM rate_overrides ro
         JOIN projects p ON ro.project_id = p.id
         WHERE p.user_id = $1`,
        [userId]
      ),
    ]);

    const profile = profileResult.rows[0] || null;
    const clients = clientsResult.rows;
    const projects = projectsResult.rows;
    const entries = entriesResult.rows;
    const tags = tagsResult.rows;
    const rates = ratesResult.rows;
    const overrides = overridesResult.rows;

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
      rateOverrides: overrides,
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
