"use client";

import { useTimer } from "@/contexts/timer-context";
import { Play, Pause, Square, Timer } from "lucide-react";

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

  // State 1: No timer running - show CTA
  if (!runningTimer) {
    return (
      <div className="border-b border-border bg-muted/30">
        <div className="flex items-center justify-between px-4 py-2 sm:px-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Timer className="h-4 w-4" />
            <span>אין טיימר פעיל</span>
          </div>
          <button
            onClick={() => setShowTimerModal(true)}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary/90 transition-colors"
          >
            <Play className="h-3 w-3" />
            התחל טיימר
          </button>
        </div>
      </div>
    );
  }

  const isPaused = !!runningTimer.pausedAt;

  // State 2/3: Timer running or paused
  return (
    <div
      className={`border-b border-border ${
        isPaused ? "bg-amber-500/10" : "bg-emerald-500/10"
      }`}
    >
      <div className="flex items-center justify-between px-4 py-2 sm:px-6">
        {/* Left: Project info + status */}
        <div className="flex items-center gap-3 min-w-0">
          {/* Pulsing dot or paused badge */}
          {isPaused ? (
            <span className="inline-flex items-center rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400">
              מושהה
            </span>
          ) : (
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>
          )}

          {/* Project name / description */}
          <span className="text-sm font-medium text-foreground truncate">
            {runningTimer.description || "טיימר פעיל"}
          </span>
        </div>

        {/* Right: Timer + controls */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Elapsed time */}
          <span className="font-mono text-sm font-bold tabular-nums text-foreground">
            {elapsedTime}
          </span>

          {/* Pause/Resume */}
          {isPaused ? (
            <button
              onClick={handleResumeTimer}
              disabled={resumingTimer}
              className="inline-flex items-center justify-center h-8 w-8 rounded-md bg-emerald-500/20 text-emerald-700 hover:bg-emerald-500/30 dark:text-emerald-400 transition-colors disabled:opacity-50"
              title="חדש טיימר"
            >
              <Play className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={handlePauseTimer}
              disabled={pausingTimer}
              className="inline-flex items-center justify-center h-8 w-8 rounded-md bg-amber-500/20 text-amber-700 hover:bg-amber-500/30 dark:text-amber-400 transition-colors disabled:opacity-50"
              title="השהה טיימר"
            >
              <Pause className="h-4 w-4" />
            </button>
          )}

          {/* Stop */}
          <button
            onClick={handleStopTimer}
            className="inline-flex items-center justify-center h-8 w-8 rounded-md bg-destructive/20 text-destructive hover:bg-destructive/30 transition-colors"
            title="עצור טיימר"
          >
            <Square className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
