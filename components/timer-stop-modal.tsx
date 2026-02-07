"use client";

import { useTimer } from "@/contexts/timer-context";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function TimerStopModal() {
  const {
    showStopTimerModal,
    elapsedTime,
    stopTimerDescription,
    setStopTimerDescription,
    stopTimerHours,
    setStopTimerHours,
    stopTimerMinutes,
    setStopTimerMinutes,
    stoppingTimer,
    confirmStopTimer,
    cancelStopTimer,
  } = useTimer();

  return (
    <Dialog open={showStopTimerModal} onOpenChange={(open) => { if (!open) cancelStopTimer(); }}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="font-display">עצור טיימר ושמור רשומה</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current elapsed time */}
          <div className="bg-primary/10 rounded-lg p-3">
            <p className="text-sm text-muted-foreground mb-1">זמן שעבר:</p>
            <p className="font-mono text-2xl font-bold text-primary">
              {elapsedTime}
            </p>
          </div>

          {/* Description */}
          <div>
            <label
              htmlFor="stop-description"
              className="block text-sm font-medium text-foreground mb-1"
            >
              תיאור
            </label>
            <input
              type="text"
              id="stop-description"
              value={stopTimerDescription}
              onChange={(e) => setStopTimerDescription(e.target.value)}
              placeholder="מה עשית?"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:ring-1 focus:ring-primary"
              disabled={stoppingTimer}
            />
          </div>

          {/* Duration adjustment */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              התאם את משך הזמן (אופציונלי)
            </label>
            <div className="flex gap-2 items-center">
              <div className="flex-1">
                <input
                  type="number"
                  min="0"
                  value={stopTimerHours}
                  onChange={(e) => setStopTimerHours(e.target.value)}
                  placeholder="0"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:ring-1 focus:ring-primary"
                  disabled={stoppingTimer}
                />
                <p className="text-xs text-muted-foreground mt-1">שעות</p>
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
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:ring-1 focus:ring-primary"
                  disabled={stoppingTimer}
                />
                <p className="text-xs text-muted-foreground mt-1">דקות</p>
              </div>
            </div>
          </div>

          <div className="flex gap-3 justify-end">
            <button
              onClick={cancelStopTimer}
              disabled={stoppingTimer}
              className="px-4 py-2 text-sm font-medium text-muted-foreground bg-muted rounded-md hover:bg-muted/80 disabled:opacity-50"
            >
              ביטול
            </button>
            <button
              onClick={confirmStopTimer}
              disabled={stoppingTimer}
              className="px-4 py-2 text-sm font-medium text-white bg-destructive rounded-md hover:bg-destructive/90 disabled:opacity-50"
            >
              {stoppingTimer ? "שומר..." : "עצור ושמור"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
