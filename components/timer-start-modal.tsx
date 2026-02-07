"use client";

import Link from "next/link";
import { useTimer } from "@/contexts/timer-context";

export function TimerStartModal() {
  const {
    showTimerModal,
    setShowTimerModal,
    projects,
    selectedProject,
    setSelectedProject,
    timerDescription,
    setTimerDescription,
    startingTimer,
    handleStartTimer,
  } = useTimer();

  if (!showTimerModal) return null;

  const hasProjects = projects.length > 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card border border-border rounded-[14px] p-6 max-w-md w-full mx-4 shadow-lg">
        <h3 className="font-display text-lg font-semibold text-foreground mb-4">
          התחל טיימר חדש
        </h3>

        <div className="space-y-4">
          {hasProjects ? (
            <>
              <div>
                <label
                  htmlFor="timer-project"
                  className="block text-sm font-medium text-foreground mb-1"
                >
                  פרויקט *
                </label>
                <select
                  id="timer-project"
                  value={selectedProject}
                  onChange={(e) => setSelectedProject(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:ring-1 focus:ring-primary"
                  disabled={startingTimer}
                >
                  <option value="">בחר פרויקט</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="timer-description"
                  className="block text-sm font-medium text-foreground mb-1"
                >
                  תיאור
                </label>
                <input
                  type="text"
                  id="timer-description"
                  value={timerDescription}
                  onChange={(e) => setTimerDescription(e.target.value)}
                  placeholder="מה אתה עובד עליו?"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:ring-1 focus:ring-primary"
                  disabled={startingTimer}
                />
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowTimerModal(false);
                    setSelectedProject("");
                    setTimerDescription("");
                  }}
                  disabled={startingTimer}
                  className="px-4 py-2 text-sm font-medium text-muted-foreground bg-muted rounded-md hover:bg-muted/80 disabled:opacity-50"
                >
                  ביטול
                </button>
                <button
                  onClick={handleStartTimer}
                  disabled={startingTimer || !selectedProject}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary/90 disabled:opacity-50"
                >
                  {startingTimer ? "מתחיל..." : "התחל טיימר"}
                </button>
              </div>
            </>
          ) : (
            <div className="text-center py-4">
              <p className="text-muted-foreground mb-4">אין פרויקטים עדיין</p>
              <p className="text-sm text-muted-foreground mb-4">
                כדי להתחיל לעקוב אחר זמן, צור קודם פרויקט
              </p>
              <div className="flex flex-col gap-2">
                <Link
                  href="/projects?create=true"
                  onClick={() => setShowTimerModal(false)}
                  className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary/90"
                >
                  + צור פרויקט חדש
                </Link>
                <Link
                  href="/clients?create=true"
                  onClick={() => setShowTimerModal(false)}
                  className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-muted-foreground bg-muted rounded-md hover:bg-muted/80"
                >
                  + צור לקוח חדש
                </Link>
              </div>
              <button
                onClick={() => setShowTimerModal(false)}
                className="mt-3 px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
              >
                ביטול
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
