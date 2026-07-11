"use client";

import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";
import { messageForError } from "@/lib/api-error";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { fieldClass } from "@/lib/form-styles";
import { SimpleSelect } from "@/components/ui/simple-select";
import { showSuccessToast, showErrorToast } from "@/lib/toast";
import { pickDefaultHourlyRate, type ClientRate } from "@/lib/schemas/rates";
import { TASK_PRIORITIES, type TaskPriority, type TaskRecord } from "@/lib/tasks-types";
import { useClients, useProjects } from "@/hooks/use-clients";

interface ClientOption { id: string; name: string }
interface ProjectOption { id: string; name: string; clientId: string }

type TaskFormDialogProps = (
  | { mode: "create" }
  | { mode: "edit"; task: TaskRecord }
) & {
  onClose: () => void;
  onSaved: () => void;
};

const labelClass = "mb-1.5 block text-sm font-medium text-foreground";

export function TaskFormDialog(props: TaskFormDialogProps) {
  const tPriority = useTranslations("Tasks.priority");
  const t = useTranslations("Tasks.form");
  const tToasts = useTranslations("Tasks.toasts");
  const tRoot = useTranslations();
  const isEdit = props.mode === "edit";
  const task = isEdit ? props.task : null;

  // Shared clients/projects lists (cache-deduped across the app).
  const { data: clientsRaw = [], isError: clientsError } =
    useClients<ClientOption & { isActive: boolean }>();
  const { data: projectsRaw = [], isError: projectsError } = useProjects<ProjectOption>();
  const clients = useMemo(
    () => clientsRaw.filter((c) => c.isActive).map((c) => ({ id: c.id, name: c.name })),
    [clientsRaw]
  );
  const projects = useMemo(
    () => projectsRaw.map((p) => ({ id: p.id, name: p.name, clientId: p.clientId })),
    [projectsRaw]
  );
  const [rates, setRates] = useState<ClientRate[]>([]);

  const [clientId, setClientId] = useState(task?.clientId ?? "");
  const [projectId, setProjectId] = useState(task?.projectId ?? "");
  const [rateId, setRateId] = useState(task?.rateId ?? "");
  const [title, setTitle] = useState(task?.title ?? "");
  const [notes, setNotes] = useState(task?.notes ?? "");
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? "normal");
  const [dueDate, setDueDate] = useState(task?.dueDate ?? "");
  const [tags, setTags] = useState<string[]>(task?.tags ?? []);
  const [tagInput, setTagInput] = useState("");

  const [submitting, setSubmitting] = useState(false);

  // Keep the first create decision short on every viewport. Existing advanced
  // values open automatically in edit mode so no saved information is hidden.
  const hasAdvancedValues = Boolean(
    task?.dueDate || (task?.tags && task.tags.length > 0) || task?.notes || (task?.priority && task.priority !== "normal")
  );
  const [showAdvanced, setShowAdvanced] = useState<boolean>(hasAdvancedValues);

  // Surface a load error for the shared clients/projects queries.
  useEffect(() => {
    if (clientsError || projectsError) showErrorToast(tToasts("loadDataError"));
  }, [clientsError, projectsError, tToasts]);

  // When a client is chosen, fetch its hourly rates and preselect a default.
  // In edit mode keep the task's existing rate if it's still in the list.
  useEffect(() => {
    if (!clientId) {
      setRates([]);
      setRateId("");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        // projectId narrows to general rates + ones scoped to the chosen project
        // (empty before a project is picked => general rates only).
        const res = await fetch(
          `/api/clients/${clientId}/rates?projectId=${encodeURIComponent(projectId)}`
        );
        const data = await res.json();
        if (cancelled || !data.success) return;
        const hourly: ClientRate[] = (data.rates as ClientRate[]).filter((r) => r.kind === "hourly");
        setRates(hourly);
        setRateId((prev) =>
          prev && hourly.some((r) => r.id === prev) ? prev : pickDefaultHourlyRate(hourly)?.id ?? ""
        );
      } catch (error) {
        console.error("Error loading client rates:", error);
      }
    })();
    return () => { cancelled = true; };
  }, [clientId, projectId]);

  const projectsForClient = useMemo(
    () => projects.filter((p) => p.clientId === clientId),
    [projects, clientId]
  );

  const handleClientChange = (id: string) => {
    setClientId(id);
    // Reset the project when the client changes (its projects no longer apply).
    setProjectId("");
  };

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) setTags((prev) => [...prev, t]);
    setTagInput("");
  };

  const handleTagKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag();
    }
  };

  // Show *which* required field is missing (instead of a silently-disabled
  // button). Errors surface only after a save attempt, then clear per-field as
  // the user fills them in.
  const [attempted, setAttempted] = useState(false);
  const missing = {
    client: !clientId,
    project: !projectId,
    rate: !rateId,
    title: !title.trim(),
  };
  const hasMissing = missing.client || missing.project || missing.rate || missing.title;

  const handleSubmit = async () => {
    if (submitting) return;
    if (hasMissing) {
      setAttempted(true);
      return;
    }
    setSubmitting(true);
    try {
      const body = {
        clientId,
        projectId,
        rateId,
        title: title.trim(),
        notes: notes.trim() || null,
        priority,
        dueDate: dueDate || null,
        tags,
      };
      const url = isEdit ? `/api/tasks/${task!.id}` : "/api/tasks";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        showSuccessToast(isEdit ? tToasts("updated") : tToasts("created"));
        props.onSaved();
      } else {
        showErrorToast(data.error_code ? messageForError(data, tRoot) : (isEdit ? tToasts("updateError") : tToasts("createError")));
      }
    } catch (error) {
      console.error("Error saving task:", error);
      showErrorToast(isEdit ? tToasts("updateError") : tToasts("createError"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) props.onClose(); }}>
      {/* Wider on desktop — the client/project/rate row needs three comfortable columns. */}
      <DialogContent variant="sheet" className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? t("editTitle") : t("createTitle")}</DialogTitle>
          <DialogDescription>
            {isEdit ? t("editDescription") : t("createDescription")}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => { e.preventDefault(); void handleSubmit(); }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-3">
            <div>
              <label htmlFor="task-client" className={labelClass}>
                {t("client")} <span className="text-primary">*</span>
              </label>
              <SimpleSelect
                id="task-client"
                value={clientId}
                onChange={handleClientChange}
                placeholder={t("selectClient")}
                disabled={submitting}
                className={attempted && missing.client ? "border-destructive/60" : undefined}
                options={clients.map((c) => ({ value: c.id, label: c.name }))}
              />
              {attempted && missing.client && (
                <p className="mt-1 text-xs text-destructive">{t("requiredClient")}</p>
              )}
            </div>

            <div>
              <label htmlFor="task-project" className={labelClass}>
                {t("project")} <span className="text-primary">*</span>
              </label>
              <SimpleSelect
                id="task-project"
                value={projectId}
                onChange={setProjectId}
                placeholder={clientId ? t("selectProject") : t("selectClientFirst")}
                disabled={submitting || !clientId}
                className={attempted && missing.project ? "border-destructive/60" : undefined}
                options={projectsForClient.map((p) => ({ value: p.id, label: p.name }))}
              />
              {attempted && missing.project && (
                <p className="mt-1 text-xs text-destructive">{t("requiredProject")}</p>
              )}
            </div>

            <div>
              <label htmlFor="task-rate" className={labelClass}>
                {t("rate")} <span className="text-primary">*</span>
              </label>
              <SimpleSelect
                id="task-rate"
                value={rateId}
                onChange={setRateId}
                placeholder={clientId ? t("selectRate") : t("selectClientFirst")}
                disabled={submitting || !clientId}
                className={attempted && missing.rate ? "border-destructive/60" : undefined}
                options={rates.map((r) => ({ value: r.id, label: r.name }))}
              />
              {attempted && missing.rate && (
                <p className="mt-1 text-xs text-destructive">{t("requiredRate")}</p>
              )}
            </div>
          </div>

          <div>
            <label htmlFor="task-title" className={labelClass}>
              {t("title")} <span className="text-primary">*</span>
            </label>
            <input
              id="task-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={fieldClass(attempted && missing.title)}
              disabled={submitting}
              placeholder={t("titlePlaceholder")}
            />
            {attempted && missing.title && (
              <p className="mt-1 text-xs text-destructive">{t("requiredTitle")}</p>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="flex min-h-[44px] w-full items-center justify-between rounded-[var(--radius)] border border-border bg-surface px-3 py-2 text-start text-sm font-medium text-foreground transition-colors hover:border-border-strong hover:bg-card-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-expanded={showAdvanced}
            aria-controls="task-advanced"
          >
            <span>{showAdvanced ? t("hideAdvanced") : t("showAdvanced")}</span>
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${showAdvanced ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
          </button>

          <div id="task-advanced" className={showAdvanced ? "space-y-4" : "hidden"}>
            <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="task-priority" className={labelClass}>{t("priority")}</label>
              <SimpleSelect
                id="task-priority"
                value={priority}
                onChange={(v) => setPriority(v as TaskPriority)}
                disabled={submitting}
                options={TASK_PRIORITIES.map((p) => ({ value: p, label: tPriority(p) }))}
              />
            </div>

            <div>
              <label htmlFor="task-due" className={labelClass}>{t("dueDate")}</label>
              <input
                id="task-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className={`${fieldClass(false)} font-mono`}
                disabled={submitting}
              />
            </div>
            </div>

            <div>
              <label htmlFor="task-tags" className={labelClass}>{t("tags")}</label>
              {tags.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex min-h-[44px] items-center gap-1 rounded-[var(--radius)] border border-border bg-background ps-2 text-xs text-foreground"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => setTags((prev) => prev.filter((x) => x !== tag))}
                        className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-[var(--radius)] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label={t("removeTag", { tag })}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <input
                id="task-tags"
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                onBlur={addTag}
                className={fieldClass(false)}
                disabled={submitting}
                placeholder={t("tagsPlaceholder")}
              />
            </div>

            <div>
              <label htmlFor="task-notes" className={labelClass}>{t("notes")}</label>
              <textarea
                id="task-notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className={`${fieldClass(false)} resize-y`}
                disabled={submitting}
                placeholder={t("notesPlaceholder")}
              />
            </div>
          </div>

          <div className="mt-2 flex justify-end gap-3 border-t border-border pt-4">
            <button
              type="button"
              onClick={props.onClose}
              disabled={submitting}
              className="min-h-[44px] rounded-[var(--radius)] border border-border px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
            >
              {t("cancel")}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="min-h-[44px] rounded-[var(--radius)] bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {submitting ? t("saving") : isEdit ? t("updateTask") : t("saveTask")}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
