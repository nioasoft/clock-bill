"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useTimer } from "@/contexts/timer-context";
import { showErrorToast } from "@/lib/toast";
import { positionBetween } from "@/lib/tasks-order";
import { moveEffect } from "@/lib/tasks-move";
import type { TaskRecord, TaskStatus } from "@/lib/tasks-types";

export interface BoardState {
  loading: boolean;
  error: boolean;
  tasks: TaskRecord[];
}

export interface UseTasksBoardReturn {
  state: BoardState;
  load: () => Promise<void>;
  byStatus: (status: TaskStatus) => TaskRecord[];
  /** Move a task to a new status (append to end of target column), applying the
   *  same timer side-effects as a desktop drag. */
  moveTask: (taskId: string, toStatus: TaskStatus) => Promise<void>;
}

/** Shared task board data + timer-aware status moves. Consumed by both the
 *  desktop Kanban and the mobile list so side-effects stay identical. */
export function useTasksBoard(): UseTasksBoardReturn {
  const tToasts = useTranslations("Tasks.toasts");
  const { refreshTimer, runningTimerForTask, handleStopTimer, onTimerStopped, onTimerStarted } = useTimer();
  const [state, setState] = useState<BoardState>({ loading: true, error: false, tasks: [] });
  // Pending unsubscribe for an in-flight "drag/move out of in_progress → stop
  // timer" subscription, so a new move can replace a lingering (cancelled) one.
  const pendingStopUnsubRef = useRef<(() => void) | null>(null);
  // Monotonic load id — the last-INITIATED load wins. Without this, a stale
  // refetch (e.g. the global onTimerStopped→load fired before persistMove) can
  // resolve last and clobber the fresh post-move state, stranding the card.
  const loadSeqRef = useRef(0);

  const load = useCallback(async () => {
    const seq = ++loadSeqRef.current;
    setState((s) => ({ ...s, loading: true, error: false }));
    try {
      const res = await fetch("/api/tasks");
      const data = await res.json();
      if (seq !== loadSeqRef.current) return; // a newer load started — ignore this one
      if (data.success) setState({ loading: false, error: false, tasks: data.tasks });
      else setState((s) => ({ ...s, loading: false, error: true }));
    } catch {
      if (seq !== loadSeqRef.current) return;
      setState((s) => ({ ...s, loading: false, error: true }));
    }
  }, []);

  // Initial board fetch. `load` sets state synchronously on resolve; that's the
  // intended one-time data load, not a render-driven cascade.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);
  useEffect(() => onTimerStopped(() => load()), [onTimerStopped, load]);
  useEffect(() => onTimerStarted(() => load()), [onTimerStarted, load]);

  const byStatus = useCallback(
    (status: TaskStatus) =>
      state.tasks.filter((t) => t.status === status).sort((a, b) => a.position - b.position),
    [state.tasks]
  );

  const persistMove = useCallback(async (taskId: string, status: TaskStatus, position: number) => {
    const res = await fetch(`/api/tasks/${taskId}/move`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, position }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message || "move failed");
    return data.entryId as string | null;
  }, []);

  const moveTask = useCallback(async (taskId: string, targetStatus: TaskStatus) => {
    const task = state.tasks.find((t) => t.id === taskId);
    if (!task) return;
    if (task.status === targetStatus) return;

    const column = byStatus(targetStatus).filter((t) => t.id !== task.id);
    const last = column[column.length - 1]?.position ?? null;
    const position = positionBetween(last, null);

    const effect = moveEffect({
      from: task.status,
      to: targetStatus,
      hasRunningTimer: Boolean(runningTimerForTask(task.id)),
    });

    if (effect === "open_stop_modal") {
      const entryId = runningTimerForTask(task.id);
      if (entryId) {
        if (pendingStopUnsubRef.current) {
          pendingStopUnsubRef.current();
          pendingStopUnsubRef.current = null;
        }
        const unsub = onTimerStopped(async (stoppedId) => {
          // onTimerStopped is a global broadcast — only act when OUR entry is
          // the one that stopped (ignores unrelated/lingering stops).
          if (stoppedId !== entryId) return;
          unsub();
          pendingStopUnsubRef.current = null;
          // Move the card the instant the timer stops (same optimistic shape as
          // the non-modal path below); persist + reload then reconcile.
          setState((s) => ({
            ...s,
            tasks: s.tasks.map((t) => (t.id === task.id ? { ...t, status: targetStatus, position } : t)),
          }));
          try { await persistMove(task.id, targetStatus, position); await load(); }
          catch { showErrorToast(tToasts("moveError")); await load(); }
        });
        pendingStopUnsubRef.current = unsub;
        handleStopTimer(entryId, { managed: true });
      }
      return;
    }

    setState((s) => ({
      ...s,
      tasks: s.tasks.map((t) => (t.id === task.id ? { ...t, status: targetStatus, position } : t)),
    }));
    try {
      await persistMove(task.id, targetStatus, position);
      if (effect === "start_timer") await refreshTimer();
      await load();
    } catch {
      showErrorToast(tToasts("moveError"));
      await load();
    }
  }, [state.tasks, byStatus, runningTimerForTask, persistMove, load, refreshTimer, handleStopTimer, onTimerStopped, tToasts]);

  return { state, load, byStatus, moveTask };
}
