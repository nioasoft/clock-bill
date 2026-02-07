"use client";

import Link from "next/link";
import { useTimer } from "@/contexts/timer-context";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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

  const hasProjects = projects.length > 0;

  const handleClose = () => {
    setShowTimerModal(false);
    setSelectedProject("");
    setTimerDescription("");
  };

  return (
    <Dialog open={showTimerModal} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="font-display">התחל טיימר חדש</DialogTitle>
        </DialogHeader>

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
                  onClick={handleClose}
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
      </DialogContent>
    </Dialog>
  );
}
