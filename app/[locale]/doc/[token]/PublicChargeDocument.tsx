"use client";

import { NextIntlClientProvider, useTranslations } from "next-intl";
import { useDocumentMessages } from "@/lib/document-messages";
import { Button } from "@/components/ui/button";
import {
  PdfChargeDocument,
  type PdfChargeDocument as PdfDoc,
  type PdfDocumentLine,
  type PdfBusinessProfile,
} from "@/app/[locale]/(auth)/reports/PdfChargeDocument";
import {
  templateRules,
  printPdfContent,
  type PdfTemplate,
  type OnColorText,
} from "@/app/[locale]/(auth)/reports/printStyles";
import { documentMoney, outstanding } from "@/lib/charge-documents";
import { formatCurrency as formatCurrencyLib } from "@/lib/currency";
import "@/app/[locale]/(auth)/reports/pdf-styles.css";
import "@/app/[locale]/(auth)/reports/pdf-templates.css";

// Template IDs must match PDF_TEMPLATES in printStyles.ts exactly.
const VALID_TEMPLATES = ["modern", "classic", "bold", "elegant", "nature", "ocean"] as const;
function asTemplate(v: string | null): PdfTemplate {
  return (VALID_TEMPLATES as readonly string[]).includes(v ?? "")
    ? (v as PdfTemplate)
    : "classic";
}

interface Props {
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

export default function PublicChargeDocument(props: Props) {
  const { doc, lines, profile, primaryColor, accentColor, locale, paidSum } = props;
  const messages = useDocumentMessages(locale);
  const template = asTemplate(props.template);
  const primaryText: OnColorText = props.primaryText;
  const dir = locale === "he" ? "rtl" : "ltr";
  const t = useTranslations("PublicDoc");

  // Locale-bound formatter re-created against the document locale (closure-safe pattern).
  const formatCurrency = (amount: number, currency: string) =>
    formatCurrencyLib(amount, currency, locale);

  // On-screen styling: un-hide #pdf-content, restore table display, apply the
  // SAME template color rules the print routine uses. Print itself reuses
  // printPdfContent (identical to ChargeDocumentView.handleExportPdf).
  const screenCss = `
    #pdf-content.print-only { display: block !important; }
    #pdf-content table { display: table !important; }
    #pdf-content thead { display: table-header-group !important; }
    #pdf-content tbody { display: table-row-group !important; }
    #pdf-content tr { display: table-row !important; }
    #pdf-content th, #pdf-content td { display: table-cell !important; }
    ${templateRules(template, primaryColor, accentColor, "#pdf-content", primaryText)}
  `;

  function handlePrint() {
    const filename = `statement_${doc.doc_number}_${doc.client_name}`.replace(/[/\s]+/g, "_").trim();
    printPdfContent(template, primaryColor, accentColor, filename, dir, primaryText);
  }

  return (
    <div dir={dir} style={{ minHeight: "100vh", background: "#f4f4f5", padding: "24px 12px" }}>
      <style dangerouslySetInnerHTML={{ __html: screenCss }} />
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
          <Button onClick={handlePrint} className="min-h-[44px]">
            {locale === "he" ? "הדפס / שמור כ-PDF" : "Print / Save as PDF"}
          </Button>
        </div>
        <div style={{ background: "white", borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,.08)" }}>
          {messages && (
            <NextIntlClientProvider locale={locale} messages={messages}>
              <PdfChargeDocument doc={doc} lines={lines} profile={profile} />
            </NextIntlClientProvider>
          )}
        </div>
        {paidSum > 0 && (() => {
          const money = documentMoney({
            total: doc.total,
            discountType: doc.discount_type,
            discountValue: doc.discount_value,
            vatRate: doc.vat_rate_snapshot,
          });
          const outstandingAmount = outstanding(money.gross, paidSum);
          return (
            <div style={{
              marginTop: 12,
              padding: "12px 16px",
              background: "white",
              borderRadius: 8,
              boxShadow: "0 1px 3px rgba(0,0,0,.08)",
              textAlign: "center",
              fontSize: 14,
              color: "#3f3f46",
            }}>
              {t("paymentSummary", {
                paid: formatCurrency(paidSum, doc.currency),
                total: formatCurrency(money.gross, doc.currency),
                outstanding: formatCurrency(outstandingAmount, doc.currency),
              })}
            </div>
          );
        })()}
        <p style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: "#71717a" }}>
          {locale === "he" ? "הופק ב-" : "Generated with "}
          <a href="https://www.clock-bill.com" style={{ color: "#0a0a0a", fontWeight: 600 }}>ClockBill</a>
        </p>
      </div>
    </div>
  );
}
