"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/currency";
import {
  PAYMENT_METHODS,
  type PaymentMethod,
} from "@/lib/charge-documents";
import { showSuccessToast, showErrorToast } from "@/lib/toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SimpleSelect } from "@/components/ui/simple-select";

interface PaymentRow {
  id: string;
  amount: number;
  paid_at: string;
  method: PaymentMethod | null;
  note: string | null;
}

interface Summary {
  payments: PaymentRow[];
  gross: number;
  paidSum: number;
  outstanding: number;
  status: "pending" | "partial" | "paid";
}

type State = "loading" | "ready" | "error";

interface Props {
  documentId: string;
  currency: string;
  locale: "he" | "en";
  /** Notify the parent so it refetches the document (status may have changed). */
  onChanged: () => void;
}

export function ChargePaymentsPanel({
  documentId,
  currency,
  locale,
  onChanged,
}: Props) {
  const t = useTranslations("Reports");
  const [state, setState] = useState<State>("loading");
  const [data, setData] = useState<Summary | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const refetch = useCallback(() => setReloadKey((k) => k + 1), []);

  // Inline-edit state: null = add-mode, string = editing payment id
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form fields shared between add and edit modes
  const today = new Date().toISOString().slice(0, 10);
  const [amount, setAmount] = useState("");
  const [paidAt, setPaidAt] = useState(today);
  const [method, setMethod] = useState<PaymentMethod | "">("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      setState("loading");
      try {
        const res = await fetch(`/api/charge-documents/${documentId}/payments`);
        const json = await res.json();
        if (!active) return;
        if (!res.ok || !json.success) {
          setState("error");
          return;
        }
        setData(json.data as Summary);
        setState("ready");
      } catch {
        if (active) setState("error");
      }
    })();
    return () => {
      active = false;
    };
  }, [documentId, reloadKey]);

  // Reset the form to add-mode defaults
  const resetForm = useCallback(() => {
    setEditingId(null);
    setAmount("");
    setPaidAt(today);
    setMethod("");
    setNote("");
  }, [today]);

  // Pre-fill the form for editing an existing payment row
  const editPayment = useCallback((p: PaymentRow) => {
    setEditingId(p.id);
    setAmount(String(p.amount));
    setPaidAt(p.paid_at.slice(0, 10));
    setMethod(p.method ?? "");
    setNote(p.note ?? "");
  }, []);

  const addPayment = useCallback(
    async (overrideAmount?: number) => {
      const amt = overrideAmount ?? Number(amount);
      if (!Number.isFinite(amt) || amt <= 0) {
        showErrorToast(t("payments.invalidAmount"));
        return;
      }
      setBusy(true);
      try {
        const res = await fetch(
          `/api/charge-documents/${documentId}/payments`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              amount: amt,
              paidAt,
              method: method || null,
              note: note || null,
            }),
          }
        );
        const json = await res.json();
        if (!res.ok || !json.success) {
          showErrorToast(json.message ?? t("payments.saveFailed"));
          return;
        }
        showSuccessToast(t("payments.saved"));
        resetForm();
        refetch();
        onChanged();
      } catch {
        showErrorToast(t("payments.saveFailed"));
      } finally {
        setBusy(false);
      }
    },
    [amount, paidAt, method, note, documentId, refetch, onChanged, resetForm, t]
  );

  const saveEdit = useCallback(async () => {
    if (!editingId) return;
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      showErrorToast(t("payments.invalidAmount"));
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(
        `/api/charge-documents/${documentId}/payments/${editingId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: amt,
            paidAt,
            method: method || null,
            note: note || null,
          }),
        }
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        showErrorToast(json.message ?? t("payments.saveFailed"));
        return;
      }
      showSuccessToast(t("payments.saved"));
      resetForm();
      refetch();
      onChanged();
    } catch {
      showErrorToast(t("payments.saveFailed"));
    } finally {
      setBusy(false);
    }
  }, [editingId, amount, paidAt, method, note, documentId, refetch, onChanged, resetForm, t]);

  const deletePayment = useCallback(
    async (paymentId: string) => {
      setBusy(true);
      try {
        const res = await fetch(
          `/api/charge-documents/${documentId}/payments/${paymentId}`,
          { method: "DELETE" }
        );
        const json = await res.json();
        if (!res.ok || !json.success) {
          showErrorToast(json.message ?? t("payments.deleteFailed"));
          return;
        }
        showSuccessToast(t("payments.deleted"));
        refetch();
        onChanged();
      } catch {
        showErrorToast(t("payments.deleteFailed"));
      } finally {
        setBusy(false);
      }
    },
    [documentId, refetch, onChanged, t]
  );

  // Translate a payment method value to a display label
  const methodLabel = (m: PaymentMethod | null) =>
    m ? t(`payments.method.${m}`) : "—";

  // Loading state
  if (state === "loading") {
    return (
      <div className="rounded-[var(--radius-card)] border border-border bg-card p-4" role="status" aria-live="polite">
        <div className="h-5 w-32 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  // Error state
  if (state === "error" || !data) {
    return (
      <div className="rounded-[var(--radius-card)] border border-border bg-card p-4" role="alert">
        <p className="text-sm text-destructive">{t("payments.loadError")}</p>
        <Button
          variant="outline"
          onClick={refetch}
          className="mt-2 min-h-[44px]"
        >
          {t("actions.retry")}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-[var(--radius-card)] border border-border bg-card p-4">
      {/* Header: panel title + outstanding amount */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">
          {t("payments.title")}
        </h3>
        <div className="text-end">
          <div className="text-xs text-muted-foreground">
            {t("payments.outstanding")}
          </div>
          <div className="font-mono text-lg font-bold tabular-nums text-foreground">
            <bdi>{formatCurrency(data.outstanding, currency, locale)}</bdi>
          </div>
        </div>
      </div>

      {/* One-click full-payment shortcut (only in add-mode) */}
      {data.outstanding > 0 && editingId === null && (
        <Button
          onClick={() => void addPayment(data.outstanding)}
          disabled={busy}
          aria-busy={busy}
        >
          {t("payments.markFullyPaid")}
        </Button>
      )}

      {/* Add / edit payment form */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="payment-amount">{t("payments.amount")}</Label>
          <Input
            id="payment-amount"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={t("payments.amount")}
          />
        </div>
        <div>
          <Label htmlFor="payment-date">{t("payments.date")}</Label>
          <Input id="payment-date" type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="payment-method">{t("payments.methodLabel")}</Label>
          <SimpleSelect
            id="payment-method"
            value={method}
            onChange={(value) => setMethod(value as PaymentMethod | "")}
            options={[
              { value: "", label: t("payments.methodNone") },
              ...PAYMENT_METHODS.map((value) => ({ value, label: t(`payments.method.${value}`) })),
            ]}
          />
        </div>
        <div>
          <Label htmlFor="payment-note">{t("payments.note")}</Label>
          <Input id="payment-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("payments.note")} />
        </div>
      </div>

      {/* Primary form action */}
      <div className="flex gap-2">
        {editingId !== null ? (
          <>
            <Button
              variant="outline"
              onClick={() => void saveEdit()}
              disabled={busy}
              className="min-h-[44px]"
            >
              {t("payments.saveEdit")}
            </Button>
            <Button
              variant="ghost"
              onClick={resetForm}
              disabled={busy}
              className="min-h-[44px]"
            >
              {t("payments.cancelEdit")}
            </Button>
          </>
        ) : (
          <Button
            variant="outline"
            onClick={() => void addPayment()}
            disabled={busy}
            className="min-h-[44px]"
          >
            {t("payments.add")}
          </Button>
        )}
      </div>

      {/* Payment list */}
      {data.payments.length === 0 ? (
        <p className="rounded-[var(--radius)] bg-muted/30 p-3 text-sm text-muted-foreground">{t("payments.empty")}</p>
      ) : (
        <ul className="divide-y divide-border">
          {data.payments.map((p) => (
            <li
              key={p.id}
              className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <span className="font-mono tabular-nums text-foreground">
                  <bdi>{formatCurrency(p.amount, currency, locale)}</bdi>
                </span>
                <span className="ms-2 text-xs text-muted-foreground">
                  {new Date(p.paid_at).toLocaleDateString(
                    locale === "he" ? "he-IL" : "en-US"
                  )}{" "}
                  · {methodLabel(p.method)}
                  {p.note ? ` · ${p.note}` : ""}
                </span>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() => editPayment(p)}
                  className="min-h-[44px]"
                >
                  {t("actions.edit")}
                </Button>
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() => void deletePayment(p.id)}
                  className="min-h-[44px] text-destructive hover:text-destructive"
                >
                  {t("actions.delete")}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
