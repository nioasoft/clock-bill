"use client";

import { useTranslations } from "next-intl";
import { useTimer } from "@/contexts/timer-context";
import { ClockFaceMarks } from "@/components/ui/thematic-elements";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function TimerStopModal() {
  const t = useTranslations("Timer");
  const {
    showStopTimerModal,
    elapsedTimes,
    stopTimerTargetId,
    stopTimerDescription,
    setStopTimerDescription,
    stopTimerNotes,
    setStopTimerNotes,
    stopTimerHours,
    setStopTimerHours,
    stopTimerMinutes,
    setStopTimerMinutes,
    stoppingTimer,
    confirmStopTimer,
    cancelStopTimer,
    stopTimerCanComplete,
    stopTimerMarkDone,
    setStopTimerMarkDone,
  } = useTimer();

  // Elapsed for the specific timer being stopped.
  const elapsedTime = (stopTimerTargetId && elapsedTimes[stopTimerTargetId]) || "0:00";

  return (
    <Dialog open={showStopTimerModal} onOpenChange={(open) => { if (!open) cancelStopTimer(); }}>
      <DialogContent showCloseButton={false}>
        <DialogHeader className="relative">
          <ClockFaceMarks
            size={32}
            className="absolute top-0 end-0 opacity-10 text-foreground"
          />
          <DialogTitle className="font-display">{t("stop.title")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current elapsed time */}
          <div className="bg-accent/10 rounded-[var(--radius-card)] border border-accent/20 p-3">
            <p className="text-sm text-muted-foreground mb-1">{t("stop.elapsedLabel")}</p>
            <p className="font-mono text-2xl font-bold text-accent">
              {elapsedTime}
            </p>
          </div>

          {/* Description */}
          <div>
            <label
              htmlFor="stop-description"
              className="block text-sm font-medium text-foreground mb-1"
            >
              {t("stop.descriptionLabel")}
            </label>
            <input
              type="text"
              id="stop-description"
              value={stopTimerDescription}
              onChange={(e) => setStopTimerDescription(e.target.value)}
              placeholder={t("stop.descriptionPlaceholder")}
              className="w-full rounded-[var(--radius)] border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20"
              disabled={stoppingTimer}
            />
          </div>

          {/* Notes — appear in the report */}
          <div>
            <label
              htmlFor="stop-notes"
              className="block text-sm font-medium text-foreground mb-1"
            >
              {t("stop.notesLabel")}
            </label>
            <textarea
              id="stop-notes"
              rows={3}
              value={stopTimerNotes}
              onChange={(e) => setStopTimerNotes(e.target.value)}
              placeholder={t("stop.notesPlaceholder")}
              className="w-full resize-y rounded-[var(--radius)] border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:border-primary focus:ring-2 focus:ring-primary/20"
              disabled={stoppingTimer}
            />
          </div>

          {/* Duration adjustment */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              {t("stop.adjustDuration")}
            </label>
            <div className="flex gap-2 items-center">
              <div className="flex-1">
                <input
                  type="number"
                  min="0"
                  value={stopTimerHours}
                  onChange={(e) => setStopTimerHours(e.target.value)}
                  placeholder="0"
                  className="w-full rounded-[var(--radius)] border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 font-mono"
                  disabled={stoppingTimer}
                />
                <p className="text-xs text-muted-foreground mt-1">{t("stop.hours")}</p>
              </div>
              <span className="text-muted-foreground text-lg">:</span>
              <div className="flex-1">
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={stopTimerMinutes}
                  onChange={(e) => setStopTimerMinutes(e.target.value)}
                  placeholder="00"
                  className="w-full rounded-[var(--radius)] border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 font-mono"
                  disabled={stoppingTimer}
                />
                <p className="text-xs text-muted-foreground mt-1">{t("stop.minutes")}</p>
              </div>
            </div>
          </div>

          {stopTimerCanComplete && (
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={stopTimerMarkDone}
                onChange={(e) => setStopTimerMarkDone(e.target.checked)}
                disabled={stoppingTimer}
                className="h-4 w-4 rounded border-border accent-primary"
              />
              <span className="text-sm text-foreground">{t("stop.markDone")}</span>
            </label>
          )}

          <div className="flex gap-3 justify-end">
            <button
              onClick={cancelStopTimer}
              disabled={stoppingTimer}
              className="px-4 py-2.5 text-sm font-medium text-muted-foreground bg-muted rounded-[var(--radius)] hover:bg-muted/80 disabled:opacity-50 min-h-[44px]"
            >
              {t("stop.cancel")}
            </button>
            <button
              onClick={confirmStopTimer}
              disabled={stoppingTimer}
              className="px-4 py-2.5 text-sm font-medium text-destructive-foreground bg-destructive rounded-[var(--radius)] hover:bg-destructive/90 disabled:opacity-50 min-h-[44px]"
            >
              {stoppingTimer ? t("stop.saving") : t("stop.saveButton")}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
