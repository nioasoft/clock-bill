"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { showSuccessToast, showErrorToast } from "@/lib/toast";
import { formatDuration, formatDate } from "@/lib/format";
import { formatCurrency } from "@/lib/currency";
import { calcHourlyAmount, calcItemAmount, sumMoney } from "@/lib/money";
import { roundBillableMinutes, type RoundingMode } from "@/lib/rounding";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MonthField } from "@/components/ui/month-field";
import { EmptyState } from "@/components/ui/empty-state";
import { Users, FileText } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Client {
  id: string;
  name: string;
}

interface BillableEntryRow {
  id: string;
  description: string;
  notes: string | null;
  date: string;
  billing_kind: "hourly" | "item" | null;
  duration: number;
  quantity: number | null;
  rate: number | null;
  rate_label: string | null;
  unit: string | null;
  item_ref: number | null;
  project_name: string;
  currency: string;
  // Resolved hourly rounding mode (project override ?? client default) from the API.
  billing_rounding: RoundingMode;
}

interface ComputedRow {
  sourceType: "fixed_monthly";
  periodMonth: string;
  label: string;
  amount: number;
  currency: string;
  alreadyBilled: boolean;
}

interface BillableData {
  entries: BillableEntryRow[];
  computedLines: ComputedRow[];
}

type LoadState = "idle" | "loading" | "error" | "ready";

/** Minutes actually billed for an hourly entry after applying its rounding policy. */
function billedMinutes(entry: BillableEntryRow): number {
  return roundBillableMinutes(entry.duration, entry.billing_rounding);
}

/**
 * Per-entry billed amount, rounded to whole cents to match what the server
 * stores: item = quantity × rate, hourly = (roundedMinutes/60) × rate.
 */
function entryAmount(entry: BillableEntryRow): number {
  if (entry.billing_kind === "item") {
    return calcItemAmount(entry.quantity, entry.rate);
  }
  return calcHourlyAmount(billedMinutes(entry), entry.rate);
}

export default function BillableTab({
  onIssued,
}: {
  onIssued?: (documentId: string) => void;
}) {
  const t = useTranslations("Reports");
  const locale = useLocale();
  const [clients, setClients] = useState<Client[]>([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [clientId, setClientId] = useState<string>("");
  // Current month (YYYY-MM); computing once on mount is fine in a client component.
  const [periodMonth, setPeriodMonth] = useState<string>(() =>
    new Date().toISOString().slice(0, 7)
  );

  const [state, setState] = useState<LoadState>("idle");
  const [data, setData] = useState<BillableData | null>(null);

  const [selectedEntryIds, setSelectedEntryIds] = useState<Set<string>>(new Set());
  const [selectedComputed, setSelectedComputed] = useState<Set<string>>(new Set());
  const [issuing, setIssuing] = useState(false);

  // Bumping this re-triggers the billable fetch (retry button, post-issue reload).
  const [reloadKey, setReloadKey] = useState(0);

  // Reuse the reports bootstrap endpoint so the picker matches the rest of the screen.
  useEffect(() => {
    const fetchClients = async () => {
      setClientsLoading(true);
      try {
        const response = await fetch("/api/reports/init");
        const json = await response.json();
        if (json.success) setClients(json.clients || []);
      } catch (error) {
        console.error("Error loading clients:", error);
      } finally {
        setClientsLoading(false);
      }
    };
    fetchClients();
  }, []);

  // Retry / post-issue reload: bump the key the fetch effect depends on.
  const reloadBillable = () => setReloadKey((k) => k + 1);

  useEffect(() => {
    if (!clientId) {
      setState("idle");
      setData(null);
      return;
    }
    let ignore = false;
    setState("loading");
    setSelectedEntryIds(new Set());
    setSelectedComputed(new Set());
    (async () => {
      try {
        const params = new URLSearchParams({ clientId, periodMonth });
        const res = await fetch(
          `/api/charge-documents/billable?${params.toString()}`
        );
        const json = await res.json();
        // Ignore a response that arrived after client/month changed mid-flight.
        if (ignore) return;
        if (!json.success) throw new Error(json.message || "load failed");
        setData(json.data as BillableData);
        setState("ready");
      } catch (error) {
        if (ignore) return;
        console.error("Error loading billable items:", error);
        setState("error");
      }
    })();
    return () => {
      ignore = true;
    };
  }, [clientId, periodMonth, reloadKey]);

  const toggleEntry = (id: string) => {
    setSelectedEntryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleComputed = (key: string) => {
    setSelectedComputed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Computed lines have no stable id; key by sourceType+periodMonth+label.
  const computedKey = (line: ComputedRow): string =>
    `${line.sourceType}|${line.periodMonth}|${line.label}`;

  // The billable endpoint returns a single client's items, so all rows share one currency.
  const clientCurrency = useMemo(() => {
    if (!data) return "ILS";
    if (data.entries.length > 0) return data.entries[0].currency;
    if (data.computedLines.length > 0) return data.computedLines[0].currency;
    return "ILS";
  }, [data]);

  const selectedTotal = useMemo(() => {
    if (!data) return 0;
    // Sum via integer-cents so the footer total matches what the server stores.
    const entryAmounts = data.entries
      .filter((e) => selectedEntryIds.has(e.id))
      .map((e) => entryAmount(e));
    const computedAmounts = data.computedLines
      .filter((l) => selectedComputed.has(computedKey(l)))
      .map((l) => l.amount);
    return sumMoney([...entryAmounts, ...computedAmounts]);
  }, [data, selectedEntryIds, selectedComputed]);

  const selectionCount = selectedEntryIds.size + selectedComputed.size;
  const nothingSelected = selectionCount === 0;

  const handleIssue = async () => {
    if (!data || nothingSelected || issuing) return;
    setIssuing(true);
    try {
      const computedLines = data.computedLines
        .filter((l) => selectedComputed.has(computedKey(l)))
        .map((l) => ({
          sourceType: l.sourceType,
          periodMonth: l.periodMonth,
          label: l.label,
          amount: l.amount,
        }));

      const response = await fetch("/api/charge-documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          // TODO: use the user's preferred PDF template; the document's template is only a default — the PDF export tab can still re-pick.
          pdfTemplate: "modern",
          timeEntryIds: Array.from(selectedEntryIds),
          computedLines,
        }),
      });
      const json = await response.json();

      if (json.success) {
        showSuccessToast(t("billable.issuedToast", { number: json.data.docNumber }));
        setSelectedEntryIds(new Set());
        setSelectedComputed(new Set());
        onIssued?.(json.data.id);
        // Re-fetch so the just-billed entries drop off the list (a second issue would 409).
        reloadBillable();
      } else {
        showErrorToast(json.message || t("billable.issueError"));
      }
    } catch (error) {
      console.error("Error issuing charge document:", error);
      showErrorToast(t("billable.issueError"));
    } finally {
      setIssuing(false);
    }
  };

  const hasItems =
    !!data && (data.entries.length > 0 || data.computedLines.length > 0);

  return (
    <div className="pb-28">
      {/* Top controls */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div>
          <label className="block text-sm font-medium mb-2 text-muted-foreground">
            {t("billable.clientLabel")}
          </label>
          <Select
            dir={locale === "he" ? "rtl" : "ltr"}
            value={clientId}
            onValueChange={setClientId}
            disabled={clientsLoading}
          >
            <SelectTrigger className="min-h-[44px] text-start">
              <SelectValue
                placeholder={clientsLoading ? t("billable.clientLoading") : t("billable.clientPlaceholder")}
              />
            </SelectTrigger>
            <SelectContent>
              {clients.map((client) => (
                <SelectItem key={client.id} value={client.id}>
                  {client.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2 text-muted-foreground">
            {t("billable.monthLabel")}
          </label>
          <MonthField
            className="w-full"
            locale={locale}
            ariaLabel={t("billable.monthLabel")}
            value={periodMonth}
            onChange={setPeriodMonth}
          />
        </div>
      </div>

      {/* States */}
      {!clientId && (
        <div className="rounded-[var(--radius-card)] border border-border bg-card">
          <EmptyState icon={Users} message={t("billable.pickClientPrompt")} />
        </div>
      )}

      {clientId && state === "loading" && <BillableSkeleton />}

      {clientId && state === "error" && (
        <div className="rounded-[var(--radius-card)] border border-destructive/40 bg-destructive/10 p-6 text-center">
          <p className="text-destructive mb-4">{t("billable.loadError")}</p>
          <Button variant="outline" onClick={reloadBillable} className="min-h-[44px]">
            {t("actions.retry")}
          </Button>
        </div>
      )}

      {clientId && state === "ready" && !hasItems && (
        <div className="rounded-[var(--radius-card)] border border-border bg-card">
          <EmptyState icon={FileText} message={t("billable.emptyTitle")} description={t("billable.emptyBody")} />
        </div>
      )}

      {clientId && state === "ready" && hasItems && data && (
        <div className="space-y-6">
          {/* Unbilled entries */}
          {data.entries.length > 0 && (
            <div className="rounded-[var(--radius-card)] border border-border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <h3 className="font-semibold">{t("billable.entriesHeading")}</h3>
              </div>
              <ul className="divide-y divide-border">
                {data.entries.map((entry) => {
                  const selected = selectedEntryIds.has(entry.id);
                  const amount = entryAmount(entry);
                  return (
                    <li key={entry.id}>
                      <label className="flex items-start gap-3 p-4 min-h-[44px] cursor-pointer hover:bg-muted/40 transition-colors">
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleEntry(entry.id)}
                          className="mt-1 h-5 w-5 shrink-0 rounded border-border accent-primary"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2 flex-wrap">
                            <span className="text-sm text-muted-foreground tabular-nums">
                              {formatDate(entry.date, undefined, locale)}
                            </span>
                            <span className="text-sm font-medium text-foreground">
                              <bdi>{entry.project_name}</bdi>
                            </span>
                          </div>
                          <p className="text-sm text-foreground mt-0.5">
                            <bdi>{entry.description}</bdi>
                          </p>
                          {entry.notes && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              <bdi>{entry.notes}</bdi>
                            </p>
                          )}
                          <div className="flex items-center gap-2 flex-wrap mt-1 text-xs text-muted-foreground">
                            <span>
                              {entry.billing_kind === "item"
                                ? (entry.unit
                                    ? t("units.itemsWithUnit", { count: entry.quantity ?? 0, unit: entry.unit })
                                    : t("units.items", { count: entry.quantity ?? 0 }))
                                : formatDuration(billedMinutes(entry), locale)}
                            </span>
                            {entry.billing_kind !== "item" &&
                              billedMinutes(entry) !== entry.duration && (
                                <span className="text-[11px]">
                                  {t("billable.actualDuration", { duration: formatDuration(entry.duration, locale) })}
                                </span>
                              )}
                            {entry.rate_label && <span>· <bdi>{entry.rate_label}</bdi></span>}
                            {entry.billing_kind === "item" &&
                              entry.item_ref != null && (
                                <span>· {t("units.ref", { ref: entry.item_ref })}</span>
                              )}
                          </div>
                        </div>
                        <span className="text-sm font-semibold text-foreground tabular-nums whitespace-nowrap">
                          {formatCurrency(amount, entry.currency, locale)}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Computed fixed / retainer lines */}
          {data.computedLines.length > 0 && (
            <div className="rounded-[var(--radius-card)] border border-border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <h3 className="font-semibold">{t("billable.fixedHeading")}</h3>
              </div>
              <ul className="divide-y divide-border">
                {data.computedLines.map((line) => {
                  const key = computedKey(line);
                  const selected = selectedComputed.has(key);
                  return (
                    <li key={key}>
                      <label className="flex items-start gap-3 p-4 min-h-[44px] cursor-pointer hover:bg-muted/40 transition-colors">
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleComputed(key)}
                          className="mt-1 h-5 w-5 shrink-0 rounded border-border accent-primary"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">
                            <bdi>{line.label}</bdi>
                          </p>
                          {line.alreadyBilled && (
                            <span className="inline-block mt-1 rounded-[var(--radius)] bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                              {t("billable.alreadyBilled")}
                            </span>
                          )}
                        </div>
                        <span className="text-sm font-semibold text-foreground tabular-nums whitespace-nowrap">
                          {formatCurrency(line.amount, line.currency, locale)}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Sticky footer */}
      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{t("billable.selectedTotal")}</p>
            <p className="text-lg font-bold text-foreground tabular-nums">
              {formatCurrency(selectedTotal, clientCurrency, locale)}
            </p>
          </div>
          <Button
            onClick={handleIssue}
            disabled={nothingSelected || issuing}
            className="min-h-[44px]"
          >
            {issuing ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                {t("billable.issuing")}
              </span>
            ) : (
              t("billable.issueButton")
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function BillableSkeleton() {
  return (
    <div className="rounded-[var(--radius-card)] border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <Skeleton className="h-5 w-32" />
      </div>
      <ul className="divide-y divide-border">
        {[0, 1, 2, 3].map((i) => (
          <li key={i} className="flex items-start gap-3 p-4">
            <Skeleton className="mt-1 h-5 w-5 shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-56" />
            </div>
            <Skeleton className="h-4 w-16" />
          </li>
        ))}
      </ul>
    </div>
  );
}
