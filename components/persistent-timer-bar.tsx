"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { useTimer } from "@/contexts/timer-context";
import { Play, Pause, Square, Clock, StickyNote } from "lucide-react";

export function PersistentTimerBar() {
  const t = useTranslations("Timer");
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
  const notesTextareaRef = useRef<HTMLTextAreaElement>(null);

  const openNotesEditor = (id: string, current: string | null) => {
    setNotesEditorId((prev) => (prev === id ? null : id));
    setNotesDraft(current || "");
  };

  // When the editor opens (or switches timers), focus the textarea and put the
  // caret at the END of the existing text so the user can keep writing instead
  // of landing at the start.
  useEffect(() => {
    if (!notesEditorId) return;
    const el = notesTextareaRef.current;
    if (!el) return;
    el.focus();
    const end = el.value.length;
    el.setSelectionRange(end, end);
  }, [notesEditorId]);

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
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
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
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
            <Clock className="h-4 w-4 opacity-60" />
            <span>{t("bar.startTracking")}</span>
          </div>
          <button
            onClick={() => setShowTimerModal(true)}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            <Play className="h-3.5 w-3.5" />
            {t("bar.startTimer")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div aria-live="polite" className="border-b border-border bg-muted/10">
      {/* Mobile: chips stack as full-width rows. sm+: a single horizontally
          scrollable row. */}
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-2 sm:h-16 sm:flex-row sm:items-center sm:overflow-x-auto sm:py-0 sm:px-6 lg:px-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {runningTimers.map((timer) => {
          const isPaused = !!timer.pausedAt;
          const pausing = pausingTimerId === timer.id;
          const resuming = resumingTimerId === timer.id;
          const hasNotes = !!timer.notes;
          const editingNotes = notesEditorId === timer.id;
          return (
            <div
              key={timer.id}
              className={`flex w-full shrink-0 items-center gap-2 sm:w-auto sm:gap-2.5 rounded-full border ps-3 pe-1.5 py-1 ${
                isPaused
                  ? "border-warning/30 bg-warning/5"
                  : "border-running/30 bg-running/5"
              }`}
            >
              {isPaused ? (
                <span className="inline-flex items-center rounded-full bg-warning/20 px-2 py-0.5 text-[10px] font-semibold text-warning">
                  {t("bar.paused")}
                </span>
              ) : (
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-running opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-running" />
                </span>
              )}

              {/* On mobile the chip is full-width, so the description takes the
                  free space and pushes time + actions to the far edge. */}
              <span className="min-w-0 flex-1 sm:flex-none sm:max-w-[10rem] truncate text-sm font-medium text-foreground">
                {timer.description || t("bar.activeTimer")}
              </span>

              <span className="font-mono text-sm font-bold tabular-nums text-foreground">
                {elapsedTimes[timer.id] ?? "0:00"}
              </span>

              {/* Notes toggle — labelled so it's obvious; filled accent when notes exist */}
              <button
                onClick={() => openNotesEditor(timer.id, timer.notes)}
                aria-label={hasNotes ? t("bar.editNotes") : t("bar.addNotes")}
                title={hasNotes ? t("bar.editNotes") : t("bar.addNotes")}
                className={`inline-flex items-center justify-center sm:justify-start gap-1.5 h-8 w-8 sm:w-auto sm:ps-2.5 sm:pe-3 rounded-full text-xs font-semibold transition-all ${
                  hasNotes || editingNotes
                    ? "bg-primary/20 text-primary hover:bg-primary/30"
                    : "bg-muted text-muted-foreground hover:bg-muted/70"
                }`}
              >
                <StickyNote className="h-4 w-4 shrink-0" />
                {/* Label only on sm+ — on mobile the chip must stay narrow enough
                    that the stop button isn't clipped off the screen edge. */}
                <span className="hidden sm:inline">{hasNotes ? t("bar.noteShort") : t("bar.notes")}</span>
              </button>

              {isPaused ? (
                <button
                  onClick={() => handleResumeTimer(timer.id)}
                  disabled={resuming}
                  aria-label={t("bar.resumeTimer")}
                  className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-running/20 text-running hover:bg-running/30 transition-all disabled:opacity-50"
                >
                  <Play className="h-4 w-4" />
                </button>
              ) : (
                <button
                  onClick={() => handlePauseTimer(timer.id)}
                  disabled={pausing}
                  aria-label={t("bar.pauseTimer")}
                  className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-warning/20 text-warning hover:bg-warning/30 transition-all disabled:opacity-50"
                >
                  <Pause className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={() => handleStopTimer(timer.id)}
                aria-label={t("bar.stopTimer")}
                className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-destructive/20 text-destructive hover:bg-destructive/30 transition-all"
              >
                <Square className="h-4 w-4" />
              </button>
            </div>
          );
        })}

        {/* Add another parallel timer. Hidden on mobile — the chip row overflows
            and clips it there, and the global FAB / dashboard button already
            cover "start another timer" on small screens. */}
        <button
          onClick={() => setShowTimerModal(true)}
          aria-label={t("bar.startAnotherTimer")}
          className="hidden sm:inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-all"
        >
          <Play className="h-3.5 w-3.5" />
          {t("bar.anotherTimer")}
        </button>
      </div>

      {/* Inline notes editor for the selected running timer. Saving overwrites the
          previous notes (latest wins); the value is editable any time. */}
      {notesEditorId && (
        <div className="mx-auto w-full max-w-6xl border-t border-border/50 px-4 py-3 sm:px-6 lg:px-8">
          <label htmlFor="running-timer-notes" className="mb-1 block text-xs font-medium text-muted-foreground">
            {t("bar.notesLabel")}
          </label>
          <div className="flex items-start gap-2">
            <textarea
              ref={notesTextareaRef}
              id="running-timer-notes"
              rows={2}
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              placeholder={t("bar.notesPlaceholder")}
              className="flex-1 resize-y rounded-[var(--radius)] border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:border-primary focus:ring-1 focus:ring-primary"
            />
            <div className="flex shrink-0 flex-col gap-2">
              <button
                onClick={() => saveNotes(notesEditorId)}
                disabled={savingNotes}
                className="rounded-[var(--radius)] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 min-h-[40px]"
              >
                {savingNotes ? t("bar.saving") : t("bar.save")}
              </button>
              <button
                onClick={() => setNotesEditorId(null)}
                disabled={savingNotes}
                className="rounded-[var(--radius)] border border-border px-4 py-2 text-sm text-foreground hover:bg-muted disabled:opacity-50 min-h-[40px]"
              >
                {t("bar.cancel")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
