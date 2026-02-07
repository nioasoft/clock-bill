import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { withTransaction } from "@/lib/db";

// POST /api/backup/import - Import data from JSON backup
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ success: false, message: "לא מחובר" }, { status: 401 });
    }

    const userId = user.id;

    // Parse request body
    const body = await request.json();
    const { backup, mode } = body; // mode: "merge" | "replace"

    if (!backup) {
      return NextResponse.json(
        { success: false, message: "הגיבוי לא סופק" },
        { status: 400 }
      );
    }

    // Validate backup structure
    if (!backup.version || !backup.exportDate) {
      return NextResponse.json(
        { success: false, message: "פורמט הגיבוי לא תקין" },
        { status: 400 }
      );
    }

    // Run entire import inside a transaction for atomicity
    const result = await withTransaction(async (client) => {
      // Track import statistics
      const stats = {
        profile: 0,
        clients: 0,
        projects: 0,
        timeEntries: 0,
        customTags: 0,
        currencyRates: 0,
        rateOverrides: 0,
        errors: [] as Array<{ entity: string; message: string }>,
      };

      // If in replace mode, delete existing data first
      if (mode === "replace") {
        // Delete in order to respect foreign key constraints
        await client.query(`DELETE FROM rate_overrides WHERE project_id IN (SELECT id FROM projects WHERE user_id = $1)`, [userId]);
        await client.query(`DELETE FROM time_entries WHERE user_id = $1`, [userId]);
        await client.query(`DELETE FROM projects WHERE user_id = $1`, [userId]);
        await client.query(`DELETE FROM clients WHERE user_id = $1`, [userId]);
        await client.query(`DELETE FROM custom_tags WHERE user_id = $1`, [userId]);
        await client.query(`DELETE FROM currency_rates WHERE user_id = $1`, [userId]);
      }

      // Helper function to generate new ID
      const generateId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      // Import User Profile
      if (backup.userProfile) {
        try {
          const p = backup.userProfile;
          const existing = await client.query(`SELECT id FROM user_profiles WHERE user_id = $1`, [userId]);

          if (existing.rows.length > 0) {
            await client.query(
              `UPDATE user_profiles SET
               business_name = $2, phone = $3, email = $4, address = $5, tax_id = $6,
               website = $7, default_currency = $8, preferred_pdf_template = $9,
               invoice_prefix = $10, next_invoice_number = $11, payment_terms = $12,
               bank_name = $13, bank_account_number = $14, bank_branch = $15, bank_swift = $16,
               pdf_primary_color = $17, pdf_accent_color = $18,
               long_timer_enabled = $19, long_timer_threshold = $20,
               daily_reminder_enabled = $21, daily_reminder_time = $22,
               updated_at = NOW()
               WHERE user_id = $1`,
              [
                userId,
                p.businessName || null,
                p.phone || null,
                p.email || null,
                p.address || null,
                p.taxId || null,
                p.website || null,
                p.defaultCurrency || "ILS",
                p.preferredPdfTemplate || "modern",
                p.invoicePrefix || null,
                p.nextInvoiceNumber || null,
                p.paymentTerms || null,
                p.bankName || null,
                p.bankAccountNumber || null,
                p.bankBranch || null,
                p.bankSwift || null,
                p.pdfPrimaryColor || "#2563EB",
                p.pdfAccentColor || "#059669",
                p.longTimerEnabled ?? true,
                p.longTimerThreshold ?? 120,
                p.dailyReminderEnabled ?? false,
                p.dailyReminderTime ?? "09:00",
              ]
            );
          } else {
            await client.query(
              `INSERT INTO user_profiles (
                id, user_id, business_name, phone, email, address, tax_id, website,
                default_currency, preferred_pdf_template, invoice_prefix, next_invoice_number,
                payment_terms, bank_name, bank_account_number, bank_branch, bank_swift,
                pdf_primary_color, pdf_accent_color,
                long_timer_enabled, long_timer_threshold,
                daily_reminder_enabled, daily_reminder_time,
                created_at, updated_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, NOW(), NOW())`,
              [
                generateId("profile"),
                userId,
                p.businessName || null,
                p.phone || null,
                p.email || null,
                p.address || null,
                p.taxId || null,
                p.website || null,
                p.defaultCurrency || "ILS",
                p.preferredPdfTemplate || "modern",
                p.invoicePrefix || null,
                p.nextInvoiceNumber || null,
                p.paymentTerms || null,
                p.bankName || null,
                p.bankAccountNumber || null,
                p.bankBranch || null,
                p.bankSwift || null,
                p.pdfPrimaryColor || "#2563EB",
                p.pdfAccentColor || "#059669",
                p.longTimerEnabled ?? true,
                p.longTimerThreshold ?? 120,
                p.dailyReminderEnabled ?? false,
                p.dailyReminderTime ?? "09:00",
              ]
            );
          }
          stats.profile = 1;
        } catch (error) {
          console.error("Error importing profile:", error);
          stats.errors.push({ entity: "profile", message: "שגיאה בייבוא הפרופיל" });
        }
      }

      // Build a map of old client IDs to new client IDs
      const clientIdMap = new Map<string, string>();

      // Import Clients
      if (backup.clients && Array.isArray(backup.clients)) {
        for (const bClient of backup.clients) {
          try {
            const existing = await client.query(
              `SELECT id FROM clients WHERE user_id = $1 AND name = $2`,
              [userId, bClient.name as string]
            );

            let newClientId: string;

            if (existing.rows.length > 0 && mode === "merge") {
              newClientId = existing.rows[0].id as string;
              clientIdMap.set(bClient.id as string, newClientId);
            } else {
              newClientId = generateId("client");
              await client.query(
                `INSERT INTO clients (
                  id, user_id, name, contact_name, email, phone, address,
                  default_rate, notes, is_active, created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
                [
                  newClientId,
                  userId,
                  bClient.name as string,
                  bClient.contactName as string || null,
                  bClient.email as string || null,
                  bClient.phone as string || null,
                  bClient.address as string || null,
                  bClient.defaultRate as number || null,
                  bClient.notes as string || null,
                  (bClient.isActive as boolean) ?? true,
                  bClient.createdAt as string || new Date().toISOString(),
                  bClient.updatedAt as string || new Date().toISOString(),
                ]
              );
              stats.clients++;
              clientIdMap.set(bClient.id, newClientId);
            }
          } catch (error) {
            console.error("Error importing client:", error);
            stats.errors.push({ entity: "client", message: `${bClient.name}: שגיאה בייבוא` });
          }
        }
      }

      // Build a map of old project IDs to new project IDs
      const projectIdMap = new Map<string, string>();

      // Import Projects
      if (backup.projects && Array.isArray(backup.projects)) {
        for (const project of backup.projects) {
          try {
            const newClientId = clientIdMap.get(project.clientId);
            if (!newClientId) {
              stats.errors.push({ entity: "project", message: `${project.name}: לקוח לא נמצא` });
              continue;
            }

            const existing = await client.query(
              `SELECT id FROM projects WHERE user_id = $1 AND client_id = $2 AND name = $3`,
              [userId, newClientId, project.name as string]
            );

            let newProjectId: string;

            if (existing.rows.length > 0 && mode === "merge") {
              newProjectId = existing.rows[0].id as string;
              projectIdMap.set(project.id as string, newProjectId);
            } else {
              newProjectId = generateId("project");
              await client.query(
                `INSERT INTO projects (
                  id, user_id, client_id, name, pricing_model, hourly_rate,
                  package_price, package_hours, overage_rate, fixed_budget,
                  retainer_monthly_fee, retainer_hours, currency, status,
                  start_date, end_date, notes, created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)`,
                [
                  newProjectId,
                  userId,
                  newClientId,
                  project.name as string,
                  project.pricingModel as string,
                  project.hourlyRate as number || null,
                  project.packagePrice as number || null,
                  project.packageHours as number || null,
                  project.overageRate as number || null,
                  project.fixedBudget as number || null,
                  project.retainerMonthlyFee as number || null,
                  project.retainerHours as number || null,
                  project.currency as string || "ILS",
                  project.status as string || "active",
                  project.startDate as string || null,
                  project.endDate as string || null,
                  project.notes as string || null,
                  project.createdAt as string || new Date().toISOString(),
                  project.updatedAt as string || new Date().toISOString(),
                ]
              );
              stats.projects++;
              projectIdMap.set(project.id as string, newProjectId);
            }
          } catch (error) {
            console.error("Error importing project:", error);
            stats.errors.push({ entity: "project", message: `${project.name}: שגיאה בייבוא` });
          }
        }
      }

      // Import Time Entries
      if (backup.timeEntries && Array.isArray(backup.timeEntries)) {
        for (const entry of backup.timeEntries) {
          try {
            const newProjectId = projectIdMap.get(entry.projectId);
            if (!newProjectId) {
              stats.errors.push({ entity: "entry", message: `${entry.description}: פרויקט לא נמצא` });
              continue;
            }

            const newEntryId = generateId("entry");
            await client.query(
              `INSERT INTO time_entries (
                id, user_id, project_id, description, start_time, end_time,
                duration, date, tags, notes, is_billable, created_at, updated_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
              [
                newEntryId,
                userId,
                newProjectId,
                entry.description,
                entry.startTime || null,
                entry.endTime || null,
                entry.duration,
                entry.date,
                JSON.stringify(entry.tags || []),
                entry.notes || null,
                entry.isBillable ?? true,
                entry.createdAt || new Date().toISOString(),
                entry.updatedAt || new Date().toISOString(),
              ]
            );
            stats.timeEntries++;
          } catch (error) {
            console.error("Error importing time entry:", error);
            stats.errors.push({ entity: "entry", message: `${entry.description}: שגיאה בייבוא` });
          }
        }
      }

      // Import Custom Tags
      if (backup.customTags && Array.isArray(backup.customTags)) {
        for (const tag of backup.customTags) {
          try {
            const existing = await client.query(
              `SELECT id FROM custom_tags WHERE user_id = $1 AND name = $2`,
              [userId, tag.name]
            );

            if (existing.rows.length > 0 && mode === "merge") {
              continue;
            }

            const newTagId = generateId("tag");
            await client.query(
              `INSERT INTO custom_tags (id, user_id, name, color, is_default, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [
                newTagId,
                userId,
                tag.name,
                tag.color || null,
                tag.isDefault ?? false,
                tag.createdAt || new Date().toISOString(),
                tag.updatedAt || new Date().toISOString(),
              ]
            );
            stats.customTags++;
          } catch (error) {
            console.error("Error importing custom tag:", error);
            stats.errors.push({ entity: "tag", message: `${tag.name}: שגיאה בייבוא` });
          }
        }
      }

      // Import Currency Rates
      if (backup.currencyRates && Array.isArray(backup.currencyRates)) {
        for (const rate of backup.currencyRates) {
          try {
            const existing = await client.query(
              `SELECT id FROM currency_rates WHERE user_id = $1 AND from_currency = $2 AND to_currency = $3`,
              [userId, rate.fromCurrency, rate.toCurrency]
            );

            if (existing.rows.length > 0 && mode === "merge") {
              continue;
            }

            const newRateId = generateId("rate");
            await client.query(
              `INSERT INTO currency_rates (id, user_id, from_currency, to_currency, rate, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [
                newRateId,
                userId,
                rate.fromCurrency,
                rate.toCurrency,
                rate.rate,
                rate.createdAt || new Date().toISOString(),
                rate.updatedAt || new Date().toISOString(),
              ]
            );
            stats.currencyRates++;
          } catch (error) {
            console.error("Error importing currency rate:", error);
            stats.errors.push({
              entity: "rate",
              message: `${rate.fromCurrency}-${rate.toCurrency}: שגיאה בייבוא`,
            });
          }
        }
      }

      // Import Rate Overrides
      if (backup.rateOverrides && Array.isArray(backup.rateOverrides)) {
        for (const override of backup.rateOverrides) {
          try {
            const newProjectId = projectIdMap.get(override.projectId);
            if (!newProjectId) {
              stats.errors.push({ entity: "override", message: `override: פרויקט לא נמצא` });
              continue;
            }

            const existing = await client.query(
              `SELECT id FROM rate_overrides WHERE project_id = $1 AND tag = $2`,
              [newProjectId, override.tag]
            );

            if (existing.rows.length > 0 && mode === "merge") {
              continue;
            }

            const newOverrideId = generateId("override");
            await client.query(
              `INSERT INTO rate_overrides (id, project_id, tag, rate, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6)`,
              [
                newOverrideId,
                newProjectId,
                override.tag,
                override.rate,
                override.createdAt || new Date().toISOString(),
                override.updatedAt || new Date().toISOString(),
              ]
            );
            stats.rateOverrides++;
          } catch (error) {
            console.error("Error importing rate override:", error);
            stats.errors.push({ entity: "override", message: `${override.tag}: שגיאה בייבוא` });
          }
        }
      }

      return stats;
    });

    return NextResponse.json({
      success: true,
      message: "הגיבוי יובא בהצלחה",
      stats: result,
      hasErrors: result.errors.length > 0,
    });
  } catch (error) {
    console.error("Error importing backup:", error);
    return NextResponse.json(
      { success: false, message: "שגיאה בייבוא הגיבוי" },
      { status: 500 }
    );
  }
}
