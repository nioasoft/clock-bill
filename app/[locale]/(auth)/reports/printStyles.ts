/**
 * Shared PDF template styling + print helper for the reports screen.
 *
 * The 6 templates are defined ONCE as scopeable CSS rules (`templateRules`) so
 * the same look drives BOTH:
 *   - the printed charge document (scoped to `#pdf-content`, inside @media print)
 *   - the live settings preview (scoped to the preview root, on screen)
 * → the preview is genuinely WYSIWYG; it can never drift from the real output.
 *
 * Design rules:
 *  - The user's brand colors ALWAYS win (every template routes through
 *    `${primary}` / `${accent}`, never a hardcoded brand color).
 *  - Templates are visually DISTINCT by structure, not just fonts:
 *    modern (filled banner) · classic (serif, outlined) · bold (filled banner +
 *    filled table head + solid total bar) · elegant (hairline, airy, light) ·
 *    nature (accent-led, striped, pill total) · ocean (side-band header, striped).
 *  - The charge document uses `.pdf-banner`; the ad-hoc report keeps `.pdf-header`.
 */

export type PdfTemplate =
  | "modern"
  | "classic"
  | "bold"
  | "elegant"
  | "nature"
  | "ocean";

/** Print document direction. Hebrew documents print RTL, English LTR. */
export type PrintDirection = "rtl" | "ltr";

export const PDF_TEMPLATES: readonly PdfTemplate[] = [
  "modern",
  "classic",
  "bold",
  "elegant",
  "nature",
  "ocean",
];

/**
 * The CSS rules for one template, every selector prefixed with `scope` so the
 * same rules can target the print container OR an on-screen preview root.
 * @param scope - selector prefix, e.g. "#pdf-content" or "#tpl-preview-xyz"
 */
/** Text color sitting ON a filled brand color. */
export type OnColorText = "light" | "dark";

export function templateRules(
  template: PdfTemplate,
  primary: string,
  accent: string,
  scope: string,
  primaryText: OnColorText = "light",
  accentText: OnColorText = "light"
): string {
  const S = scope;
  // Resolve the on-color text + a softer "sub" tone for secondary lines, so a
  // light brand color can use dark text (and vice-versa) and stay legible.
  const pText = primaryText === "dark" ? "#111827" : "#ffffff";
  const pSub = primaryText === "dark" ? "rgba(0,0,0,0.6)" : "rgba(255,255,255,0.85)";
  const aText = accentText === "dark" ? "#111827" : "#ffffff";
  const aSub = accentText === "dark" ? "rgba(0,0,0,0.6)" : "rgba(255,255,255,0.85)";

  // ── Shared skeleton (neutral) — templates override the expressive bits ──
  const base = `
    ${S} { font-family: -apple-system, 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #1a1a1a; line-height: 1.5; }
    ${S} .pdf-banner { display: flex; justify-content: space-between; align-items: flex-start; gap: 1.5rem; padding: 22px 26px; }
    ${S} .pdf-business-name { font-size: 21px; font-weight: 700; margin: 0 0 3px; }
    ${S} .pdf-doc-title { font-size: 16px; font-weight: 700; margin-bottom: 5px; }
    ${S} .pdf-banner-sub { font-size: 11.5px; line-height: 1.65; }
    ${S} .pdf-banner-logo { max-height: 50px; background: #fff; border-radius: 6px; padding: 4px; margin-bottom: 10px; }
    ${S} .pdf-banner-meta { text-align: start; white-space: nowrap; }
    ${S} .pdf-body { padding: 20px 26px 8px; }

    /* Accent = the secondary brand color. It owns the client bar + the table
       header underline + the summary title, so picking a second color is always
       visible (primary owns the banner + grand total). nature flips these since
       its banner already uses the accent. */
    ${S} .pdf-client-box { border-inline-start: 3px solid ${accent}; background: #f6f8fb; padding: 12px 16px; border-radius: 8px; margin-bottom: 18px; }
    ${S} .pdf-client-label { color: ${accent}; }

    ${S} .pdf-summary { border: 1px solid #e6e8ec; border-radius: 8px; overflow: hidden; margin-bottom: 18px; }
    ${S} .pdf-summary-title { background: #f1f5f9; color: ${accent}; border-bottom: 1px solid #e6e8ec; }
    ${S} .pdf-summary-table th { color: #64748b; text-transform: uppercase; letter-spacing: 0.3px; font-size: 10.5px; border-bottom: 1px solid #eef1f4; }
    ${S} .pdf-summary-table td { border-bottom: 1px solid #f3f5f7; }
    ${S} .pdf-summary-table tr:last-child td { border-bottom: none; }

    ${S} .pdf-table { width: 100%; border-collapse: collapse; }
    ${S} .pdf-table th { padding: 9px 12px; text-align: start; font-size: 10.5px; font-weight: 600; color: #555; text-transform: uppercase; letter-spacing: 0.3px; background: #f5f6f8; border-bottom: 2px solid ${accent}; }
    ${S} .pdf-table td { padding: 8px 12px; text-align: start; font-size: 12px; border-bottom: 1px solid #eef1f4; }

    ${S} .pdf-totals-row td { padding: 4px 12px; }
    ${S} .pdf-totals-label { color: #64748b; text-align: end; }
    ${S} .pdf-totals-value { text-align: start; white-space: nowrap; }
    ${S} .pdf-totals-grand td { background: #f6f8fb; }
    ${S} .pdf-totals-grand .pdf-totals-label, ${S} .pdf-totals-grand .pdf-totals-value { color: ${primary}; font-weight: 700; font-size: 15px; border-top: 2px solid ${primary}; padding-top: 8px; }

    ${S} .pdf-note { font-size: 11px; color: #94a3b8; }

    /* Ad-hoc report (no banner) keeps a simple colored header. */
    ${S} .pdf-header { margin-bottom: 1.5rem; padding-bottom: 1.25rem; border-bottom: 2px solid ${primary}; }
    ${S} .pdf-section { margin-bottom: 1rem; }
    ${S} .pdf-section-title { font-size: 14px; font-weight: 700; margin: 0; color: ${primary}; border-bottom: 1px solid #e5e5e5; padding-bottom: 6px; margin-bottom: 8px; }
  `;

  const byTemplate: Record<PdfTemplate, string> = {
    // FILLED banner, clean grey table head with primary underline.
    modern: `
      ${S} .pdf-banner { background: ${primary}; color: ${pText}; }
      ${S} .pdf-banner .pdf-business-name, ${S} .pdf-banner .pdf-doc-title { color: ${pText}; }
      ${S} .pdf-banner-sub { color: ${pSub}; }
      ${S} .pdf-header .pdf-business-name { color: ${primary}; font-size: 20px; }
    `,
    // OUTLINED serif header, traditional ledger look, no fills/stripes.
    classic: `
      ${S} { font-family: Georgia, 'Times New Roman', serif; }
      ${S} .pdf-banner { background: #fff; color: #1a1a1a; border-bottom: 3px double ${primary}; }
      ${S} .pdf-banner .pdf-business-name { color: ${primary}; font-family: Georgia, serif; letter-spacing: 0.5px; }
      ${S} .pdf-banner .pdf-doc-title { color: #334155; font-variant: small-caps; }
      ${S} .pdf-banner-sub { color: #64748b; }
      ${S} .pdf-table th { background: transparent; border-bottom: 1px solid ${accent}; color: #333; font-family: Georgia, serif; letter-spacing: 0; text-transform: none; font-size: 11.5px; }
      ${S} .pdf-table td { border-bottom: 1px solid #ddd; }
      ${S} .pdf-summary-title { background: transparent; border-bottom: 1px solid #333; }
      ${S} .pdf-totals-grand td { background: transparent; }
      ${S} .pdf-totals-grand .pdf-totals-label, ${S} .pdf-totals-grand .pdf-totals-value { border-top: 1px double #333; }
    `,
    // HIGH-CONTRAST: filled banner, filled table head, solid total bar.
    bold: `
      ${S} .pdf-banner { background: ${primary}; color: ${pText}; padding: 26px; }
      ${S} .pdf-banner .pdf-business-name { color: ${pText}; font-weight: 900; font-size: 24px; }
      ${S} .pdf-banner .pdf-doc-title { color: ${pText}; text-transform: uppercase; letter-spacing: 1px; }
      ${S} .pdf-banner-sub { color: ${pSub}; }
      ${S} .pdf-table th { background: ${primary}; color: ${pText}; border-bottom: none; text-transform: uppercase; letter-spacing: 0.5px; }
      ${S} .pdf-totals-grand td { background: ${primary}; }
      ${S} .pdf-totals-grand .pdf-totals-label, ${S} .pdf-totals-grand .pdf-totals-value { color: ${pText}; border-top: none; font-size: 16px; padding: 8px 12px; }
    `,
    // AIRY & light: hairline outlined header, thin weights, lots of space.
    elegant: `
      ${S} .pdf-banner { background: #fff; color: #1a1a1a; border-bottom: 1px solid ${primary}; padding: 26px 26px 20px; }
      ${S} .pdf-banner .pdf-business-name { color: ${primary}; font-weight: 400; letter-spacing: 1.5px; font-size: 20px; }
      ${S} .pdf-banner .pdf-doc-title { color: #64748b; font-weight: 400; letter-spacing: 1px; text-transform: uppercase; font-size: 13px; }
      ${S} .pdf-banner-sub { color: #94a3b8; }
      ${S} .pdf-table th { background: transparent; border-bottom: 1px solid ${accent}; color: #8a8a8a; font-weight: 400; letter-spacing: 0.8px; font-size: 10px; }
      ${S} .pdf-table td { padding: 10px 12px; border-bottom: 1px solid #f0f0f0; }
      ${S} .pdf-summary-title { background: transparent; }
      ${S} .pdf-totals-grand td { background: transparent; }
      ${S} .pdf-totals-grand .pdf-totals-label, ${S} .pdf-totals-grand .pdf-totals-value { font-weight: 400; border-top: 1px solid ${primary}; }
    `,
    // ACCENT-led, soft, striped rows, pill-shaped grand total.
    nature: `
      ${S} .pdf-banner { background: ${accent}; color: ${aText}; }
      ${S} .pdf-banner .pdf-business-name, ${S} .pdf-banner .pdf-doc-title { color: ${aText}; }
      ${S} .pdf-banner-sub { color: ${aSub}; }
      /* Banner already uses the accent, so the secondary spots flip to primary. */
      ${S} .pdf-client-box { border-inline-start-color: ${primary}; }
      ${S} .pdf-client-label { color: ${primary}; }
      ${S} .pdf-summary-title { color: ${primary}; }
      ${S} .pdf-table th { background: #f4f8f5; border-bottom: 2px solid ${primary}; }
      ${S} .pdf-table tbody tr:nth-child(even) td { background: #fafdfb; }
      ${S} .pdf-totals-grand td { background: transparent; }
      ${S} .pdf-totals-grand .pdf-totals-label { border-top: none; color: ${aText}; background: ${accent}; border-start-start-radius: 999px; border-end-start-radius: 999px; padding: 6px 6px 6px 14px; }
      ${S} .pdf-totals-grand .pdf-totals-value { border-top: none; color: ${aText}; background: ${accent}; border-start-end-radius: 999px; border-end-end-radius: 999px; padding: 6px 14px 6px 6px; }
    `,
    // SIDE-BAND header (thick primary band on the start edge), cool striped table.
    ocean: `
      ${S} .pdf-banner { background: #f7fafd; color: #1a1a1a; border-inline-start: 6px solid ${primary}; border-bottom: 1px solid #e3edf6; }
      ${S} .pdf-banner .pdf-business-name { color: ${primary}; }
      ${S} .pdf-banner .pdf-doc-title { color: #334155; }
      ${S} .pdf-banner-sub { color: #64748b; }
      ${S} .pdf-table th { background: #f3f7fc; }
      ${S} .pdf-table tbody tr:nth-child(even) td { background: #fafcff; }
    `,
  };

  return base + byTemplate[template];
}

/**
 * Build the `@media print` CSS for a charge document: hide everything else,
 * set the page box, then apply the template rules scoped to `#pdf-content`.
 * @param direction - document direction ("rtl" for Hebrew, "ltr" for English)
 */
export function buildPrintStyles(
  template: PdfTemplate,
  primaryColor: string,
  accentColor: string,
  direction: PrintDirection = "rtl",
  primaryText: OnColorText = "light",
  accentText: OnColorText = "light"
): string {
  return `
    @media print {
      body > *:not(#pdf-content) { display: none !important; }
      #pdf-content {
        display: block !important;
        direction: ${direction} !important;
        /* Internal inset so the banner color + text are never flush to the paper
           edge — keeps content inside the printer's safe area even if the print
           dialog margins are set to "None" (@page alone isn't enough then). */
        padding: 10mm 12mm;
      }
      @page { size: A4; margin: 6mm; }
      body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      ${templateRules(template, primaryColor, accentColor, "#pdf-content", primaryText, accentText)}
    }
  `;
}

/**
 * Inject the print styles, clone `#pdf-content` into a body-level container,
 * trigger the browser print dialog, and clean up afterwards.
 * Caller must have an element with id `pdf-content` mounted in the DOM.
 * @param direction - document direction ("rtl" for Hebrew, "ltr" for English)
 */
export function printPdfContent(
  template: PdfTemplate,
  primaryColor: string,
  accentColor: string,
  filename?: string,
  direction: PrintDirection = "rtl",
  primaryText: OnColorText = "light",
  accentText: OnColorText = "light"
): void {
  // Optionally override the document title so the browser's "Save as PDF"
  // dialog suggests a meaningful filename; restore it during cleanup.
  const originalTitle = document.title;
  if (filename !== undefined) {
    document.title = filename;
  }

  // Inject print styles dynamically.
  const styleId = "pdf-print-styles";
  let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = styleId;
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = buildPrintStyles(template, primaryColor, accentColor, direction, primaryText, accentText);

  // Clone #pdf-content and append directly to body so print CSS works reliably
  // (the original is nested deep in the React tree and gets hidden by ancestor rules).
  const pdfContent = document.getElementById("pdf-content");
  if (!pdfContent) {
    if (filename !== undefined) document.title = originalTitle;
    return;
  }

  const printContainer = pdfContent.cloneNode(true) as HTMLElement;
  printContainer.id = "pdf-print-container";
  printContainer.setAttribute("dir", direction);
  printContainer.style.display = "none";
  document.body.appendChild(printContainer);

  // Re-target the print styles at the body-level clone.
  styleEl.textContent = (styleEl.textContent || "").replace(
    /#pdf-content/g,
    "#pdf-print-container"
  );

  // Trigger browser print (which allows "Save as PDF").
  const styleElToClean = styleEl;
  setTimeout(() => {
    printContainer.style.display = "block";
    window.print();
    // Clean up after print.
    setTimeout(() => {
      printContainer.remove();
      if (styleElToClean.parentNode) {
        styleElToClean.parentNode.removeChild(styleElToClean);
      }
      if (filename !== undefined) {
        document.title = originalTitle;
      }
    }, 1000);
  }, 100);
}
