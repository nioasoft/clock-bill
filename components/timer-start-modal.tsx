"use client";

import { useEffect, useMemo, useState } from "react";
import { Link } from "@/src/i18n/navigation";
import { useTranslations } from "next-intl";
import { useTimer } from "@/contexts/timer-context";
import { ClockFaceMarks } from "@/components/ui/thematic-elements";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SimpleSelect } from "@/components/ui/simple-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { readRecentWorkContext } from "@/lib/recent-work-context";

export function TimerStartModal() {
  const t = useTranslations("Timer");
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

  // With several clients the flow is two-step: pick a client first, then see
  // only that client's projects. With exactly one client, skip the client
  // select and show its name once below the project field.
  const [selectedClientId, setSelectedClientId] = useState("");
  const clients = useMemo(() => {
    const byId = new Map<string, string>();
    for (const p of projects) {
      if (!byId.has(p.clientId)) byId.set(p.clientId, p.clientName);
    }
    return [...byId.entries()].map(([id, name]) => ({ id, name }));
  }, [projects]);
  const multiClient = clients.length > 1;
  const singleClientName = clients.length === 1 ? clients[0].name : null;
  const visibleProjects = multiClient
    ? projects.filter((p) => p.clientId === selectedClientId)
    : projects;

  useEffect(() => {
    if (!showTimerModal || selectedProject || projects.length === 0) return;
    const recent = readRecentWorkContext();
    const project = recent && projects.find((item) => item.id === recent.projectId);
    if (!project) return;
    queueMicrotask(() => {
      setSelectedClientId(project.clientId);
      setSelectedProject(project.id);
      if (recent.rateId) setSelectedRateId(recent.rateId);
    });
  }, [projects, selectedProject, setSelectedProject, setSelectedRateId, showTimerModal]);

  const handleClientChange = (clientId: string) => {
    setSelectedClientId(clientId);
    // The previously selected project belongs to another client now.
    setSelectedProject("");
    setSelectedTask("");
  };

  const handleClose = () => {
    setShowTimerModal(false);
    setSelectedClientId("");
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
          <DialogTitle className="font-display">{t("start.title")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {hasProjects ? (
            <>
              {multiClient && (
                <div>
                  <label
                    htmlFor="timer-client"
                    className="block text-sm font-medium text-foreground mb-1"
                  >
                    {t("start.clientLabel")}
                  </label>
                  <SimpleSelect
                    id="timer-client"
                    value={selectedClientId}
                    onChange={handleClientChange}
                    placeholder={t("start.clientPlaceholder")}
                    disabled={startingTimer}
                    options={clients.map((client) => ({
                      value: client.id,
                      label: client.name,
                    }))}
                  />
                </div>
              )}

              {(!multiClient || selectedClientId) && (
                <div>
                  <label
                    htmlFor="timer-project"
                    className="block text-sm font-medium text-foreground mb-1"
                  >
                    {t("start.projectLabel")}
                  </label>
                  <SimpleSelect
                    id="timer-project"
                    value={selectedProject}
                    onChange={setSelectedProject}
                    placeholder={t("start.projectPlaceholder")}
                    disabled={startingTimer}
                    options={visibleProjects.map((project) => ({
                      value: project.id,
                      label: project.name,
                    }))}
                  />
                  {singleClientName && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("start.clientLine", { name: singleClientName })}
                    </p>
                  )}
                </div>
              )}

              {selectedProject && timerTasks.length > 0 && (
                <div>
                  <label
                    htmlFor="timer-task"
                    className="block text-sm font-medium text-foreground mb-1"
                  >
                    {t("start.taskLabel")}
                  </label>
                  <SimpleSelect
                    id="timer-task"
                    value={selectedTask}
                    onChange={setSelectedTask}
                    disabled={startingTimer}
                    options={[
                      { value: "", label: t("start.noTask") },
                      ...timerTasks.map((task) => ({
                        value: task.id,
                        label: task.name,
                      })),
                    ]}
                  />
                </div>
              )}

              {selectedProject && timerRates.length > 0 && (
                <div>
                  <label
                    htmlFor="timer-rate"
                    className="block text-sm font-medium text-foreground mb-1"
                  >
                    {t("start.rateLabel")}
                  </label>
                  <SimpleSelect
                    id="timer-rate"
                    value={selectedRateId}
                    onChange={setSelectedRateId}
                    disabled={startingTimer}
                    options={timerRates.map((rate) => ({
                      value: rate.id,
                      label: t("start.rateOption", { name: rate.name, rate: rate.rate }),
                    }))}
                  />
                </div>
              )}

              {!selectedTask && (
                <div>
                  <label
                    htmlFor="timer-description"
                    className="block text-sm font-medium text-foreground mb-1"
                  >
                    {t("start.descriptionLabel")}
                  </label>
                  <Input
                    type="text"
                    id="timer-description"
                    value={timerDescription}
                    onChange={(e) => setTimerDescription(e.target.value)}
                    placeholder={t("start.descriptionPlaceholder")}
                    disabled={startingTimer}
                  />
                </div>
              )}

              <div className="flex gap-3 justify-end">
                <Button
                  variant="secondary"
                  onClick={handleClose}
                  disabled={startingTimer}
                >
                  {t("start.cancel")}
                </Button>
                <Button
                  onClick={handleStartTimer}
                  disabled={startingTimer || !selectedProject}
                >
                  {startingTimer ? t("start.starting") : t("start.startButton")}
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center py-4">
              <p className="text-muted-foreground mb-4">{t("start.noProjects")}</p>
              <p className="text-sm text-muted-foreground mb-4">
                {t("start.noProjectsHint")}
              </p>
              <div className="flex flex-col gap-2">
                <Link
                  href="/projects?create=true"
                  onClick={() => setShowTimerModal(false)}
                  className="inline-flex items-center justify-center px-4 py-2.5 text-sm font-medium text-primary-foreground bg-primary rounded-[var(--radius)] hover:bg-primary/90 min-h-[44px]"
                >
                  {t("start.createProject")}
                </Link>
                <Link
                  href="/clients?create=true"
                  onClick={() => setShowTimerModal(false)}
                  className="inline-flex items-center justify-center px-4 py-2.5 text-sm font-medium text-muted-foreground bg-muted rounded-[var(--radius)] hover:bg-muted/80 min-h-[44px]"
                >
                  {t("start.createClient")}
                </Link>
              </div>
              <button
                onClick={() => setShowTimerModal(false)}
                className="mt-3 px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
              >
                {t("start.cancel")}
              </button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
