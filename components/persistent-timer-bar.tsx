"use client";

import { useState } from "react";
import { useTimer } from "@/contexts/timer-context";
import { Play, Pause, Square, Clock, StickyNote } from "lucide-react";

export function PersistentTimerBar() {
  const {
    runningTimers,
    elapsedTimes,
    timerLoading,
    pausingTimerId,
    resumingTimerId,
    setShowTimerModal,
    handlePauseTimer,
    handleResumeTimer,
    handleStopTimer,
    handleUpdateTimerNotes,
  } = useTimer();

  // Which running timer's notes editor is open, and its draft text.
  const [notesEditorId, setNotesEditorId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  const openNotesEditor = (id: string, current: string | null) => {
    setNotesEditorId((prev) => (prev === id ? null : id));
    setNotesDraft(current || "");
  };

  const saveNotes = async (id: string) => {
    setSavingNotes(true);
    const ok = await handleUpdateTimerNotes(id, notesDraft);
    setSavingNotes(false);
    if (ok) setNotesEditorId(null);
  };

  if (timerLoading) {
    // Height-matched skeleton (not null) so the bar reserves its space and the
    // active-timer state doesn't pop in with a layout shift.
    return (
      <div className="border-b border-border bg-muted/20" aria-hidden="true">
        <div className="flex items-center justify-between px-4 py-2.5 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 min-w-0">
            <span className="h-2.5 w-2.5 rounded-full bg-muted animate-pulse" />
            <span className="h-4 w-32 rounded bg-muted animate-pulse" />
          </div>
          <div className="flex items-center gap-3">
            <span className="h-5 w-14 rounded bg-muted animate-pulse" />
            <span className="h-9 w-9 rounded-full bg-muted animate-pulse" />
            <span className="h-9 w-9 rounded-full bg-muted animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (runningTimers.length === 0) {
    return (
      <div className="border-b border-border bg-muted/20">
        <div className="flex items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
            <Clock className="h-4 w-4 opacity-60" />
            <span>התחל לעקוב אחרי הזמן שלך</span>
          </div>
          <button
            onClick={() => setShowTimerModal(true)}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            <Play className="h-3.5 w-3.5" />
            התחל טיימר
          </button>
        </div>
      </div>
    );
  }

  return (
    <div aria-live="polite" className="border-b border-border bg-muted/10">
      {/* Horizontally scrollable row of running-timer chips. */}
      <div className="flex items-center gap-2 overflow-x-auto px-4 py-2 sm:px-6 lg:px-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {runningTimers.map((timer) => {
          const isPaused = !!timer.pausedAt;
          const pausing = pausingTimerId === timer.id;
          const resuming = resumingTimerId === timer.id;
          const hasNotes = !!timer.notes;
          const editingNotes = notesEditorId === timer.id;
          return (
            <div
              key={timer.id}
              className={`flex shrink-0 items-center gap-2.5 rounded-full border ps-3 pe-1.5 py-1 ${
                isPaused
                  ? "border-amber-500/30 bg-amber-500/5"
                  : "border-emerald-500/30 bg-emerald-500/5"
              }`}
            >
              {isPaused ? (
                <span className="inline-flex items-center rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
                  מושהה
                </span>
              ) : (
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                </span>
              )}

              <span className="max-w-[10rem] truncate text-sm font-medium text-foreground">
                {timer.description || "טיימר פעיל"}
              </span>

              <span className="font-mono text-sm font-bold tabular-nums text-foreground">
                {elapsedTimes[timer.id] ?? "0:00"}
              </span>

              {/* Notes toggle — filled accent when notes exist */}
              <button
                onClick={() => openNotesEditor(timer.id, timer.notes)}
                aria-label={hasNotes ? "ערוך הערות" : "הוסף הערות"}
                title={hasNotes ? "ערוך הערות" : "הוסף הערות"}
                className={`inline-flex items-center justify-center h-8 w-8 rounded-full transition-all ${
                  hasNotes || editingNotes
                    ? "bg-primary/20 text-primary hover:bg-primary/30"
                    : "bg-muted text-muted-foreground hover:bg-muted/70"
                }`}
              >
                <StickyNote className="h-4 w-4" />
              </button>

              {isPaused ? (
                <button
                  onClick={() => handleResumeTimer(timer.id)}
                  disabled={resuming}
                  aria-label="חדש טיימר"
                  className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-all disabled:opacity-50"
                >
                  <Play className="h-4 w-4" />
                </button>
              ) : (
                <button
                  onClick={() => handlePauseTimer(timer.id)}
                  disabled={pausing}
                  aria-label="השהה טיימר"
                  className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-all disabled:opacity-50"
                >
                  <Pause className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={() => handleStopTimer(timer.id)}
                aria-label="עצור טיימר"
                className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-destructive/20 text-destructive hover:bg-destructive/30 transition-all"
              >
                <Square className="h-4 w-4" />
              </button>
            </div>
          );
        })}

        {/* Add another parallel timer */}
        <button
          onClick={() => setShowTimerModal(true)}
          aria-label="התחל טיימר נוסף"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-all"
        >
          <Play className="h-3.5 w-3.5" />
          טיימר נוסף
        </button>
      </div>

      {/* Inline notes editor for the selected running timer. Saving overwrites the
          previous notes (latest wins); the value is editable any time. */}
      {notesEditorId && (
        <div className="border-t border-border/50 px-4 py-3 sm:px-6 lg:px-8">
          <label htmlFor="running-timer-notes" className="mb-1 block text-xs font-medium text-muted-foreground">
            הערות לטיימר (יישמרו על הרשומה ויופיעו בדוח)
          </label>
          <div className="flex items-start gap-2">
            <textarea
              id="running-timer-notes"
              rows={2}
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              placeholder="מה נעשה עד עכשיו? אפשר לעדכן בכל רגע."
              className="flex-1 resize-y rounded-[var(--radius)] border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:border-primary focus:ring-1 focus:ring-primary"
              autoFocus
            />
            <div className="flex shrink-0 flex-col gap-2">
              <button
                onClick={() => saveNotes(notesEditorId)}
                disabled={savingNotes}
                className="rounded-[var(--radius)] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 min-h-[40px]"
              >
                {savingNotes ? "שומר..." : "שמור"}
              </button>
              <button
                onClick={() => setNotesEditorId(null)}
                disabled={savingNotes}
                className="rounded-[var(--radius)] border border-border px-4 py-2 text-sm text-foreground hover:bg-muted disabled:opacity-50 min-h-[40px]"
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
