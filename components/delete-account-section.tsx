"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/src/i18n/navigation";
import { AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { showErrorToast } from "@/lib/toast";

/**
 * Danger zone — permanently delete the account and all its data.
 * Minimalist trigger on the page; the gravity lives in the dialog, which
 * requires a DOUBLE confirmation (acknowledge checkbox + typed word) because
 * the action is irreversible.
 */
export function DeleteAccountSection() {
  const t = useTranslations("Settings");
  const CONFIRM_WORD = t("danger.confirmWord");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const canDelete = acknowledged && confirmText.trim() === CONFIRM_WORD;

  const reset = () => {
    setConfirmText("");
    setAcknowledged(false);
  };

  const handleDelete = async () => {
    if (!canDelete) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/account", { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        // Account (and session) are gone — send the user out.
        router.push("/login");
        router.refresh();
      } else {
        showErrorToast(data.message || t("danger.deleteError"));
        setDeleting(false);
      }
    } catch (error) {
      console.error("Account deletion failed", error);
      showErrorToast(t("danger.deleteError"));
      setDeleting(false);
    }
  };

  return (
    <>
      {/* Minimalist trigger — understated row, no loud red block on the page. */}
      <div className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">{t("danger.title")}</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {t("danger.subtitle")}
          </p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="shrink-0 rounded-[var(--radius)] border border-destructive/40 px-4 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
        >
          {t("danger.deleteButton")}
        </button>
      </div>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          if (!deleting) {
            setOpen(o);
            reset();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display text-destructive">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              {t("danger.dialogTitle")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Clear, prominent irreversibility warning */}
            <div className="rounded-[var(--radius)] border border-destructive/30 bg-destructive/10 p-3.5">
              <p className="text-sm font-semibold text-destructive">{t("danger.irreversible")}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("danger.warningBody")}
              </p>
            </div>

            {/* First confirmation — acknowledge checkbox */}
            <label className="flex cursor-pointer items-start gap-2.5">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                disabled={deleting}
                className="mt-0.5 h-4 w-4 shrink-0 accent-destructive"
              />
              <span className="text-sm text-foreground">
                {t("danger.acknowledge")}
              </span>
            </label>

            {/* Second confirmation — type the word */}
            <div>
              <label htmlFor="delete-confirm" className="mb-1.5 block text-sm text-muted-foreground">
                {t("danger.typeWordPrefix")}{" "}
                <strong className="text-foreground">{CONFIRM_WORD}</strong>:
              </label>
              <input
                id="delete-confirm"
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={CONFIRM_WORD}
                autoComplete="off"
                className="block w-full rounded-[var(--radius)] border border-border bg-background px-3.5 py-2.5 text-sm text-foreground transition-colors focus:border-destructive focus:outline-none focus:ring-2 focus:ring-destructive/20"
                disabled={deleting}
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setOpen(false);
                  reset();
                }}
                disabled={deleting}
                className="rounded-[var(--radius)] border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
              >
                {t("danger.cancel")}
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting || !canDelete}
                className="rounded-[var(--radius)] bg-destructive px-5 py-2.5 text-sm font-semibold text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {deleting ? t("danger.deleting") : t("danger.deleteForever")}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
