"use client";

import { useTimer } from "@/contexts/timer-context";
import { Play, Pause, Square, Clock } from "lucide-react";

export function PersistentTimerBar() {
  const {
    runningTimer,
    elapsedTime,
    timerLoading,
    pausingTimer,
    resumingTimer,
    setShowTimerModal,
    handlePauseTimer,
    handleResumeTimer,
    handleStopTimer,
  } = useTimer();

  if (timerLoading) return null;

  if (!runningTimer) {
    return (
      <div className="border-b border-border bg-muted/20">
        <div className="flex items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
            <Clock className="h-4 w-4 opacity-60" />
            <span>התחל לעקוב אחרי הזמן שלך</span>
          </div>
          <button
            onClick={() => setShowTimerModal(true)}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-l from-primary to-primary/90 px-4 py-1.5 text-xs font-medium text-white hover:shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            <Play className="h-3.5 w-3.5" />
            התחל טיימר
          </button>
        </div>
      </div>
    );
  }

  const isPaused = !!runningTimer.pausedAt;

  return (
    <div
      aria-live="polite"
      className={`border-b border-border relative ${
        isPaused
          ? "bg-gradient-to-l from-amber-500/8 to-amber-500/5"
          : "bg-gradient-to-l from-emerald-500/8 to-emerald-500/5"
      }`}
    >
      {/* Diagonal stripes for paused state */}
      {isPaused && (
        <div
          className="absolute inset-0 opacity-30 pointer-events-none"
          style={{
            backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(251, 191, 36, 0.05) 10px, rgba(251, 191, 36, 0.05) 20px)"
          }}
          aria-hidden="true"
        />
      )}

      <div className="flex items-center justify-between px-4 py-2.5 sm:px-6 lg:px-8 relative z-10">
        <div className="flex items-center gap-3 min-w-0">
          {isPaused ? (
            <span className="inline-flex items-center rounded-full bg-amber-500/20 px-2.5 py-1 text-[10px] font-semibold text-amber-700 dark:text-amber-400">
              מושהה
            </span>
          ) : (
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-sm" />
            </span>
          )}
          <span className="text-sm font-medium text-foreground truncate">
            {runningTimer.description || "טיימר פעיל"}
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="font-mono text-base font-bold tabular-nums text-foreground">
            {elapsedTime}
          </span>
          {isPaused ? (
            <button
              onClick={handleResumeTimer}
              disabled={resumingTimer}
              aria-label="חדש טיימר"
              className="inline-flex items-center justify-center h-9 w-9 rounded-full bg-emerald-500/20 text-emerald-700 hover:bg-emerald-500/30 hover:scale-105 dark:text-emerald-400 transition-all disabled:opacity-50 disabled:scale-100 animate-pulse"
            >
              <Play className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={handlePauseTimer}
              disabled={pausingTimer}
              aria-label="השהה טיימר"
              className="inline-flex items-center justify-center h-9 w-9 rounded-full bg-amber-500/20 text-amber-700 hover:bg-amber-500/30 hover:scale-105 dark:text-amber-400 transition-all disabled:opacity-50 disabled:scale-100"
            >
              <Pause className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={handleStopTimer}
            aria-label="עצור טיימר"
            className="inline-flex items-center justify-center h-9 w-9 rounded-full bg-destructive/20 text-destructive hover:bg-destructive/30 hover:scale-105 transition-all"
          >
            <Square className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
