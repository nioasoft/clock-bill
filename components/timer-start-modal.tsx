"use client";

import { Link } from "@/src/i18n/navigation";
import { useTimer } from "@/contexts/timer-context";
import { ClockFaceMarks } from "@/components/ui/thematic-elements";
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
    selectedTask,
    setSelectedTask,
    timerTasks,
    timerRates,
    selectedRateId,
    setSelectedRateId,
    timerDescription,
    setTimerDescription,
    startingTimer,
    handleStartTimer,
  } = useTimer();

  const hasProjects = projects.length > 0;

  const handleClose = () => {
    setShowTimerModal(false);
    setSelectedProject("");
    setSelectedTask("");
    setTimerDescription("");
  };

  return (
    <Dialog open={showTimerModal} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent showCloseButton={false}>
        <DialogHeader className="relative">
          <ClockFaceMarks
            size={32}
            className="absolute top-0 end-0 opacity-10 text-foreground"
          />
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
                  className="w-full rounded-[var(--radius)] border border-border bg-background px-3 py-2.5 text-sm shadow-sm focus:border-primary focus:ring-1 focus:ring-primary"
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

              {selectedProject && timerTasks.length > 0 && (
                <div>
                  <label
                    htmlFor="timer-task"
                    className="block text-sm font-medium text-foreground mb-1"
                  >
                    משימה
                  </label>
                  <select
                    id="timer-task"
                    value={selectedTask}
                    onChange={(e) => setSelectedTask(e.target.value)}
                    className="w-full rounded-[var(--radius)] border border-border bg-background px-3 py-2.5 text-sm shadow-sm focus:border-primary focus:ring-1 focus:ring-primary"
                    disabled={startingTimer}
                  >
                    <option value="">ללא משימה</option>
                    {timerTasks.map((task) => (
                      <option key={task.id} value={task.id}>
                        {task.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {selectedProject && timerRates.length > 0 && (
                <div>
                  <label
                    htmlFor="timer-rate"
                    className="block text-sm font-medium text-foreground mb-1"
                  >
                    תעריף
                  </label>
                  <select
                    id="timer-rate"
                    value={selectedRateId}
                    onChange={(e) => setSelectedRateId(e.target.value)}
                    className="w-full rounded-[var(--radius)] border border-border bg-background px-3 py-2.5 text-sm shadow-sm focus:border-primary focus:ring-1 focus:ring-primary"
                    disabled={startingTimer}
                  >
                    {timerRates.map((rate) => (
                      <option key={rate.id} value={rate.id}>
                        {rate.name} — {rate.rate}/שעה
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {!selectedTask && (
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
                    className="w-full rounded-[var(--radius)] border border-border bg-background px-3 py-2.5 text-sm shadow-sm focus:border-primary focus:ring-1 focus:ring-primary"
                    disabled={startingTimer}
                  />
                </div>
              )}

              <div className="flex gap-3 justify-end">
                <button
                  onClick={handleClose}
                  disabled={startingTimer}
                  className="px-4 py-2.5 text-sm font-medium text-muted-foreground bg-muted rounded-[var(--radius)] hover:bg-muted/80 disabled:opacity-50 min-h-[44px]"
                >
                  ביטול
                </button>
                <button
                  onClick={handleStartTimer}
                  disabled={startingTimer || !selectedProject}
                  className="px-4 py-2.5 text-sm font-medium text-primary-foreground bg-primary rounded-[var(--radius)] hover:bg-primary/90 disabled:opacity-50 min-h-[44px]"
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
                  className="inline-flex items-center justify-center px-4 py-2.5 text-sm font-medium text-primary-foreground bg-primary rounded-[var(--radius)] hover:bg-primary/90 min-h-[44px]"
                >
                  + צור פרויקט חדש
                </Link>
                <Link
                  href="/clients?create=true"
                  onClick={() => setShowTimerModal(false)}
                  className="inline-flex items-center justify-center px-4 py-2.5 text-sm font-medium text-muted-foreground bg-muted rounded-[var(--radius)] hover:bg-muted/80 min-h-[44px]"
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
