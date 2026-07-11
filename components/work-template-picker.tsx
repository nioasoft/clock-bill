"use client";

import { useCallback, useEffect, useState } from "react";
import { Bookmark, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

export interface WorkTemplate {
  id: string;
  clientId: string;
  projectId: string;
  rateId: string | null;
  title: string;
  description: string;
  notes: string | null;
  billingKind: "hourly" | "item";
  duration: number | null;
  quantity: number | null;
  rate: number | null;
  rateLabel: string | null;
  unit: string | null;
  isBillable: boolean;
  projectName: string;
  clientName: string;
}

export function WorkTemplatePicker({ onApply }: { onApply: (template: WorkTemplate) => void }) {
  const t = useTranslations("Entries.templates");
  const [templates, setTemplates] = useState<WorkTemplate[]>([]);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/work-templates");
      const json = await response.json();
      if (response.ok && json.success) setTemplates(json.templates as WorkTemplate[]);
    } catch {
      // Templates accelerate capture but never block the primary entry form.
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => { void load(); });
  }, [load]);

  const remove = async (id: string) => {
    const previous = templates;
    setTemplates((items) => items.filter((item) => item.id !== id));
    try {
      const response = await fetch(`/api/work-templates/${id}`, { method: "DELETE" });
      if (!response.ok) setTemplates(previous);
    } catch {
      setTemplates(previous);
    }
  };

  if (templates.length === 0) return null;

  return (
    <section aria-labelledby="work-templates-title" className="rounded-[var(--radius)] border border-border bg-surface/50 p-3">
      <h3 id="work-templates-title" className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
        <Bookmark className="h-4 w-4 text-primary" aria-hidden="true" />{t("title")}
      </h3>
      <div className="flex max-w-full gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
        {templates.map((template) => (
          <div key={template.id} className="flex min-w-52 shrink-0 items-stretch rounded-[var(--radius)] border border-border bg-card">
            <button type="button" onClick={() => onApply(template)} className="min-h-11 min-w-0 flex-1 px-3 py-2 text-start transition-colors hover:bg-card-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <span className="block truncate text-sm font-medium text-foreground"><bdi>{template.title}</bdi></span>
              <span className="block truncate text-xs text-muted-foreground"><bdi>{template.clientName}</bdi> · <bdi>{template.projectName}</bdi></span>
            </button>
            <button type="button" onClick={() => void remove(template.id)} className="inline-flex min-h-11 min-w-11 items-center justify-center text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={t("delete", { title: template.title })}>
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
