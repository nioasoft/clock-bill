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

interface RunningTimer {
  id: string;
  projectId: string;
  description: string | null;
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

interface TimerContextValue {
  runningTimer: RunningTimer | null;
  elapsedTime: string;
  timerLoading: boolean;
  projects: Project[];
  startingTimer: boolean;
  stoppingTimer: boolean;
  pausingTimer: boolean;
  resumingTimer: boolean;
  showTimerModal: boolean;
  showStopTimerModal: boolean;
  selectedProject: string;
  timerDescription: string;
  stopTimerDescription: string;
  stopTimerHours: string;
  stopTimerMinutes: string;
  setShowTimerModal: (show: boolean) => void;
  setShowStopTimerModal: (show: boolean) => void;
  setSelectedProject: (id: string) => void;
  setTimerDescription: (desc: string) => void;
  setStopTimerDescription: (desc: string) => void;
  setStopTimerHours: (hours: string) => void;
  setStopTimerMinutes: (minutes: string) => void;
  handleStartTimer: () => Promise<void>;
  handleStopTimer: () => void;
  confirmStopTimer: () => Promise<void>;
  cancelStopTimer: () => void;
  handlePauseTimer: () => Promise<void>;
  handleResumeTimer: () => Promise<void>;
  refreshTimer: () => Promise<void>;
}

const noop = () => {};
const asyncNoop = async () => {};

const defaultTimerValue: TimerContextValue = {
  runningTimer: null,
  elapsedTime: "00:00",
  timerLoading: true,
  projects: [],
  startingTimer: false,
  stoppingTimer: false,
  pausingTimer: false,
  resumingTimer: false,
  showTimerModal: false,
  showStopTimerModal: false,
  selectedProject: "",
  timerDescription: "",
  stopTimerDescription: "",
  stopTimerHours: "",
  stopTimerMinutes: "",
  setShowTimerModal: noop,
  setShowStopTimerModal: noop,
  setSelectedProject: noop,
  setTimerDescription: noop,
  setStopTimerDescription: noop,
  setStopTimerHours: noop,
  setStopTimerMinutes: noop,
  handleStartTimer: asyncNoop,
  handleStopTimer: noop,
  confirmStopTimer: asyncNoop,
  cancelStopTimer: noop,
  handlePauseTimer: asyncNoop,
  handleResumeTimer: asyncNoop,
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

export function TimerProvider({ children }: TimerProviderProps) {
  const pathname = usePathname();
  const isPublicRoute = PUBLIC_ROUTES.some((route) =>
    route === "/" ? pathname === "/" : pathname.startsWith(route)
  );
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  const [runningTimer, setRunningTimer] = useState<RunningTimer | null>(null);
  const [timerLoading, setTimerLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [showTimerModal, setShowTimerModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState("");
  const [timerDescription, setTimerDescription] = useState("");
  const [startingTimer, setStartingTimer] = useState(false);
  const [stoppingTimer, setStoppingTimer] = useState(false);
  const [pausingTimer, setPausingTimer] = useState(false);
  const [resumingTimer, setResumingTimer] = useState(false);
  const [elapsedTime, setElapsedTime] = useState("0:00");
  const [lastApiUpdate, setLastApiUpdate] = useState<Date>(new Date());
  const [showStopTimerModal, setShowStopTimerModal] = useState(false);
  const [stopTimerDescription, setStopTimerDescription] = useState("");
  const [stopTimerHours, setStopTimerHours] = useState("");
  const [stopTimerMinutes, setStopTimerMinutes] = useState("");

  // Callback listeners for when timer stops (e.g. dashboard refreshes stats)
  const onTimerStoppedRef = useRef<Array<() => void>>([]);

  const { checkLongTimer, resetLongTimerNotification } = useNotifications();

  // Check auth once (skip on public routes like login/register)
  useEffect(() => {
    if (isPublicRoute) {
      setIsAuthenticated(false);
      setAuthChecked(true);
      return;
    }
    const checkAuth = async () => {
      try {
        const response = await fetch("/api/auth/session");
        const data = await response.json();
        setIsAuthenticated(data.success && !!data.user);
      } catch {
        setIsAuthenticated(false);
      } finally {
        setAuthChecked(true);
      }
    };
    checkAuth();
  }, [isPublicRoute]);

  // Fetch running timer
  const fetchRunningTimer = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const response = await fetch("/api/timer/running");
      const data = await response.json();
      if (data.success && data.running) {
        setRunningTimer(data.running);
        setLastApiUpdate(new Date());
      } else {
        setRunningTimer(null);
      }
    } catch (error) {
      console.error("Error fetching running timer:", error);
    } finally {
      setTimerLoading(false);
    }
  }, [isAuthenticated]);

  // Initial fetch + polling
  useEffect(() => {
    if (!isAuthenticated) {
      setTimerLoading(false);
      return;
    }

    fetchRunningTimer();
    const interval = setInterval(fetchRunningTimer, 30000);
    return () => clearInterval(interval);
  }, [isAuthenticated, fetchRunningTimer]);

  // Fetch projects for start modal
  useEffect(() => {
    if (!isAuthenticated) return;

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
  }, [isAuthenticated]);

  // Long timer notification check
  useEffect(() => {
    if (runningTimer && !runningTimer.pausedAt) {
      checkLongTimer(runningTimer.elapsedMinutes);
    } else {
      resetLongTimerNotification();
    }
  }, [runningTimer, checkLongTimer, resetLongTimerNotification]);

  // Client-side elapsed time ticking
  useEffect(() => {
    if (!runningTimer) {
      setElapsedTime("0:00");
      return;
    }

    const updateElapsed = () => {
      const baseElapsedSeconds =
        runningTimer.elapsedMinutes * 60 + runningTimer.elapsedSeconds;

      if (runningTimer.pausedAt) {
        const minutes = runningTimer.elapsedMinutes;
        const seconds = runningTimer.elapsedSeconds;
        setElapsedTime(`${minutes}:${seconds.toString().padStart(2, "0")}`);
      } else {
        const now = new Date();
        const timeSinceLastUpdate = Math.floor(
          (now.getTime() - lastApiUpdate.getTime()) / 1000
        );
        const totalSeconds = baseElapsedSeconds + timeSinceLastUpdate;
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        setElapsedTime(`${minutes}:${seconds.toString().padStart(2, "0")}`);
      }
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [runningTimer, lastApiUpdate]);

  // Browser tab title
  useEffect(() => {
    if (!runningTimer) return;

    const originalTitle = document.title;
    const updateTitle = () => {
      let minutes: number;
      let seconds: number;

      if (runningTimer.pausedAt) {
        minutes = runningTimer.elapsedMinutes;
        seconds = runningTimer.elapsedSeconds;
      } else {
        const baseElapsedSeconds =
          runningTimer.elapsedMinutes * 60 + runningTimer.elapsedSeconds;
        const now = new Date();
        const timeSinceLastUpdate = Math.floor(
          (now.getTime() - lastApiUpdate.getTime()) / 1000
        );
        const totalSeconds = baseElapsedSeconds + timeSinceLastUpdate;
        minutes = Math.floor(totalSeconds / 60);
        seconds = totalSeconds % 60;
      }

      document.title = `${minutes}:${seconds.toString().padStart(2, "0")} - ${runningTimer.pausedAt ? "מושהה - " : ""}מוניט`;
    };

    updateTitle();
    const interval = setInterval(updateTitle, 1000);
    return () => {
      clearInterval(interval);
      document.title = originalTitle;
    };
  }, [runningTimer, lastApiUpdate]);

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
          description: timerDescription || null,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setShowTimerModal(false);
        setSelectedProject("");
        setTimerDescription("");
        showSuccessToast("הטיימר הופעל בהצלחה");
        // Refresh running timer
        const timerResponse = await fetch("/api/timer/running");
        const timerData = await timerResponse.json();
        if (timerData.success && timerData.running) {
          setRunningTimer(timerData.running);
          setLastApiUpdate(new Date());
        }
      } else {
        showErrorToast(data.message || "שגיאה בהתחלת הטיימר");
      }
    } catch (error) {
      console.error("Error starting timer:", error);
      showErrorToast("שגיאה בהתחלת הטיימר");
    } finally {
      setStartingTimer(false);
    }
  }, [selectedProject, timerDescription]);

  const handleStopTimer = useCallback(() => {
    if (!runningTimer) return;

    const totalMinutes = runningTimer.elapsedMinutes;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    setStopTimerDescription(runningTimer.description || "");
    setStopTimerHours(hours.toString());
    setStopTimerMinutes(minutes.toString());
    setShowStopTimerModal(true);
  }, [runningTimer]);

  const confirmStopTimer = useCallback(async () => {
    if (!runningTimer) return;

    setStoppingTimer(true);
    try {
      const hours = parseInt(stopTimerHours) || 0;
      const minutes = parseInt(stopTimerMinutes) || 0;
      const totalDuration = hours * 60 + minutes;

      const response = await fetch("/api/timer/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entryId: runningTimer.id,
          description: stopTimerDescription || null,
          duration: totalDuration,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setRunningTimer(null);
        setShowStopTimerModal(false);
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
  }, [runningTimer, stopTimerDescription, stopTimerHours, stopTimerMinutes]);

  const cancelStopTimer = useCallback(() => {
    setShowStopTimerModal(false);
    setStopTimerDescription("");
    setStopTimerHours("");
    setStopTimerMinutes("");
  }, []);

  const handlePauseTimer = useCallback(async () => {
    if (!runningTimer) return;

    setPausingTimer(true);
    try {
      const response = await fetch("/api/timer/pause", { method: "POST" });
      const data = await response.json();

      if (data.success) {
        showSuccessToast("הטיימר הושהה בהצלחה");
        const timerResponse = await fetch("/api/timer/running");
        const timerData = await timerResponse.json();
        if (timerData.success && timerData.running) {
          setRunningTimer(timerData.running);
          setLastApiUpdate(new Date());
        }
      } else {
        showErrorToast(data.message || "שגיאה בהשהיית הטיימר");
      }
    } catch (error) {
      console.error("Error pausing timer:", error);
      showErrorToast("שגיאה בהשהיית הטיימר");
    } finally {
      setPausingTimer(false);
    }
  }, [runningTimer]);

  const handleResumeTimer = useCallback(async () => {
    if (!runningTimer) return;

    setResumingTimer(true);
    try {
      const response = await fetch("/api/timer/resume", { method: "POST" });
      const data = await response.json();

      if (data.success) {
        showSuccessToast("הטיימר חודש בהצלחה");
        const timerResponse = await fetch("/api/timer/running");
        const timerData = await timerResponse.json();
        if (timerData.success && timerData.running) {
          setRunningTimer(timerData.running);
          setLastApiUpdate(new Date());
        }
      } else {
        showErrorToast(data.message || "שגיאה בחידוש הטיימר");
      }
    } catch (error) {
      console.error("Error resuming timer:", error);
      showErrorToast("שגיאה בחידוש הטיימר");
    } finally {
      setResumingTimer(false);
    }
  }, [runningTimer]);

  // Keyboard shortcut: 't' key toggles timer
  const handleTimerShortcut = useCallback(() => {
    if (runningTimer) {
      if (runningTimer.pausedAt) {
        handleResumeTimer();
      } else {
        handlePauseTimer();
      }
    } else {
      setShowTimerModal(true);
    }
  }, [runningTimer, handleResumeTimer, handlePauseTimer]);

  useKeyboardShortcut({
    key: "t",
    callback: handleTimerShortcut,
    disabled: !isAuthenticated,
  });

  const refreshTimer = useCallback(async () => {
    await fetchRunningTimer();
  }, [fetchRunningTimer]);

  const value: TimerContextValue = {
    runningTimer,
    elapsedTime,
    timerLoading,
    projects,
    startingTimer,
    stoppingTimer,
    pausingTimer,
    resumingTimer,
    showTimerModal,
    showStopTimerModal,
    selectedProject,
    timerDescription,
    stopTimerDescription,
    stopTimerHours,
    stopTimerMinutes,
    setShowTimerModal,
    setShowStopTimerModal,
    setSelectedProject,
    setTimerDescription,
    setStopTimerDescription,
    setStopTimerHours,
    setStopTimerMinutes,
    handleStartTimer,
    handleStopTimer,
    confirmStopTimer,
    cancelStopTimer,
    handlePauseTimer,
    handleResumeTimer,
    refreshTimer,
  };

  // Don't render provider until auth is checked
  if (!authChecked) {
    return <>{children}</>;
  }

  return (
    <TimerContext.Provider value={value}>{children}</TimerContext.Provider>
  );
}
