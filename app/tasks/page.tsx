"use client";

import { useEffect, useState } from "react";
import { AppLayout } from "@/components/app-layout";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { KanbanBoard } from "@/components/tasks/kanban-board";
import { TaskFormDialog } from "@/components/tasks/task-form-dialog";

export default function TasksPage() {
  const [creating, setCreating] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // Auto-open the create dialog when arriving via /tasks?create=true (e.g. the
  // dashboard "+ משימה חדשה" quick action). Reading the param off window avoids
  // the Suspense boundary that useSearchParams would require.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("create") === "true") {
      // One-time deep-link handling on mount; safe to set state synchronously here.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCreating(true);
      window.history.replaceState(null, "", "/tasks");
    }
  }, []);
  return (
    <AppLayout>
      <PageContainer>
        <PageHeader title="משימות">
          <button
            onClick={() => setCreating(true)}
            className="rounded-[var(--radius-card)] bg-primary px-4 py-2 font-medium text-primary-foreground hover:bg-primary/90"
          >
            + משימה חדשה
          </button>
        </PageHeader>
        <KanbanBoard key={reloadKey} />
        {creating && (
          <TaskFormDialog
            mode="create"
            onClose={() => setCreating(false)}
            onSaved={() => { setCreating(false); setReloadKey((k) => k + 1); }}
          />
        )}
      </PageContainer>
    </AppLayout>
  );
}
