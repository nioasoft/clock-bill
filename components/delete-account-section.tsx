"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { showErrorToast } from "@/lib/toast";

const CONFIRM_WORD = "מחיקה";

/**
 * Danger zone — permanently delete the account and all its data.
 * Requires typing a confirmation word; the action is irreversible.
 */
export function DeleteAccountSection() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (confirmText.trim() !== CONFIRM_WORD) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/account", { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        // Account (and session) are gone — send the user out.
        router.push("/login");
        router.refresh();
      } else {
        showErrorToast(data.message || "שגיאה במחיקת החשבון");
        setDeleting(false);
      }
    } catch (error) {
      console.error("Account deletion failed", error);
      showErrorToast("שגיאה במחיקת החשבון");
      setDeleting(false);
    }
  };

  return (
    <div className="rounded-[var(--radius-card)] border border-destructive/30 bg-destructive/5 p-6">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
        <div className="flex-1">
          <h3 className="font-display text-lg font-semibold text-foreground">מחיקת חשבון</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            מחיקת החשבון תסיר לצמיתות את כל הלקוחות, הפרויקטים, רשומות הזמן והדוחות שלך. הפעולה
            אינה הפיכה. מומלץ לייצא את הנתונים שלך תחילה.
          </p>
          <button
            onClick={() => setOpen(true)}
            className="mt-4 rounded-[var(--radius)] border border-destructive/40 px-4 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
          >
            מחק את החשבון שלי
          </button>
        </div>
      </div>

      <Dialog open={open} onOpenChange={(o) => { if (!deleting) { setOpen(o); setConfirmText(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display text-destructive">מחיקת חשבון לצמיתות</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              פעולה זו תמחק את חשבונך ואת <strong className="text-foreground">כל</strong> הנתונים שלך
              ללא אפשרות שחזור. כדי לאשר, הקלד את המילה{" "}
              <strong className="text-foreground">{CONFIRM_WORD}</strong> בתיבה למטה.
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={CONFIRM_WORD}
              className="block w-full rounded-[var(--radius)] border border-border bg-background px-3.5 py-2.5 text-sm text-foreground transition-colors focus:border-destructive focus:outline-none focus:ring-2 focus:ring-destructive/20"
              disabled={deleting}
              autoFocus
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => { setOpen(false); setConfirmText(""); }}
                disabled={deleting}
                className="rounded-[var(--radius)] border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
              >
                ביטול
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting || confirmText.trim() !== CONFIRM_WORD}
                className="rounded-[var(--radius)] bg-destructive px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-destructive/90 disabled:opacity-40"
              >
                {deleting ? "מוחק..." : "מחק לצמיתות"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
