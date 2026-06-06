"use client";

import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import { messageForError } from "@/lib/api-error";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { fieldClass } from "@/lib/form-styles";
import { showSuccessToast, showErrorToast } from "@/lib/toast";
import { pickDefaultHourlyRate, type ClientRate } from "@/lib/schemas/rates";
import { TASK_PRIORITIES, type TaskPriority, type TaskRecord } from "@/lib/tasks-types";

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

  const [clients, setClients] = useState<ClientOption[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
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

  // Mobile progressive disclosure: advanced fields collapse on mobile create.
  // On sm+ they're always shown via CSS; this state only gates the mobile view.
  const hasAdvancedValues = Boolean(
    task?.dueDate || (task?.tags && task.tags.length > 0) || task?.notes || (task?.priority && task.priority !== "normal")
  );
  const [showAdvanced, setShowAdvanced] = useState<boolean>(isEdit && hasAdvancedValues);

  // Load clients + projects once on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [cRes, pRes] = await Promise.all([fetch("/api/clients"), fetch("/api/projects")]);
        const [cData, pData] = await Promise.all([cRes.json(), pRes.json()]);
        if (cancelled) return;
        if (cData.success) {
          setClients(
            (cData.clients as Array<ClientOption & { isActive: boolean }>)
              .filter((c) => c.isActive)
              .map((c) => ({ id: c.id, name: c.name }))
          );
        }
        if (pData.success) {
          setProjects(
            (pData.projects as ProjectOption[]).map((p) => ({ id: p.id, name: p.name, clientId: p.clientId }))
          );
        }
      } catch (error) {
        console.error("Error loading task form options:", error);
        showErrorToast(tToasts("loadDataError"));
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        const res = await fetch(`/api/clients/${clientId}/rates`);
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
  }, [clientId]);

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

  const canSubmit = Boolean(clientId && projectId && rateId && title.trim()) && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
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
      <DialogContent variant="sheet">
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
              <select
                id="task-client"
                value={clientId}
                onChange={(e) => handleClientChange(e.target.value)}
                className={fieldClass(false)}
                disabled={submitting}
              >
                <option value="">{t("selectClient")}</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="task-project" className={labelClass}>
                {t("project")} <span className="text-primary">*</span>
              </label>
              <select
                id="task-project"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className={fieldClass(false)}
                disabled={submitting || !clientId}
              >
                <option value="">{clientId ? t("selectProject") : t("selectClientFirst")}</option>
                {projectsForClient.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="task-rate" className={labelClass}>
                {t("rate")} <span className="text-primary">*</span>
              </label>
              <select
                id="task-rate"
                value={rateId}
                onChange={(e) => setRateId(e.target.value)}
                className={fieldClass(false)}
                disabled={submitting || !clientId}
              >
                <option value="">{clientId ? t("selectRate") : t("selectClientFirst")}</option>
                {rates.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
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
              className={fieldClass(false)}
              disabled={submitting}
              placeholder={t("titlePlaceholder")}
            />
          </div>

          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="sm:hidden min-h-[44px] py-2 text-start text-sm font-medium text-primary"
            aria-expanded={showAdvanced}
            aria-controls="task-advanced"
          >
            {showAdvanced ? t("hideAdvanced") : t("showAdvanced")}
          </button>

          <div id="task-advanced" className={`${showAdvanced ? "" : "hidden"} sm:block space-y-4`}>
            <div>
              <label htmlFor="task-priority" className={labelClass}>{t("priority")}</label>
              <select
                id="task-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className={fieldClass(false)}
                disabled={submitting}
              >
                {TASK_PRIORITIES.map((p) => (
                  <option key={p} value={p}>{tPriority(p)}</option>
                ))}
              </select>
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

            <div>
              <label htmlFor="task-tags" className={labelClass}>{t("tags")}</label>
              {tags.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 rounded-[var(--radius)] border border-border bg-background px-2 py-1 text-xs text-foreground"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => setTags((prev) => prev.filter((x) => x !== tag))}
                        className="text-muted-foreground hover:text-foreground"
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

          <div className="sticky bottom-0 z-10 -mx-5 -mb-5 flex justify-end gap-3 border-t border-border bg-card px-5 py-4 sm:-mx-6 sm:-mb-6 sm:px-6">
            <button
              type="button"
              onClick={props.onClose}
              disabled={submitting}
              className="rounded-[var(--radius)] border border-border px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
            >
              {t("cancel")}
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="rounded-[var(--radius)] bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {submitting ? t("saving") : isEdit ? t("updateTask") : t("saveTask")}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
