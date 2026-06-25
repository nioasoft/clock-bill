import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { adminQuery } from "@/lib/db";
import PublicChargeDocument from "./PublicChargeDocument";
import type {
  PdfChargeDocument as PdfDoc,
  PdfDocumentLine,
  PdfBusinessProfile,
} from "@/app/[locale]/(auth)/reports/PdfChargeDocument";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type Params = { params: Promise<{ locale: string; token: string }> };

interface LoadResult {
  doc: PdfDoc;
  lines: PdfDocumentLine[];
  profile: PdfBusinessProfile;
  template: string | null;
  primaryColor: string;
  accentColor: string;
  primaryText: "light" | "dark";
  locale: "he" | "en";
  paidSum: number;
}

/** Token-scoped public read via the privileged connection (RLS bypass). */
async function loadByToken(token: string): Promise<LoadResult | null> {
  const docRes = await adminQuery(
    `SELECT d.doc_number, d.status, d.currency, d.total, d.notes, d.issued_at,
            d.vat_rate_snapshot, d.summary_mode, d.show_date_range, d.pdf_template, d.document_language,
            d.discount_type, d.discount_value,
            c.name AS client_name, c.document_language AS client_doc_language,
            d.user_id
       FROM charge_documents d
       JOIN clients c ON d.client_id = c.id
      WHERE d.public_token = $1`,
    [token]
  );
  if (docRes.rowCount === 0) return null;
  const d = docRes.rows[0] as Record<string, unknown>;
  if (d.status === "canceled") return null;

  const userId = d.user_id as string;
  const linesRes = await adminQuery(
    `SELECT id, source_type, time_entry_id, period_month, date::text AS date, label, description, notes,
            item_ref, billing_kind, quantity, unit, rate, amount, project_name
       FROM charge_document_lines WHERE document_id =
       (SELECT id FROM charge_documents WHERE public_token = $1)
      ORDER BY created_at`,
    [token]
  );
  const profRes = await adminQuery(
    `SELECT business_name, logo_url, signature_url, tax_id, address, phone, email,
            website, show_website_on_doc, bank_name, bank_branch, bank_account_number,
            bank_swift, pdf_primary_color, pdf_accent_color, pdf_primary_text
       FROM user_profiles WHERE user_id = $1`,
    [userId]
  );
  const p = (profRes.rows[0] ?? {}) as Record<string, unknown>;

  const doc: PdfDoc = {
    doc_number: d.doc_number as number,
    status: d.status as string,
    currency: d.currency as string,
    total: (d.total as number) ?? 0,
    notes: (d.notes as string | null) ?? null,
    issued_at: (d.issued_at ? new Date(d.issued_at as string).toISOString() : ""),
    client_name: d.client_name as string,
    vat_rate_snapshot: (d.vat_rate_snapshot as number | null) ?? null,
    discount_type: (d.discount_type as "percent" | "amount" | null) ?? null,
    discount_value: (d.discount_value as number | null) ?? null,
    summary_mode: (d.summary_mode as string | null) ?? null,
    show_date_range: (d.show_date_range as boolean | null) ?? true,
  };

  const profile: PdfBusinessProfile = {
    businessName: (p.business_name as string | null) ?? null,
    logoUrl: (p.logo_url as string | null) ?? null,
    signatureUrl: (p.signature_url as string | null) ?? null,
    taxId: (p.tax_id as string | null) ?? null,
    address: (p.address as string | null) ?? null,
    phone: (p.phone as string | null) ?? null,
    email: (p.email as string | null) ?? null,
    website: (p.website as string | null) ?? null,
    showWebsiteOnDoc: (p.show_website_on_doc as boolean | null) ?? null,
    bankName: (p.bank_name as string | null) ?? null,
    bankBranch: (p.bank_branch as string | null) ?? null,
    bankAccountNumber: (p.bank_account_number as string | null) ?? null,
    bankSwift: (p.bank_swift as string | null) ?? null,
  };

  const setting = (d.document_language as "he" | "en" | null) ?? (d.client_doc_language as "he" | "en" | null);
  const locale: "he" | "en" = setting ?? (doc.currency === "ILS" ? "he" : "en");

  const payRes = await adminQuery(
    `SELECT COALESCE(SUM(amount), 0) AS paid_sum
       FROM charge_document_payments
      WHERE document_id = (SELECT id FROM charge_documents WHERE public_token = $1)`,
    [token]
  );
  const paidSum = Number(payRes.rows[0]?.paid_sum ?? 0);

  return {
    doc,
    lines: linesRes.rows as unknown as PdfDocumentLine[],
    profile,
    template: (d.pdf_template as string | null) ?? null,
    primaryColor: (p.pdf_primary_color as string) || "#A8622D",
    accentColor: (p.pdf_accent_color as string) || "#347B52",
    primaryText: p.pdf_primary_text === "dark" ? "dark" : "light",
    locale,
    paidSum,
  };
}

export default async function PublicDocPage({ params }: Params) {
  const { token } = await params;
  const data = await loadByToken(token);
  if (!data) notFound();

  return <PublicChargeDocument {...data} />;
}
