"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { useNotifications } from "@/hooks/use-notifications";
import { useKeyboardShortcut } from "@/hooks/use-keyboard-shortcut";
import React from "react";
import { showSuccessToast, showErrorToast } from "@/lib/toast";
import { ToastAction, type ToastActionElement } from "@/components/ui/toast";
import { haptic } from "@/lib/haptics";
import { pickDefaultHourlyRate, type ClientRate } from "@/lib/schemas/rates";

interface RunningTimer {
  id: string;
  projectId: string;
  taskId: string | null;
  description: string | null;
  notes: string | null;
  startTime: string;
  pausedAt: string | null;
  elapsedMinutes: number;
  elapsedSeconds: number;
}

interface Project {
  id: string;
  name: string;
  clientId: string;
}

interface TaskOption {
  id: string;
  name: string;
}

interface TimerContextValue {
  /** All currently running timers (multiple allowed), newest first. */
  runningTimers: RunningTimer[];
  /** Live "M:SS" elapsed label per timer id. */
  elapsedTimes: Record<string, string>;
  timerLoading: boolean;
  projects: Project[];
  startingTimer: boolean;
  stoppingTimer: boolean;
  /** Id of the timer currently being paused/resumed (so only its card spins). */
  pausingTimerId: string | null;
  resumingTimerId: string | null;
  showTimerModal: boolean;
  showStopTimerModal: boolean;
  /** Which timer the stop modal is acting on. */
  stopTimerTargetId: string | null;
  selectedProject: string;
  selectedTask: string;
  timerTasks: TaskOption[];
  /** Hourly rates of the selected project's client (for the "תעריף" dropdown). */
  timerRates: ClientRate[];
  selectedRateId: string;
  setSelectedRateId: (id: string) => void;
  timerDescription: string;
  stopTimerDescription: string;
  stopTimerNotes: string;
  stopTimerHours: string;
  stopTimerMinutes: string;
  setShowTimerModal: (show: boolean) => void;
  setShowStopTimerModal: (show: boolean) => void;
  setSelectedProject: (id: string) => void;
  setSelectedTask: (id: string) => void;
  setTimerDescription: (desc: string) => void;
  setStopTimerDescription: (desc: string) => void;
  setStopTimerNotes: (notes: string) => void;
  setStopTimerHours: (hours: string) => void;
  setStopTimerMinutes: (minutes: string) => void;
  handleStartTimer: () => Promise<void>;
  handleStopTimer: (entryId: string) => void;
  confirmStopTimer: () => Promise<void>;
  cancelStopTimer: () => void;
  handlePauseTimer: (entryId: string) => Promise<void>;
  handleResumeTimer: (entryId: string) => Promise<void>;
  /** Save notes on a still-running timer (latest overwrites previous). */
  handleUpdateTimerNotes: (entryId: string, notes: string) => Promise<boolean>;
  refreshTimer: () => Promise<void>;
}

const noop = () => {};
const asyncNoop = async () => {};

const defaultTimerValue: TimerContextValue = {
  runningTimers: [],
  elapsedTimes: {},
  timerLoading: true,
  projects: [],
  startingTimer: false,
  stoppingTimer: false,
  pausingTimerId: null,
  resumingTimerId: null,
  showTimerModal: false,
  showStopTimerModal: false,
  stopTimerTargetId: null,
  selectedProject: "",
  selectedTask: "",
  timerTasks: [],
  timerRates: [],
  selectedRateId: "",
  setSelectedRateId: noop,
  timerDescription: "",
  stopTimerDescription: "",
  stopTimerNotes: "",
  stopTimerHours: "",
  stopTimerMinutes: "",
  setShowTimerModal: noop,
  setShowStopTimerModal: noop,
  setSelectedProject: noop,
  setSelectedTask: noop,
  setTimerDescription: noop,
  setStopTimerDescription: noop,
  setStopTimerNotes: noop,
  setStopTimerHours: noop,
  setStopTimerMinutes: noop,
  handleStartTimer: asyncNoop,
  handleStopTimer: noop,
  confirmStopTimer: asyncNoop,
  cancelStopTimer: noop,
  handlePauseTimer: asyncNoop,
  handleResumeTimer: asyncNoop,
  handleUpdateTimerNotes: async () => false,
  refreshTimer: asyncNoop,
};

const TimerContext = createContext<TimerContextValue>(defaultTimerValue);

export function useTimer(): TimerContextValue {
  return useContext(TimerContext);
}

interface TimerProviderProps {
  children: ReactNode;
}

const PUBLIC_ROUTES = ["/", "/login", "/register", "/forgot-password", "/reset-password"];

/** Live elapsed for a single timer, accounting for ticking since the last API sync. */
function liveElapsed(
  timer: RunningTimer,
  lastApiUpdate: number
): { minutes: number; seconds: number } {
  if (timer.pausedAt) {
    return { minutes: timer.elapsedMinutes, seconds: timer.elapsedSeconds };
  }
  const base = timer.elapsedMinutes * 60 + timer.elapsedSeconds;
  const since = Math.max(0, Math.floor((Date.now() - lastApiUpdate) / 1000));
  const total = base + since;
  return { minutes: Math.floor(total / 60), seconds: total % 60 };
}

function formatElapsed(minutes: number, seconds: number): string {
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function TimerProvider({ children }: TimerProviderProps) {
  const pathname = usePathname();
  const isPublicRoute = PUBLIC_ROUTES.some((route) =>
    route === "/" ? pathname === "/" : pathname.startsWith(route)
  );

  // Auth is derived from API responses (a 401 from /api/timer/running) rather
  // than a separate up-front /api/auth/session fetch — that round-trip used to
  // gate (and delay) the timer load. The timer fetch is now the first call.
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const [runningTimers, setRunningTimers] = useState<RunningTimer[]>([]);
  const [timerLoading, setTimerLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [showTimerModal, setShowTimerModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState("");
  const [selectedTask, setSelectedTask] = useState("");
  const [timerTasks, setTimerTasks] = useState<TaskOption[]>([]);
  const [timerRates, setTimerRates] = useState<ClientRate[]>([]);
  const [selectedRateId, setSelectedRateId] = useState("");
  const [timerDescription, setTimerDescription] = useState("");
  const [startingTimer, setStartingTimer] = useState(false);
  const [stoppingTimer, setStoppingTimer] = useState(false);
  const [pausingTimerId, setPausingTimerId] = useState<string | null>(null);
  const [resumingTimerId, setResumingTimerId] = useState<string | null>(null);
  const [elapsedTimes, setElapsedTimes] = useState<Record<string, string>>({});
  const [lastApiUpdate, setLastApiUpdate] = useState<number>(() => Date.now());
  const [showStopTimerModal, setShowStopTimerModal] = useState(false);
  const [stopTimerTargetId, setStopTimerTargetId] = useState<string | null>(null);
  const [stopTimerDescription, setStopTimerDescription] = useState("");
  const [stopTimerNotes, setStopTimerNotes] = useState("");
  const [stopTimerHours, setStopTimerHours] = useState("");
  const [stopTimerMinutes, setStopTimerMinutes] = useState("");

  // Callback listeners for when a timer stops (e.g. dashboard refreshes stats)
  const onTimerStoppedRef = useRef<Array<() => void>>([]);

  const { checkLongTimer, resetLongTimerNotification } = useNotifications();

  // Fetch all running timers. Self-guards auth: a 401 means "not logged in",
  // handled gracefully. On success we mark the session authenticated so other
  // auth-gated UI (e.g. the keyboard shortcut) enables without a separate fetch.
  const fetchRunningTimer = useCallback(async () => {
    try {
      const response = await fetch("/api/timer/running");
      if (response.status === 401) {
        setIsAuthenticated(false);
        setRunningTimers([]);
        return;
      }
      const data = await response.json();
      setIsAuthenticated(true);
      if (data.success && Array.isArray(data.timers)) {
        setRunningTimers(data.timers);
        setLastApiUpdate(Date.now());
      } else {
        setRunningTimers([]);
      }
    } catch (error) {
      console.error("Error fetching running timers:", error);
    } finally {
      setTimerLoading(false);
    }
  }, []);

  // Initial fetch + polling. Fires immediately on non-public routes — no auth
  // round-trip first. Public routes (login/register) skip it.
  useEffect(() => {
    if (isPublicRoute) {
      setTimerLoading(false);
      return;
    }

    fetchRunningTimer();
    const interval = setInterval(fetchRunningTimer, 30000);
    return () => clearInterval(interval);
  }, [isPublicRoute, fetchRunningTimer]);

  // Fetch projects for start modal — refetch when modal opens to catch newly created projects
  useEffect(() => {
    if (isPublicRoute) return;
    if (!showTimerModal && projects.length > 0) return;

    const fetchProjects = async () => {
      try {
        const response = await fetch("/api/projects");
        const data = await response.json();
        if (data.success) {
          setProjects(data.projects || []);
        }
      } catch (error) {
        console.error("Error fetching projects:", error);
      }
    };

    fetchProjects();
    // `projects.length` is read only as an early-exit guard; depending on it would
    // re-run this effect after it calls setProjects, causing a fetch loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPublicRoute, showTimerModal]);

  // Fetch tasks when project changes (for timer start modal)
  useEffect(() => {
    if (!selectedProject) {
      setTimerTasks([]);
      setSelectedTask("");
      return;
    }
    const fetchTasks = async () => {
      try {
        const response = await fetch(`/api/projects/${selectedProject}/tasks`);
        const data = await response.json();
        if (data.success) {
          // Only show todo/in_progress tasks
          setTimerTasks(
            (data.tasks || [])
              .filter((t: { status: string }) => t.status !== "done")
              .map((t: { id: string; name: string }) => ({ id: t.id, name: t.name }))
          );
        }
      } catch (error) {
        console.error("Error fetching tasks for timer:", error);
      }
    };
    fetchTasks();
  }, [selectedProject]);

  // Fetch the selected project's client hourly rates (for the "תעריף" dropdown)
  // and preselect the default hourly rate. Items are excluded — timers are hourly.
  useEffect(() => {
    if (!selectedProject) {
      setTimerRates([]);
      setSelectedRateId("");
      return;
    }
    const clientId = projects.find((p) => p.id === selectedProject)?.clientId;
    if (!clientId) {
      setTimerRates([]);
      setSelectedRateId("");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/clients/${clientId}/rates`);
        const data = await res.json();
        if (cancelled || !data.success) return;
        const hourly: ClientRate[] = (data.rates || []).filter(
          (r: ClientRate) => r.kind === "hourly"
        );
        setTimerRates(hourly);
        setSelectedRateId(pickDefaultHourlyRate(hourly)?.id ?? "");
      } catch (error) {
        console.error("Error fetching client rates for timer:", error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedProject, projects]);

  // Long timer notification — based on the longest-running (non-paused) timer.
  useEffect(() => {
    const active = runningTimers.filter((t) => !t.pausedAt);
    if (active.length === 0) {
      resetLongTimerNotification();
      return;
    }
    const maxMinutes = Math.max(...active.map((t) => t.elapsedMinutes));
    checkLongTimer(maxMinutes);
  }, [runningTimers, checkLongTimer, resetLongTimerNotification]);

  // Client-side elapsed ticking — one label per running timer.
  useEffect(() => {
    if (runningTimers.length === 0) {
      setElapsedTimes({});
      return;
    }

    const update = () => {
      const next: Record<string, string> = {};
      for (const timer of runningTimers) {
        const { minutes, seconds } = liveElapsed(timer, lastApiUpdate);
        next[timer.id] = formatElapsed(minutes, seconds);
      }
      setElapsedTimes(next);
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [runningTimers, lastApiUpdate]);

  // Browser tab title — driven by the newest running timer; prefix a count when
  // more than one runs in parallel.
  useEffect(() => {
    if (runningTimers.length === 0) return;

    const primary = runningTimers[0];
    const originalTitle = document.title;
    const countPrefix = runningTimers.length > 1 ? `(${runningTimers.length}) ` : "";

    const updateTitle = () => {
      const { minutes, seconds } = liveElapsed(primary, lastApiUpdate);
      document.title = `${countPrefix}${formatElapsed(minutes, seconds)} - ${
        primary.pausedAt ? "מושהה - " : ""
      }מוניט`;
    };

    updateTitle();
    const interval = setInterval(updateTitle, 1000);
    return () => {
      clearInterval(interval);
      document.title = originalTitle;
    };
  }, [runningTimers, lastApiUpdate]);

  const handleStartTimer = useCallback(async () => {
    if (!selectedProject) {
      showErrorToast("נא לבחור פרויקט");
      return;
    }

    setStartingTimer(true);
    try {
      const response = await fetch("/api/timer/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: selectedProject,
          taskId: selectedTask || null,
          description: timerDescription || null,
          rate: timerRates.find((r) => r.id === selectedRateId)?.rate ?? null,
          rateLabel: timerRates.find((r) => r.id === selectedRateId)?.name ?? null,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setShowTimerModal(false);
        setSelectedProject("");
        setSelectedTask("");
        setSelectedRateId("");
        setTimerDescription("");
        haptic("success");
        showSuccessToast("הטיימר הופעל בהצלחה");
        await fetchRunningTimer();
      } else {
        showErrorToast(data.message || "שגיאה בהתחלת הטיימר");
      }
    } catch (error) {
      console.error("Error starting timer:", error);
      showErrorToast("שגיאה בהתחלת הטיימר");
    } finally {
      setStartingTimer(false);
    }
  }, [selectedProject, selectedTask, timerDescription, timerRates, selectedRateId, fetchRunningTimer]);

  const handleStopTimer = useCallback(
    (entryId: string) => {
      const timer = runningTimers.find((t) => t.id === entryId);
      if (!timer) return;

      const totalMinutes = timer.elapsedMinutes;
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;

      setStopTimerTargetId(entryId);
      setStopTimerDescription(timer.description || "");
      setStopTimerNotes("");
      setStopTimerHours(hours.toString());
      setStopTimerMinutes(minutes.toString());
      setShowStopTimerModal(true);
    },
    [runningTimers]
  );

  const confirmStopTimer = useCallback(async () => {
    if (!stopTimerTargetId) return;
    const entryId = stopTimerTargetId;

    setStoppingTimer(true);
    try {
      const hours = parseInt(stopTimerHours) || 0;
      const minutes = parseInt(stopTimerMinutes) || 0;
      const totalDuration = hours * 60 + minutes;

      const response = await fetch("/api/timer/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entryId,
          description: stopTimerDescription || null,
          notes: stopTimerNotes || null,
          duration: totalDuration,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setRunningTimers((prev) => prev.filter((t) => t.id !== entryId));
        setElapsedTimes((prev) => {
          const next = { ...prev };
          delete next[entryId];
          return next;
        });
        setShowStopTimerModal(false);
        setStopTimerTargetId(null);
        haptic("success");
        showSuccessToast(
          "הטיימר נעצר ונשמר בהצלחה",
          React.createElement(
            ToastAction,
            {
              altText: "צפה ברשומות",
              onClick: () => { window.location.href = "/entries"; },
            },
            "צפה ברשומות"
          ) as unknown as ToastActionElement
        );
        // Notify listeners (e.g. dashboard stats refresh)
        onTimerStoppedRef.current.forEach((cb) => cb());
      } else {
        showErrorToast(data.message || "שגיאה בעצירת הטיימר");
      }
    } catch (error) {
      console.error("Error stopping timer:", error);
      showErrorToast("שגיאה בעצירת הטיימר");
    } finally {
      setStoppingTimer(false);
    }
  }, [stopTimerTargetId, stopTimerDescription, stopTimerNotes, stopTimerHours, stopTimerMinutes]);

  const cancelStopTimer = useCallback(() => {
    setShowStopTimerModal(false);
    setStopTimerTargetId(null);
    setStopTimerDescription("");
    setStopTimerNotes("");
    setStopTimerHours("");
    setStopTimerMinutes("");
  }, []);

  const handlePauseTimer = useCallback(
    async (entryId: string) => {
      setPausingTimerId(entryId);
      try {
        const response = await fetch("/api/timer/pause", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entryId }),
        });
        const data = await response.json();

        if (data.success) {
          haptic("light");
          showSuccessToast("הטיימר הושהה בהצלחה");
          await fetchRunningTimer();
        } else {
          showErrorToast(data.message || "שגיאה בהשהיית הטיימר");
        }
      } catch (error) {
        console.error("Error pausing timer:", error);
        showErrorToast("שגיאה בהשהיית הטיימר");
      } finally {
        setPausingTimerId(null);
      }
    },
    [fetchRunningTimer]
  );

  const handleResumeTimer = useCallback(
    async (entryId: string) => {
      setResumingTimerId(entryId);
      try {
        const response = await fetch("/api/timer/resume", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entryId }),
        });
        const data = await response.json();

        if (data.success) {
          haptic("light");
          showSuccessToast("הטיימר חודש בהצלחה");
          await fetchRunningTimer();
        } else {
          showErrorToast(data.message || "שגיאה בחידוש הטיימר");
        }
      } catch (error) {
        console.error("Error resuming timer:", error);
        showErrorToast("שגיאה בחידוש הטיימר");
      } finally {
        setResumingTimerId(null);
      }
    },
    [fetchRunningTimer]
  );

  // Save notes on a running timer mid-work. Optimistically updates the local
  // timer so the edited text sticks between 30s polls; latest write wins.
  const handleUpdateTimerNotes = useCallback(
    async (entryId: string, notes: string): Promise<boolean> => {
      try {
        const response = await fetch("/api/timer/notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entryId, notes: notes || null }),
        });
        const data = await response.json();
        if (data.success) {
          setRunningTimers((prev) =>
            prev.map((t) => (t.id === entryId ? { ...t, notes: notes || null } : t))
          );
          showSuccessToast("ההערות נשמרו");
          return true;
        }
        showErrorToast(data.message || "שגיאה בשמירת ההערות");
        return false;
      } catch (error) {
        console.error("Error updating timer notes:", error);
        showErrorToast("שגיאה בשמירת ההערות");
        return false;
      }
    },
    []
  );

  // Keyboard shortcut: 't' always opens the start modal. With multiple timers,
  // pausing/resuming a specific one is done from that timer's card.
  const handleTimerShortcut = useCallback(() => {
    setShowTimerModal(true);
  }, []);

  useKeyboardShortcut({
    key: "t",
    callback: handleTimerShortcut,
    disabled: !isAuthenticated,
  });

  const refreshTimer = useCallback(async () => {
    await fetchRunningTimer();
  }, [fetchRunningTimer]);

  const value: TimerContextValue = {
    runningTimers,
    elapsedTimes,
    timerLoading,
    projects,
    startingTimer,
    stoppingTimer,
    pausingTimerId,
    resumingTimerId,
    showTimerModal,
    showStopTimerModal,
    stopTimerTargetId,
    selectedProject,
    selectedTask,
    timerTasks,
    timerRates,
    selectedRateId,
    setSelectedRateId,
    timerDescription,
    stopTimerDescription,
    stopTimerNotes,
    stopTimerHours,
    stopTimerMinutes,
    setShowTimerModal,
    setShowStopTimerModal,
    setSelectedProject,
    setSelectedTask,
    setTimerDescription,
    setStopTimerDescription,
    setStopTimerNotes,
    setStopTimerHours,
    setStopTimerMinutes,
    handleStartTimer,
    handleStopTimer,
    confirmStopTimer,
    cancelStopTimer,
    handlePauseTimer,
    handleResumeTimer,
    handleUpdateTimerNotes,
    refreshTimer,
  };

  return (
    <TimerContext.Provider value={value}>{children}</TimerContext.Provider>
  );
}
