/** Source guardrails for the ad-hoc report UI refresh. */
import { readFileSync } from "node:fs";
import { join } from "node:path";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function source(file: string): string {
  return readFileSync(join(process.cwd(), "app", "[locale]", "(auth)", "reports", file), "utf8");
}

function run(): void {
  const tab = source("AdHocReportTab.tsx");
  const pdf = source("PdfReportContent.tsx");

  assert(
    tab.includes('aria-controls="ad-hoc-report-filters"') &&
      tab.includes("aria-expanded={showFilters}") &&
      tab.includes("setShowFilters(false)"),
    "Filters must disclose accessibly and collapse after a successful generation"
  );
  assert(
    tab.includes('role="status"') && tab.includes("reportLoading") && tab.includes("animate-pulse"),
    "Report generation must expose a layout-preserving loading state"
  );
  assert(
    tab.includes('role="alert"') && tab.includes("onClick={generateReport}"),
    "Report errors must be announced and offer a direct retry"
  );
  assert(
    tab.includes('className="space-y-3 sm:hidden"') &&
      tab.includes('className="hidden overflow-x-auto sm:block"'),
    "Detailed report entries must render as mobile cards and a desktop table"
  );
  assert(tab.includes("min-h-[44px]"), "Report controls must preserve 44px interaction targets");
  assert(!tab.includes("hover:transition-all"), "Report cards must transition explicit properties only");

  assert(
    tab.includes("printPdfContent(") &&
      tab.includes("docLocale === \"he\" ? \"rtl\" : \"ltr\"") &&
      tab.includes("<NextIntlClientProvider locale={docLocale}") &&
      pdf.includes('id="pdf-content" className="print-only"') &&
      pdf.includes('backgroundColor: "#f8fafc"'),
    "UI polish must preserve the locale-aware light print/PDF system"
  );

  console.log("✅ ad-hoc-report-experience: states, responsive layout, controls, and PDF contract pass");
}

try {
  run();
  process.exit(0);
} catch (error) {
  console.error("❌ ad-hoc-report-experience:", error instanceof Error ? error.message : error);
  process.exit(1);
}
