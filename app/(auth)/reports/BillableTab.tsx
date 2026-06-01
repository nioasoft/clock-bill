"use client";

import { useEffect, useMemo, useState } from "react";
import { showSuccessToast, showErrorToast } from "@/lib/toast";
import { formatDuration } from "@/lib/format";
import { formatCurrency } from "@/lib/currency";
import { calcHourlyAmount, calcItemAmount, sumMoney } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
  item_ref: number | null;
  project_name: string;
  currency: string;
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

/**
 * Per-entry billed amount, rounded to whole cents to match what the server
 * stores: item = quantity × rate, hourly = (minutes/60) × rate.
 */
function entryAmount(entry: BillableEntryRow): number {
  if (entry.billing_kind === "item") {
    return calcItemAmount(entry.quantity, entry.rate);
  }
  return calcHourlyAmount(entry.duration, entry.rate);
}

export default function BillableTab({ onIssued }: { onIssued?: () => void }) {
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
        showSuccessToast(`תעודה #${json.data.docNumber} נוצרה`);
        setSelectedEntryIds(new Set());
        setSelectedComputed(new Set());
        onIssued?.();
        // Re-fetch so the just-billed entries drop off the list (a second issue would 409).
        reloadBillable();
      } else {
        showErrorToast(json.message || "שגיאה ביצירת התעודה");
      }
    } catch (error) {
      console.error("Error issuing charge document:", error);
      showErrorToast("שגיאה ביצירת התעודה");
    } finally {
      setIssuing(false);
    }
  };

  const hasItems =
    !!data && (data.entries.length > 0 || data.computedLines.length > 0);

  return (
    <div className="pb-28">
      {/* Top controls */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-6">
        <div>
          <label className="block text-sm font-medium mb-2 text-muted-foreground">
            לקוח
          </label>
          <Select
            value={clientId}
            onValueChange={setClientId}
            disabled={clientsLoading}
          >
            <SelectTrigger className="min-h-[44px]">
              <SelectValue
                placeholder={clientsLoading ? "טוען לקוחות..." : "בחר לקוח"}
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
            חודש חיוב
          </label>
          <input
            type="month"
            value={periodMonth}
            onChange={(e) => setPeriodMonth(e.target.value)}
            className="flex h-10 min-h-[44px] w-full items-center rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary tabular-nums"
          />
        </div>
      </div>

      {/* States */}
      {!clientId && (
        <div className="rounded-[var(--radius-card)] border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">בחר לקוח כדי לראות פריטים לחיוב.</p>
        </div>
      )}

      {clientId && state === "loading" && <BillableSkeleton />}

      {clientId && state === "error" && (
        <div className="rounded-[var(--radius-card)] border border-destructive/40 bg-destructive/10 p-6 text-center">
          <p className="text-destructive mb-4">שגיאה בטעינת פריטים לחיוב.</p>
          <Button variant="outline" onClick={reloadBillable} className="min-h-[44px]">
            נסה שוב
          </Button>
        </div>
      )}

      {clientId && state === "ready" && !hasItems && (
        <div className="rounded-[var(--radius-card)] border border-border bg-card p-8 text-center">
          <p className="text-foreground text-lg mb-1">אין פריטים לחיוב ללקוח הזה 🎉</p>
          <p className="text-muted-foreground text-sm">
            כל הרשומות והחיובים הקבועים כבר טופלו או שאין כאלה לחודש שנבחר.
          </p>
        </div>
      )}

      {clientId && state === "ready" && hasItems && data && (
        <div className="space-y-6">
          {/* Unbilled entries */}
          {data.entries.length > 0 && (
            <div className="rounded-[var(--radius-card)] border border-border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <h3 className="font-semibold">רשומות לחיוב</h3>
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
                              {new Date(entry.date).toLocaleDateString("he-IL")}
                            </span>
                            <span className="text-sm font-medium text-foreground">
                              {entry.project_name}
                            </span>
                          </div>
                          <p className="text-sm text-foreground mt-0.5">
                            {entry.description}
                          </p>
                          {entry.notes && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {entry.notes}
                            </p>
                          )}
                          <div className="flex items-center gap-2 flex-wrap mt-1 text-xs text-muted-foreground">
                            <span>
                              {entry.billing_kind === "item"
                                ? `${entry.quantity ?? 0} יח׳`
                                : formatDuration(entry.duration)}
                            </span>
                            {entry.rate_label && <span>· {entry.rate_label}</span>}
                            {entry.billing_kind === "item" &&
                              entry.item_ref != null && (
                                <span>· אסמכתא {entry.item_ref}</span>
                              )}
                          </div>
                        </div>
                        <span className="text-sm font-semibold text-foreground tabular-nums whitespace-nowrap">
                          {formatCurrency(amount, entry.currency)}
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
                <h3 className="font-semibold">חיובים קבועים</h3>
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
                            {line.label}
                          </p>
                          {line.alreadyBilled && (
                            <span className="inline-block mt-1 rounded-[var(--radius)] bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                              כבר חויב החודש
                            </span>
                          )}
                        </div>
                        <span className="text-sm font-semibold text-foreground tabular-nums whitespace-nowrap">
                          {formatCurrency(line.amount, line.currency)}
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
            <p className="text-xs text-muted-foreground">סה״כ נבחר</p>
            <p className="text-lg font-bold text-foreground tabular-nums">
              {formatCurrency(selectedTotal, clientCurrency)}
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
                מפיק...
              </span>
            ) : (
              "הפק תעודת התחשבנות"
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
