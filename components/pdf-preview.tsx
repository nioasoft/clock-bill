/**
 * Lightweight live preview of the invoice/PDF appearance for the settings PDF
 * card. It is NOT a pixel-accurate render of the 6 print templates — it gives a
 * quick sense of how the chosen template + brand colors + business header look,
 * updating live as the user edits. Printed documents are light, so this uses
 * explicit light colors + inline styles (the documented exception to the dark
 * design system) rather than the dark theme tokens.
 */
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
  // Sample copy follows the UI locale (the preview is illustrative, not real data).
  const tx = isHebrew
    ? { fallbackName: "שם העסק", description: "תיאור", amount: "סכום", lineConsulting: "ייעוץ — 8 שעות", lineItem: "פריט חיוב", total: "סה״כ ₪1,500" }
    : { fallbackName: "Business name", description: "Description", amount: "Amount", lineConsulting: "Consulting — 8 hrs", lineItem: "Billing item", total: "Total ₪1,500" };
  const name = businessName.trim() || tx.fallbackName;
  const addr = [addressStreet.trim(), addressCity.trim()].filter(Boolean).join(", ");
  // Header style varies a little by template so the choice is visibly reflected.
  const outlinedHeader = template === "classic" || template === "elegant";
  const headerStyle = outlinedHeader
    ? { background: "#ffffff", color: "#1a1a1a", borderBottom: `3px solid ${primary}` }
    : { background: primary, color: "#ffffff" };

  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground mb-2">{label}</p>
      <div
        dir={isHebrew ? "rtl" : "ltr"}
        className="overflow-hidden rounded-[var(--radius)] border border-border"
        style={{ background: "#ffffff", color: "#1a1a1a" }}
      >
        {/* Header */}
        <div className="flex items-center gap-3" style={{ ...headerStyle, padding: "14px 16px" }}>
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt=""
              style={{ height: 34, width: 34, objectFit: "contain", borderRadius: 4, background: "#fff", flexShrink: 0 }}
            />
          ) : null}
          <div className="min-w-0">
            <div className="truncate" style={{ fontWeight: 700, fontSize: 14 }}>{name}</div>
            {addr ? (
              <div className="truncate" style={{ fontSize: 11, opacity: 0.85 }}>{addr}</div>
            ) : null}
          </div>
          <div style={{ marginInlineStart: "auto", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>{docTitle}</div>
        </div>

        {/* Body — sample lines */}
        <div style={{ padding: "14px 16px" }}>
          <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ color: accent, borderBottom: "1px solid #e7e7e7" }}>
                <th style={{ textAlign: "start", padding: "4px 0", fontWeight: 600 }}>{tx.description}</th>
                <th style={{ textAlign: "end", padding: "4px 0", fontWeight: 600 }}>{tx.amount}</th>
              </tr>
            </thead>
            <tbody style={{ color: "#333" }}>
              <tr>
                <td style={{ padding: "4px 0" }}>{tx.lineConsulting}</td>
                <td style={{ textAlign: "end" }}>₪1,200</td>
              </tr>
              <tr>
                <td style={{ padding: "4px 0" }}>{tx.lineItem}</td>
                <td style={{ textAlign: "end" }}>₪300</td>
              </tr>
            </tbody>
          </table>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
            <div
              style={{ background: accent, color: "#fff", padding: "4px 12px", borderRadius: 4, fontSize: 12, fontWeight: 700 }}
            >
              {tx.total}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
