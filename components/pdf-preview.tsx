/**
 * WYSIWYG live preview of the charge-document template for the settings PDF card.
 *
 * It renders a small SAMPLE document using the very same `.pdf-*` class hooks as
 * the real printed document, and injects the same `templateRules(...)` CSS scoped
 * to this preview's root. So picking a template / changing the brand colors shows
 * exactly what the printed document will look like — the preview can't drift from
 * the real output. Printed documents are light, so this stays light (the
 * documented exception to the dark design system).
 */
"use client";

import { useEffect, useId, useRef } from "react";
import { templateRules, type PdfTemplate } from "@/app/[locale]/(auth)/reports/printStyles";

interface PdfPreviewProps {
  template: string;
  primaryColor: string;
  accentColor: string;
  businessName: string;
  addressStreet: string;
  addressCity: string;
  logoUrl: string | null;
  label: string;
  docTitle: string;
  /** Follows the UI locale so the sample content matches the language. */
  isHebrew: boolean;
}

const HEX = /^#[0-9A-Fa-f]{6}$/;
const KNOWN: readonly PdfTemplate[] = ["modern", "classic", "bold", "elegant", "nature", "ocean"];

export function PdfPreview({
  template,
  primaryColor,
  accentColor,
  businessName,
  addressStreet,
  addressCity,
  logoUrl,
  label,
  docTitle,
  isHebrew,
}: PdfPreviewProps) {
  const primary = HEX.test(primaryColor) ? primaryColor : "#A8622D";
  const accent = HEX.test(accentColor) ? accentColor : "#347B52";
  const tpl: PdfTemplate = (KNOWN as readonly string[]).includes(template)
    ? (template as PdfTemplate)
    : "modern";

  // Unique, CSS-safe scope id so the injected rules only hit this preview.
  const scopeId = "pdftpl-" + useId().replace(/[^a-zA-Z0-9_-]/g, "");

  const name = businessName.trim() || (isHebrew ? "שם העסק" : "Business name");
  const addr = [addressStreet.trim(), addressCity.trim()].filter(Boolean).join(", ");
  const tx = isHebrew
    ? { for: "עבור", client: "לקוח לדוגמה", number: "מספר 1", date: "01/01/2026",
        item: "פריט", details: "פירוט", qty: "כמות / תעריף", amount: "סכום",
        line1: "תכנות", line1d: "פיתוח עמוד", line2: "עיצוב",
        subtotal: "סכום ביניים", vat: "מע״מ 18%", total: "סה״כ לתשלום", hours: "8ש׳" }
    : { for: "For", client: "Sample client", number: "No. 1", date: "01/01/2026",
        item: "Item", details: "Details", qty: "Qty / Rate", amount: "Amount",
        line1: "Development", line1d: "Landing page", line2: "Design",
        subtotal: "Subtotal", vat: "VAT 18%", total: "Total due", hours: "8h" };

  // The same rules that style the printed document, scoped to this preview only.
  const css = templateRules(tpl, primary, accent, `#${scopeId}`);

  // Inject the rules into <head> (created once, updated in place, removed on
  // unmount) instead of rendering a <style> in the body tree — re-rendering a
  // body-level <style> on every color/template change churns layout and made
  // the settings page jump to the top.
  const styleRef = useRef<HTMLStyleElement | null>(null);
  useEffect(() => {
    const el = document.createElement("style");
    el.setAttribute("data-pdf-preview", scopeId);
    document.head.appendChild(el);
    styleRef.current = el;
    return () => {
      el.remove();
      styleRef.current = null;
    };
  }, [scopeId]);
  useEffect(() => {
    if (styleRef.current) styleRef.current.textContent = css;
  }, [css]);

  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground mb-2">{label}</p>
      <div
        id={scopeId}
        dir={isHebrew ? "rtl" : "ltr"}
        className="overflow-hidden rounded-[var(--radius)] border border-border"
        style={{ background: "#ffffff" }}
      >
        {/* Banner */}
        <div className="pdf-banner">
          <div style={{ flex: 1, minWidth: 0 }}>
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="" className="pdf-banner-logo" />
            ) : null}
            <div className="pdf-business-name">{name}</div>
            {addr ? <div className="pdf-banner-sub">{addr}</div> : null}
          </div>
          <div className="pdf-banner-meta">
            <div className="pdf-doc-title">{docTitle}</div>
            <div className="pdf-banner-sub">
              <div>{tx.number}</div>
              <div>{tx.date}</div>
            </div>
          </div>
        </div>

        <div className="pdf-body">
          {/* Client box */}
          <div className="pdf-client-box">
            <div className="pdf-client-label" style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px" }}>
              {tx.for}
            </div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>{tx.client}</div>
          </div>

          {/* Detail table */}
          <table className="pdf-table">
            <thead>
              <tr>
                <th>{tx.item}</th>
                <th>{tx.details}</th>
                <th>{tx.qty}</th>
                <th>{tx.amount}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{tx.line1}</td>
                <td>{tx.line1d}</td>
                <td style={{ whiteSpace: "nowrap" }}>{tx.hours} × ₪150</td>
                <td style={{ whiteSpace: "nowrap" }}>₪1,200</td>
              </tr>
              <tr>
                <td>{tx.line2}</td>
                <td>—</td>
                <td style={{ whiteSpace: "nowrap" }}>1 × ₪300</td>
                <td style={{ whiteSpace: "nowrap" }}>₪300</td>
              </tr>
            </tbody>
          </table>

          {/* Totals */}
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
            <table style={{ minWidth: 200, borderCollapse: "collapse" }}>
              <tbody>
                <tr className="pdf-totals-row">
                  <td className="pdf-totals-label" style={{ fontSize: 12 }}>{tx.subtotal}</td>
                  <td className="pdf-totals-value" style={{ fontSize: 12 }}>₪1,500</td>
                </tr>
                <tr className="pdf-totals-row">
                  <td className="pdf-totals-label" style={{ fontSize: 12 }}>{tx.vat}</td>
                  <td className="pdf-totals-value" style={{ fontSize: 12 }}>₪270</td>
                </tr>
                <tr className="pdf-totals-row pdf-totals-grand">
                  <td className="pdf-totals-label">{tx.total}</td>
                  <td className="pdf-totals-value">₪1,770</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
