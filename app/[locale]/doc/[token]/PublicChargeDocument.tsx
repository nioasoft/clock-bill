"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { NextIntlClientProvider, useTranslations } from "next-intl";
import {
  BadgeCheck,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Download,
  FileCheck2,
  LockKeyhole,
  Mail,
  Printer,
  Send,
} from "lucide-react";
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
import { formatDate } from "@/lib/format";
import type {
  PublicDocumentHistoryEvent,
  PublicPaymentMethod,
} from "@/lib/public-charge-document";
import "@/app/[locale]/(auth)/reports/pdf-styles.css";
import "@/app/[locale]/(auth)/reports/pdf-templates.css";

const VALID_TEMPLATES = ["modern", "classic", "bold", "elegant", "nature", "ocean"] as const;

function asTemplate(value: string | null): PdfTemplate {
  return (VALID_TEMPLATES as readonly string[]).includes(value ?? "")
    ? (value as PdfTemplate)
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
  history: PublicDocumentHistoryEvent[];
  approvedAt: string | null;
  approvedBy: "owner" | "client" | null;
}

function HistoryIcon({ type }: { type: PublicDocumentHistoryEvent["type"] }) {
  const className = "h-4 w-4";
  if (type === "payment") return <CircleDollarSign className={className} aria-hidden="true" />;
  if (type === "sent") return <Send className={className} aria-hidden="true" />;
  if (type === "approved") return <BadgeCheck className={className} aria-hidden="true" />;
  return <FileCheck2 className={className} aria-hidden="true" />;
}

function PortalView(props: Props) {
  const { doc, lines, profile, primaryColor, accentColor, locale, paidSum, history } = props;
  const t = useTranslations("Portal");
  const router = useRouter();
  // The bearer token is read from the URL (this page IS /doc/[token]) — it is
  // deliberately never passed through Server Component props.
  const params = useParams<{ token: string }>();
  const urlToken = params?.token ?? "";
  const template = asTemplate(props.template);
  const primaryText: OnColorText = props.primaryText;
  const dir = locale === "he" ? "rtl" : "ltr";

  // Client approve action: optimistic local state + a server refresh so the
  // timeline picks up the new event. Inline two-step confirm (no modal — Radix
  // dialogs scroll-lock the page).
  const [approvedAt, setApprovedAt] = useState<string | null>(props.approvedAt);
  const [approveConfirming, setApproveConfirming] = useState(false);
  const [approving, setApproving] = useState(false);
  const [approveError, setApproveError] = useState(false);
  const [justApproved, setJustApproved] = useState(false);

  async function handleApprove() {
    setApproving(true);
    setApproveError(false);
    try {
      const res = await fetch(`/api/public/doc/${urlToken}/approve`, { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setApproveError(true);
        return;
      }
      setApprovedAt((json.data?.approvedAt as string) ?? new Date().toISOString());
      setJustApproved(true);
      setApproveConfirming(false);
      router.refresh();
    } catch {
      setApproveError(true);
    } finally {
      setApproving(false);
    }
  }
  const formatCurrency = (amount: number, currency: string) =>
    formatCurrencyLib(amount, currency, locale);
  const money = documentMoney({
    total: doc.total,
    discountType: doc.discount_type,
    discountValue: doc.discount_value,
    vatRate: doc.vat_rate_snapshot,
  });
  const outstandingAmount = outstanding(money.gross, paidSum);
  const paidPercent = money.gross > 0
    ? Math.min(100, Math.max(0, (paidSum / money.gross) * 100))
    : 100;
  const baseStatus = doc.status === "paid" ? "paid" : doc.status === "partial" ? "partial" : "pending";
  // Approval overlays a still-pending document as "approved — awaiting payment".
  const status = approvedAt && baseStatus === "pending" ? "approved" : baseStatus;
  const StatusIcon = status === "paid" ? CheckCircle2 : status === "approved" ? BadgeCheck : Clock3;
  const statusClass = status === "paid" || status === "approved"
    ? "border-success/30 bg-success/10 text-success"
    : status === "partial"
      ? "border-warning/30 bg-warning/10 text-warning"
      : "border-primary/30 bg-primary/10 text-primary";
  const canApprove = !approvedAt && baseStatus !== "paid";
  const businessName = profile.businessName || "ClockBill";
  const contactSubject = encodeURIComponent(
    locale === "he"
      ? `שאלה לגבי תעודת התחשבנות #${doc.doc_number}`
      : `Question about settlement document #${doc.doc_number}`
  );

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
    const filename = `statement_${doc.doc_number}_${doc.client_name}`
      .replace(/[/\s]+/g, "_")
      .trim();
    printPdfContent(template, primaryColor, accentColor, filename, dir, primaryText);
  }

  function historyLabel(event: PublicDocumentHistoryEvent): string {
    if (event.type === "approved") {
      return t(event.by === "owner" ? "history.approvedByOwner" : "history.approvedByClient");
    }
    if (event.type !== "payment") return t(`history.${event.type}`);
    const amount = formatCurrency(event.amount ?? 0, doc.currency);
    const method = event.method
      ? t(`paymentMethod.${event.method as PublicPaymentMethod}`)
      : null;
    return method
      ? `${t("history.payment")} · ${amount} · ${method}`
      : `${t("history.payment")} · ${amount}`;
  }

  return (
    <div dir={dir} className="min-h-screen bg-background px-3 py-5 text-foreground sm:px-6 sm:py-8">
      <style dangerouslySetInnerHTML={{ __html: screenCss }} />
      <div className="mx-auto max-w-5xl">
        <header className="mb-4 rounded-[var(--radius-card)] border border-border bg-card p-4 sm:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-muted-foreground">
                <span className="uppercase tracking-[0.14em]">{t("eyebrow")}</span>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1.5">
                  <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />
                  {t("privateLink")}
                </span>
              </div>
              <h1 id="public-document-title" className="text-2xl font-bold tracking-tight sm:text-3xl">
                {t("title", { number: doc.doc_number })}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground sm:text-base">
                <bdi>{doc.client_name}</bdi>
                <span aria-hidden="true"> · </span>
                <bdi>{formatDate(doc.issued_at, undefined, locale)}</bdi>
              </p>
            </div>
            <span
              className={`inline-flex min-h-11 shrink-0 items-center gap-2 self-start rounded-full border px-4 py-2 text-sm font-semibold ${statusClass}`}
              role="status"
            >
              <StatusIcon className="h-4 w-4" aria-hidden="true" />
              {t(`status.${status}`)}
            </span>
          </div>
        </header>

        <section
          aria-labelledby="payment-summary-title"
          className="mb-4 rounded-[var(--radius-card)] border border-border bg-card p-4 sm:p-6"
        >
          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 id="payment-summary-title" className="text-lg font-bold">{t("summaryTitle")}</h2>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t("printHint")}</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="button" variant="outline" onClick={handlePrint}>
                <Printer className="h-4 w-4" aria-hidden="true" />
                {t("print")}
              </Button>
              <Button type="button" onClick={handlePrint}>
                <Download className="h-4 w-4" aria-hidden="true" />
                {t("savePdf")}
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[var(--radius)] border border-border bg-surface p-4">
              <p className="text-sm text-muted-foreground">{t("total")}</p>
              <bdi className="mt-1 block font-mono text-xl font-bold tabular-nums">
                {formatCurrency(money.gross, doc.currency)}
              </bdi>
            </div>
            <div className="rounded-[var(--radius)] border border-border bg-surface p-4">
              <p className="text-sm text-muted-foreground">{t("paid")}</p>
              <bdi className="mt-1 block font-mono text-xl font-bold tabular-nums text-success">
                {formatCurrency(paidSum, doc.currency)}
              </bdi>
            </div>
            <div className="rounded-[var(--radius)] border border-primary/30 bg-primary/5 p-4">
              <p className="text-sm text-muted-foreground">{t("outstanding")}</p>
              <bdi className="mt-1 block font-mono text-xl font-bold tabular-nums text-primary">
                {formatCurrency(outstandingAmount, doc.currency)}
              </bdi>
            </div>
          </div>
          <div
            className="mt-4 h-2 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-label={t("paid")}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(paidPercent)}
          >
            <div className="h-full rounded-full bg-success" style={{ width: `${paidPercent}%` }} />
          </div>

          {/* ── Client approval ── */}
          {canApprove && (
            <div className="mt-5 rounded-[var(--radius)] border border-success/30 bg-success/[0.06] p-4">
              <p className="text-sm font-semibold text-foreground">{t("approveTitle")}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t("approveDescription")}</p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                {approveConfirming ? (
                  <>
                    <Button
                      type="button"
                      onClick={() => void handleApprove()}
                      disabled={approving}
                      aria-busy={approving}
                    >
                      <BadgeCheck className="h-4 w-4" aria-hidden="true" />
                      {approving ? "…" : t("approveConfirmAction")}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setApproveConfirming(false)}
                      disabled={approving}
                    >
                      {t("approveCancel")}
                    </Button>
                  </>
                ) : (
                  <Button type="button" onClick={() => setApproveConfirming(true)}>
                    <BadgeCheck className="h-4 w-4" aria-hidden="true" />
                    {t("approve")}
                  </Button>
                )}
              </div>
              {approveConfirming && (
                <p className="mt-2 text-xs text-muted-foreground">{t("approveConfirmNote")}</p>
              )}
              {approveError && (
                <p className="mt-2 text-sm text-destructive" role="alert">{t("approveError")}</p>
              )}
            </div>
          )}
          {approvedAt && baseStatus !== "paid" && (
            <div
              className="mt-5 flex items-center gap-2 rounded-[var(--radius)] border border-success/30 bg-success/[0.06] px-4 py-3 text-sm text-foreground"
              role="status"
            >
              <BadgeCheck className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
              {justApproved
                ? t("approveSuccess")
                : t("approvedOn", { date: formatDate(approvedAt, undefined, locale) })}
            </div>
          )}
        </section>

        <section aria-labelledby="document-details-title" className="mb-4">
          <h2 id="document-details-title" className="sr-only">{t("documentTitle")}</h2>
          <article aria-labelledby="public-document-title"
            className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-white shadow-sm"
          >
            <PdfChargeDocument doc={doc} lines={lines} profile={profile} />
          </article>
        </section>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.55fr)]">
          <section
            aria-labelledby="document-history-title"
            className="rounded-[var(--radius-card)] border border-border bg-card p-4 sm:p-6"
          >
            <h2 id="document-history-title" className="text-lg font-bold">{t("historyTitle")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("historyDescription")}</p>
            <ol className="mt-5 space-y-0">
              {history.map((event, index) => (
                <li key={event.key} className="relative flex gap-3 pb-5 last:pb-0">
                  {index < history.length - 1 && (
                    <span className="absolute start-[17px] top-9 h-[calc(100%-1.5rem)] w-px bg-border" aria-hidden="true" />
                  )}
                  <span className="relative z-10 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-primary">
                    <HistoryIcon type={event.type} />
                  </span>
                  <div className="min-w-0 pt-0.5">
                    <p className="text-sm font-semibold text-foreground"><bdi>{historyLabel(event)}</bdi></p>
                    <time dateTime={event.occurredAt} className="mt-0.5 block text-sm text-muted-foreground">
                      <bdi>{formatDate(event.occurredAt, undefined, locale)}</bdi>
                    </time>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <aside className="rounded-[var(--radius-card)] border border-border bg-card p-4 sm:p-6">
            <h2 className="text-lg font-bold">{t("helpTitle")}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {t("helpDescription", { business: businessName })}
            </p>
            {profile.email && (
              <Button asChild variant="outline" className="mt-5 w-full">
                <a href={`mailto:${profile.email}?subject=${contactSubject}`}>
                  <Mail className="h-4 w-4" aria-hidden="true" />
                  {t("contact")}
                </a>
              </Button>
            )}
          </aside>
        </div>

        <footer className="py-6 text-center text-sm text-muted-foreground">
          <a
            href="https://www.clock-bill.com"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center font-semibold text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("generatedWith")}
          </a>
        </footer>
      </div>
    </div>
  );
}

export default function PublicChargeDocument(props: Props) {
  const messages = useDocumentMessages(props.locale);
  const dir = props.locale === "he" ? "rtl" : "ltr";

  if (!messages) {
    return (
      <div
        dir={dir}
        className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground"
        aria-busy="true"
      >
        <div className="w-full max-w-3xl animate-pulse rounded-[var(--radius-card)] border border-border bg-card p-6 motion-reduce:animate-none">
          <span className="sr-only">{props.locale === "he" ? "טוען את המסמך" : "Loading document"}</span>
          <div className="h-7 w-2/3 rounded bg-muted" />
          <div className="mt-4 h-4 w-1/3 rounded bg-muted" />
          <div className="mt-8 h-64 rounded bg-muted" />
        </div>
      </div>
    );
  }

  return (
    <NextIntlClientProvider locale={props.locale} messages={messages}>
      <PortalView {...props} />
    </NextIntlClientProvider>
  );
}
