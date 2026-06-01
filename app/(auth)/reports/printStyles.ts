/**
 * Shared PDF print helper for the reports screen.
 *
 * Both the ad-hoc report and the charge-document view need an identical
 * print routine: build the @media print CSS for the chosen template, clone the
 * on-page `#pdf-content` block into a body-level container (so the print CSS
 * isn't suppressed by ancestor rules deep in the React tree), call
 * `window.print()`, then clean up. This module is the single source of truth
 * for that logic — extracted verbatim from AdHocReportTab.confirmExportPdf.
 */

export type PdfTemplate =
  | "modern"
  | "classic"
  | "bold"
  | "elegant"
  | "nature"
  | "ocean";

/**
 * Build the `@media print` CSS for a template. Colors come from the user's
 * profile (with the same defaults the ad-hoc report uses).
 * @param template - which of the 6 PDF templates to style for
 * @param primaryColor - profile pdfPrimaryColor (hex)
 * @param accentColor - profile pdfAccentColor (hex)
 * @returns the full CSS string to inject into a <style> element
 */
export function buildPrintStyles(
  template: PdfTemplate,
  primaryColor: string,
  accentColor: string
): string {
  const baseStyles = `
    @media print {
      body > *:not(#pdf-content) { display: none !important; }
      #pdf-content {
        display: block !important;
        direction: rtl !important;
        font-family: -apple-system, 'Segoe UI', Arial, sans-serif;
        font-size: 13px;
        color: #1a1a1a;
        line-height: 1.5;
      }
      @page { size: A4; margin: 18mm 15mm; }
      body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      .pdf-header { margin-bottom: 1.5rem; }
      .pdf-section { margin-bottom: 1.25rem; }
      .pdf-table { width: 100%; border-collapse: collapse; }
      .pdf-table th { padding: 8px 10px; text-align: right; font-size: 11px; font-weight: 600; }
      .pdf-table td { padding: 7px 10px; text-align: right; font-size: 12px; }
      .pdf-table tfoot td { font-weight: 600; }
      .pdf-section-title { font-size: 14px; font-weight: 700; margin: 0; }
    }
  `;

  const templateStyles: Record<PdfTemplate, string> = {
    modern: `
      ${baseStyles}
      @media print {
        .pdf-header { border-bottom: 3px solid ${primaryColor}; padding-bottom: 1.25rem; }
        .pdf-business-name { color: ${primaryColor}; font-size: 20px; }
        .pdf-section-title { color: ${primaryColor}; border-bottom: 1px solid #e5e5e5; padding-bottom: 6px; margin-bottom: 8px; }
        .pdf-table th { background: #f5f5f0 !important; color: #555; text-transform: uppercase; letter-spacing: 0.3px; border-bottom: 2px solid ${primaryColor}; }
        .pdf-table td { border-bottom: 1px solid #eee; }
        .pdf-table tfoot td { border-top: 2px solid ${primaryColor}; background: #faf9f7 !important; }
      }
    `,
    classic: `
      ${baseStyles}
      @media print {
        .pdf-header { border-bottom: 1px solid #333; padding-bottom: 1.25rem; }
        .pdf-business-name { font-size: 22px; font-weight: 700; font-family: Georgia, 'Times New Roman', serif; }
        .pdf-section-title { font-family: Georgia, serif; border-bottom: 1px double #999; padding-bottom: 4px; margin-bottom: 8px; }
        .pdf-table th { background: #f8f8f8 !important; color: #333; border-bottom: 2px solid #333; font-family: Georgia, serif; }
        .pdf-table td { border-bottom: 1px solid #ddd; }
        .pdf-table tfoot td { border-top: 2px solid #333; }
      }
    `,
    bold: `
      ${baseStyles}
      @media print {
        .pdf-header { border-right: 5px solid ${primaryColor}; padding-right: 1rem; padding-bottom: 1rem; }
        .pdf-business-name { font-size: 24px; font-weight: 900; color: ${primaryColor}; }
        .pdf-section-title { color: #1a1a1a; background: #f0ebe4 !important; padding: 6px 10px; margin-bottom: 0; }
        .pdf-table th { background: ${primaryColor} !important; color: white !important; text-transform: uppercase; letter-spacing: 0.5px; }
        .pdf-table td { border-bottom: 1px solid #e8e4de; }
        .pdf-table tfoot td { background: #f0ebe4 !important; border-top: 3px solid ${primaryColor}; }
      }
    `,
    elegant: `
      ${baseStyles}
      @media print {
        .pdf-header { border-bottom: 1px solid #d4c5b0; padding-bottom: 1.25rem; }
        .pdf-business-name { font-size: 20px; font-weight: 400; letter-spacing: 1px; color: #4a3728; }
        .pdf-section-title { color: #4a3728; font-weight: 400; letter-spacing: 0.5px; border-bottom: 1px solid #e8dfd4; padding-bottom: 4px; margin-bottom: 8px; }
        .pdf-table th { color: #8a7560; font-weight: 400; text-transform: uppercase; letter-spacing: 0.8px; font-size: 10px; border-bottom: 1px solid #d4c5b0; }
        .pdf-table td { border-bottom: 1px solid #f0ebe4; }
        .pdf-table tfoot td { border-top: 1px solid #d4c5b0; }
      }
    `,
    nature: `
      ${baseStyles}
      @media print {
        .pdf-header { border-bottom: 3px solid ${accentColor}; padding-bottom: 1.25rem; }
        .pdf-business-name { color: ${accentColor}; font-size: 20px; }
        .pdf-section-title { color: ${accentColor}; border-bottom: 1px solid #c8e6d5; padding-bottom: 6px; margin-bottom: 8px; }
        .pdf-table th { background: #eef7f1 !important; color: #2d5a3e; border-bottom: 2px solid ${accentColor}; }
        .pdf-table td { border-bottom: 1px solid #e8f4ec; }
        .pdf-table tbody tr:nth-child(even) td { background: #f7fbf9 !important; }
        .pdf-table tfoot td { border-top: 2px solid ${accentColor}; background: #eef7f1 !important; }
      }
    `,
    ocean: `
      ${baseStyles}
      @media print {
        .pdf-header { border-bottom: 3px solid #2563EB; padding-bottom: 1.25rem; }
        .pdf-business-name { color: #1e40af; font-size: 20px; }
        .pdf-section-title { color: #1e40af; border-bottom: 1px solid #dbeafe; padding-bottom: 6px; margin-bottom: 8px; }
        .pdf-table th { background: #eff6ff !important; color: #1e40af; border-bottom: 2px solid #2563EB; }
        .pdf-table td { border-bottom: 1px solid #e8f0fe; }
        .pdf-table tbody tr:nth-child(even) td { background: #f8fbff !important; }
        .pdf-table tfoot td { border-top: 2px solid #2563EB; background: #eff6ff !important; }
      }
    `,
  };

  return templateStyles[template] || templateStyles.modern;
}

/**
 * Inject the print styles, clone `#pdf-content` into a body-level container,
 * trigger the browser print dialog, and clean up afterwards. Behavior is
 * identical to the original inline routine in AdHocReportTab.confirmExportPdf.
 * Caller must have an element with id `pdf-content` mounted in the DOM.
 */
export function printPdfContent(
  template: PdfTemplate,
  primaryColor: string,
  accentColor: string
): void {
  // Inject print styles dynamically.
  const styleId = "pdf-print-styles";
  let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = styleId;
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = buildPrintStyles(template, primaryColor, accentColor);

  // Clone #pdf-content and append directly to body so print CSS works reliably
  // (the original is nested deep in the React tree and gets hidden by ancestor rules).
  const pdfContent = document.getElementById("pdf-content");
  if (!pdfContent) return;

  const printContainer = pdfContent.cloneNode(true) as HTMLElement;
  printContainer.id = "pdf-print-container";
  printContainer.setAttribute("dir", "rtl");
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
    }, 1000);
  }, 100);
}
