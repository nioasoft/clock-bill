import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import {
  summarizeClientMoney,
  type ClientMoneyDocument,
  type ClientMoneyEntry,
} from "@/lib/client-money-summary";
import { buildLineFromEntry } from "@/lib/charge-documents";
import { addMoney } from "@/lib/money";
import { resolveRounding } from "@/lib/rounding";
import { createLogger } from "@/lib/logger";

const logger = createLogger("api:clients:workspace");

type Context = { params: Promise<{ id: string }> };
type WorkspaceEntry = ClientMoneyEntry & {
  projectId: string;
  projectName: string;
};

/** GET /api/clients/[id]/workspace — owner-scoped overview data for one client. */
export async function GET(_request: Request, { params }: Context) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error_code: "UNAUTHORIZED", message: "לא מחובר" },
        { status: 401 }
      );
    }

    const { id: clientId } = await params;
    const { query } = await import("@/lib/db");

    const clientResult = await query<{
      id: string;
      currency: string | null;
      billing_rounding: string | null;
    }>(
      `SELECT c.id, c.currency, c.billing_rounding
         FROM clients c
        WHERE c.id = $2 AND c.user_id = $1`,
      [user.id, clientId]
    );
    if (clientResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error_code: "CLIENT_NOT_FOUND", message: "הלקוח לא נמצא" },
        { status: 404 }
      );
    }

    const currency = clientResult.rows[0].currency || "ILS";
    const [profileResult, projectsResult, entriesResult, documentsResult] = await Promise.all([
      query<{ default_billing_rounding: string | null }>(
        "SELECT default_billing_rounding FROM user_profiles WHERE user_id = $1",
        [user.id]
      ),
      query<{
        id: string;
        name: string;
        status: string;
        billing_rounding: string | null;
        total_hours: number;
        last_entry_at: string | null;
      }>(
        `SELECT p.id, p.name, p.status, p.billing_rounding,
                COALESCE(SUM(te.duration), 0)::float8 / 60 AS total_hours,
                MAX(te.date)::text AS last_entry_at
           FROM projects p
           LEFT JOIN time_entries te ON te.project_id = p.id AND te.user_id = $1
          WHERE p.client_id = $2 AND p.user_id = $1
          GROUP BY p.id, p.name, p.status, p.billing_rounding
          ORDER BY CASE p.status WHEN 'active' THEN 0 WHEN 'paused' THEN 1 ELSE 2 END,
                   p.updated_at DESC
          LIMIT 500`,
        [user.id, clientId]
      ),
      query<WorkspaceEntry & Record<string, unknown>>(
        `SELECT c.id AS "clientId", p.id AS "projectId", p.name AS "projectName",
                te.id, te.description, te.notes, te.billing_kind AS "billingKind",
                te.duration, te.quantity, te.rate, te.rate_label AS "rateLabel",
                te.item_ref AS "itemRef", te.unit,
                p.billing_rounding AS "projectRounding",
                c.billing_rounding AS "clientRounding"
           FROM time_entries te
           JOIN projects p ON p.id = te.project_id AND p.user_id = $1
           JOIN clients c ON c.id = p.client_id AND c.user_id = $1
          WHERE te.user_id = $1 AND c.id = $2
            AND te.charge_document_id IS NULL
            AND te.is_billable = TRUE
            AND te.written_off_at IS NULL`,
        [user.id, clientId]
      ),
      query<ClientMoneyDocument & Record<string, unknown>>(
        `SELECT d.client_id AS "clientId", d.currency, d.total,
                d.discount_type AS "discountType", d.discount_value AS "discountValue",
                d.vat_rate_snapshot AS "vatRate",
                COALESCE(SUM(pay.amount), 0)::float8 AS "paidSum"
           FROM charge_documents d
           LEFT JOIN charge_document_payments pay
             ON pay.document_id = d.id AND pay.user_id = $1
          WHERE d.user_id = $1 AND d.client_id = $2 AND d.status <> 'canceled'
          GROUP BY d.id, d.client_id, d.currency, d.total,
                   d.discount_type, d.discount_value, d.vat_rate_snapshot`,
        [user.id, clientId]
      ),
    ]);

    const profileRounding = profileResult.rows[0]?.default_billing_rounding ?? null;
    const money = summarizeClientMoney({
      clientCurrencies: new Map([[clientId, currency]]),
      profileRounding,
      entries: entriesResult.rows,
      documents: documentsResult.rows,
    }).get(clientId) ?? { unbilled: 0, outstanding: 0, paid: 0, hasOtherCurrency: false };

    const unbilledByProject = new Map<string, number>();
    for (const entry of entriesResult.rows) {
      const line = buildLineFromEntry({
        ...entry,
        billingRounding: resolveRounding(
          entry.projectRounding,
          entry.clientRounding,
          profileRounding
        ),
      });
      unbilledByProject.set(
        entry.projectId,
        addMoney(unbilledByProject.get(entry.projectId) ?? 0, line.amount)
      );
    }

    return NextResponse.json(
      {
        success: true,
        workspace: {
          currency,
          money,
          totalHours: projectsResult.rows.reduce((sum, project) => sum + Number(project.total_hours), 0),
          projects: projectsResult.rows.map((project) => ({
            id: project.id,
            name: project.name,
            status: project.status,
            totalHours: Number(project.total_hours),
            unbilledTotal: unbilledByProject.get(project.id) ?? 0,
            lastEntryAt: project.last_entry_at,
          })),
        },
      },
      { headers: { "Cache-Control": "no-store, must-revalidate" } }
    );
  } catch (error) {
    logger.error("Error fetching client workspace", error);
    return NextResponse.json(
      { success: false, error_code: "SERVER_ERROR", message: "שגיאה בטעינת סביבת הלקוח" },
      { status: 500 }
    );
  }
}
