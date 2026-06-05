"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { AppLayout } from "@/components/app-layout";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { KanbanBoard } from "@/components/tasks/kanban-board";
import { MobileTaskList } from "@/components/tasks/mobile-task-list";
import { TaskFormDialog } from "@/components/tasks/task-form-dialog";
import { useTasksBoard } from "@/components/tasks/use-tasks-board";

export default function TasksPage() {
  const t = useTranslations("Tasks.board");
  const [creating, setCreating] = useState(false);
  const board = useTasksBoard();

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
        <PageHeader title={t("pageTitle")}>
          <button
            onClick={() => setCreating(true)}
            className="min-h-[44px] rounded-[var(--radius-card)] bg-primary px-4 py-2 font-medium text-primary-foreground hover:bg-primary/90"
          >
            {t("newTask")}
          </button>
        </PageHeader>

        <div className="hidden lg:block">
          <KanbanBoard board={board} />
        </div>
        <div className="lg:hidden">
          <MobileTaskList board={board} />
        </div>

        {creating && (
          <TaskFormDialog
            mode="create"
            onClose={() => setCreating(false)}
            onSaved={() => { setCreating(false); board.load(); }}
          />
        )}
      </PageContainer>
    </AppLayout>
  );
}
