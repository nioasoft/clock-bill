"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CheckCircle2, FileSpreadsheet, Plus, RefreshCw, ShieldCheck, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SimpleSelect } from "@/components/ui/simple-select";
import { formatCurrency } from "@/lib/currency";
import { showErrorToast, showSuccessToast } from "@/lib/toast";
import {
  makeReconciliationKey,
  parseReconciliationCsv,
  suggestCandidate,
  type ImportedTransaction,
  type ReconciliationCandidate,
} from "@/lib/payment-reconciliation";

type LoadState = "loading" | "ready" | "error";

interface ReviewRow extends ImportedTransaction {
  documentId: string;
}

const today = () => new Date().toISOString().slice(0, 10);

export default function PaymentReconciliationTab() {
  const t = useTranslations("PaymentReconciliation");
  const locale = useLocale() === "en" ? "en" : "he";
  const inputRef = useRef<HTMLInputElement>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [candidates, setCandidates] = useState<ReconciliationCandidate[]>([]);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [batchId, setBatchId] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualAmount, setManualAmount] = useState("");
  const [manualDate, setManualDate] = useState(today);
  const [manualCurrency, setManualCurrency] = useState("ILS");
  const [manualReference, setManualReference] = useState("");

  const loadCandidates = useCallback(async () => {
    setLoadState("loading");
    try {
      const response = await fetch("/api/payment-reconciliation");
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.message);
      setCandidates(json.data.documents as ReconciliationCandidate[]);
      setLoadState("ready");
    } catch {
      setLoadState("error");
    }
  }, []);

  useEffect(() => { void loadCandidates(); }, [loadCandidates]);

  const beginBatch = useCallback(() => {
    const id = typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setBatchId(id);
    setConfirmed(false);
    return id;
  }, []);

  const addTransactions = useCallback((transactions: ImportedTransaction[]) => {
    beginBatch();
    setRows(transactions.map((transaction) => ({
      ...transaction,
      documentId: suggestCandidate(transaction, candidates)?.id ?? "",
    })));
  }, [beginBatch, candidates]);

  const onFile = useCallback(async (file: File | undefined) => {
    if (!file) return;
    try {
      if (file.size > 1_000_000) throw new Error("FILE_TOO_LARGE");
      addTransactions(parseReconciliationCsv(await file.text()));
    } catch (error) {
      const code = error instanceof Error ? error.message.split(":")[0] : "INVALID_FILE";
      showErrorToast(t(`errors.${code}` as never));
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }, [addTransactions, t]);

  const addManual = useCallback(() => {
    const amount = Number(manualAmount);
    if (!Number.isFinite(amount) || amount <= 0 || !manualDate) {
      showErrorToast(t("errors.INVALID_ROW"));
      return;
    }
    const transaction: ImportedTransaction = {
      id: "manual-1",
      amount,
      paidAt: manualDate,
      currency: manualCurrency,
      reference: manualReference,
      description: manualReference,
    };
    addTransactions([transaction]);
    setManualOpen(false);
    setManualAmount("");
    setManualReference("");
  }, [addTransactions, manualAmount, manualCurrency, manualDate, manualReference, t]);

  const selectedRows = useMemo(() => rows.filter((row) => row.documentId), [rows]);
  const canSubmit = selectedRows.length > 0 && selectedRows.length === rows.length && confirmed && !submitting;

  const apply = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const response = await fetch("/api/payment-reconciliation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmed: true,
          matches: selectedRows.map((row) => ({
            documentId: row.documentId,
            amount: row.amount,
            paidAt: row.paidAt,
            method: "bank_transfer",
            note: row.reference || row.description || null,
            reconciliationKey: makeReconciliationKey(batchId, row.id, row.documentId),
          })),
        }),
      });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.message);
      showSuccessToast(t("success", { count: json.data.applied }));
      setRows([]);
      setConfirmed(false);
      await loadCandidates();
    } catch (error) {
      showErrorToast(error instanceof Error && error.message ? error.message : t("saveError"));
    } finally {
      setSubmitting(false);
    }
  }, [batchId, canSubmit, loadCandidates, selectedRows, t]);

  if (loadState === "loading") {
    return <div className="h-52 animate-pulse rounded-[var(--radius-card)] border border-border bg-card" role="status" aria-label={t("loading")} />;
  }

  if (loadState === "error") {
    return (
      <div className="rounded-[var(--radius-card)] border border-destructive/40 bg-destructive/5 p-6" role="alert">
        <p className="font-semibold text-destructive">{t("loadError")}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t("loadErrorHint")}</p>
        <Button variant="outline" className="mt-4" onClick={() => void loadCandidates()}><RefreshCw className="size-4" />{t("retry")}</Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-card">
        <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <div className="mb-3 inline-flex size-11 items-center justify-center rounded-[var(--radius)] bg-primary/10 text-primary"><ShieldCheck className="size-5" /></div>
            <h2 className="text-xl font-bold text-foreground">{t("title")}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{t("description")}</p>
            <ol className="mt-5 grid gap-2 sm:grid-cols-3" aria-label={t("stepsLabel")}>
              {["import", "review", "confirm"].map((step, index) => (
                <li key={step} className="flex min-h-11 items-center gap-2 rounded-[var(--radius)] bg-muted/60 px-3 text-sm">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-background font-mono text-xs font-bold text-primary"><bdi>{index + 1}</bdi></span>
                  <span>{t(`steps.${step}` as never)}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="rounded-[var(--radius)] border border-border bg-background/60 p-4">
            <p className="font-semibold">{t("privacyTitle")}</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{t("privacyBody")}</p>
          </div>
        </div>
      </section>

      {candidates.length === 0 ? (
        <EmptyState icon={CheckCircle2} message={t("noDocumentsTitle")} description={t("noDocumentsBody")} />
      ) : rows.length === 0 ? (
        <section className="grid gap-4 sm:grid-cols-2">
          <button type="button" onClick={() => inputRef.current?.click()} className="group min-h-44 rounded-[var(--radius-card)] border border-dashed border-border bg-card p-6 text-start transition-colors hover:border-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Upload className="mb-4 size-6 text-primary" />
            <span className="block font-bold text-foreground">{t("uploadTitle")}</span>
            <span className="mt-1 block text-sm leading-6 text-muted-foreground">{t("uploadBody")}</span>
            <span className="mt-3 block text-xs text-muted-foreground">{t("uploadLimits")}</span>
          </button>
          <button type="button" onClick={() => setManualOpen(true)} className="group min-h-44 rounded-[var(--radius-card)] border border-border bg-card p-6 text-start transition-colors hover:border-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Plus className="mb-4 size-6 text-primary" />
            <span className="block font-bold text-foreground">{t("manualTitle")}</span>
            <span className="mt-1 block text-sm leading-6 text-muted-foreground">{t("manualBody")}</span>
          </button>
          <input ref={inputRef} className="sr-only" type="file" accept=".csv,text/csv" onChange={(event) => void onFile(event.target.files?.[0])} />
        </section>
      ) : (
        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div><h2 className="text-lg font-bold">{t("reviewTitle")}</h2><p className="text-sm text-muted-foreground">{t("reviewBody", { count: rows.length })}</p></div>
            <Button variant="outline" onClick={() => { setRows([]); setConfirmed(false); }}><Trash2 className="size-4" />{t("clear")}</Button>
          </div>
          <div className="space-y-3">
            {rows.map((row) => {
              const compatible = candidates.filter((candidate) => candidate.currency === row.currency && candidate.outstanding + 0.005 >= row.amount);
              return (
                <article key={row.id} className="grid gap-4 rounded-[var(--radius-card)] border border-border bg-card p-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,1fr)_44px] lg:items-end">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2"><FileSpreadsheet className="size-4 text-primary" /><bdi className="font-mono font-bold">{formatCurrency(row.amount, row.currency, locale)}</bdi><span className="text-sm text-muted-foreground"><bdi>{row.paidAt}</bdi></span></div>
                    <p className="mt-2 truncate text-sm text-muted-foreground" title={row.reference || row.description}>{row.reference || row.description || t("noReference")}</p>
                  </div>
                  <div>
                    <Label htmlFor={`document-${row.id}`}>{t("documentLabel")}</Label>
                    <SimpleSelect id={`document-${row.id}`} value={row.documentId} onChange={(documentId) => { setConfirmed(false); setRows((current) => current.map((item) => item.id === row.id ? { ...item, documentId } : item)); }} placeholder={compatible.length ? t("chooseDocument") : t("noCompatibleDocument")} options={compatible.map((candidate) => ({ value: candidate.id, label: t("documentOption", { number: candidate.documentNumber, client: candidate.clientName, amount: formatCurrency(candidate.outstanding, candidate.currency, locale) }) }))} />
                  </div>
                  <Button variant="ghost" size="icon" aria-label={t("removeRow")} onClick={() => { setConfirmed(false); setRows((current) => current.filter((item) => item.id !== row.id)); }}><Trash2 className="size-4" /></Button>
                </article>
              );
            })}
          </div>
          <div className="rounded-[var(--radius-card)] border border-primary/30 bg-primary/5 p-5">
            <label className="flex cursor-pointer items-start gap-3">
              <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-0.5 size-5 shrink-0 accent-primary" />
              <span><span className="block font-semibold text-foreground">{t("confirmTitle")}</span><span className="mt-1 block text-sm leading-6 text-muted-foreground">{t("confirmBody", { count: selectedRows.length })}</span></span>
            </label>
            {selectedRows.length !== rows.length && <p className="mt-3 text-sm font-medium text-destructive" role="alert">{t("unmatchedWarning")}</p>}
            <div className="mt-4 flex justify-end"><Button disabled={!canSubmit} onClick={() => void apply()}>{submitting ? t("saving") : t("apply", { count: selectedRows.length })}<CheckCircle2 className="size-4" /></Button></div>
          </div>
        </section>
      )}

      {manualOpen && rows.length === 0 && (
        <section className="rounded-[var(--radius-card)] border border-border bg-card p-5" aria-labelledby="manual-payment-title">
          <h2 id="manual-payment-title" className="font-bold">{t("manualFormTitle")}</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div><Label htmlFor="manual-amount">{t("amount")}</Label><Input id="manual-amount" type="number" min="0.01" step="0.01" value={manualAmount} onChange={(event) => setManualAmount(event.target.value)} /></div>
            <div><Label htmlFor="manual-date">{t("date")}</Label><Input id="manual-date" type="date" value={manualDate} onChange={(event) => setManualDate(event.target.value)} /></div>
            <div><Label htmlFor="manual-currency">{t("currency")}</Label><SimpleSelect id="manual-currency" value={manualCurrency} onChange={setManualCurrency} options={["ILS", "USD", "EUR", "GBP"].map((currency) => ({ value: currency, label: currency }))} /></div>
            <div><Label htmlFor="manual-reference">{t("reference")}</Label><Input id="manual-reference" value={manualReference} maxLength={500} onChange={(event) => setManualReference(event.target.value)} /></div>
          </div>
          <div className="mt-5 flex flex-wrap justify-end gap-2"><Button variant="ghost" onClick={() => setManualOpen(false)}>{t("cancel")}</Button><Button onClick={addManual}>{t("continueToReview")}</Button></div>
        </section>
      )}
    </div>
  );
}
