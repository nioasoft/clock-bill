/** Source guardrails for the task workflow refresh. */
import { readFileSync } from "node:fs";
import { join } from "node:path";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function source(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), "utf8");
}

function run(): void {
  const page = source("app", "[locale]", "tasks", "page.tsx");
  const board = source("components", "tasks", "kanban-board.tsx");
  const column = source("components", "tasks", "kanban-column.tsx");
  const mobile = source("components", "tasks", "mobile-task-list.tsx");
  const form = source("components", "tasks", "task-form-dialog.tsx");

  assert(
    page.includes("<KanbanBoard board={board} onCreate=") &&
      page.includes("<MobileTaskList board={board} onCreate="),
    "Desktop and mobile task views must expose the same create action"
  );
  assert(
    board.includes("onCreate={onCreate}") && column.includes('status === "todo"') &&
      column.includes("onCreate?: () => void"),
    "The desktop quick-add affordance must live in the To Do column where new tasks are created"
  );
  assert(
    mobile.includes("onCreate: () => void") && mobile.includes("onClick={onCreate}"),
    "Mobile task tabs must keep quick-add within thumb reach"
  );
  assert(
    form.includes('aria-controls="task-advanced"') &&
      form.includes("aria-expanded={showAdvanced}") &&
      !form.includes("sm:block space-y-4"),
    "Advanced task fields must be progressively disclosed on every viewport"
  );
  assert(
    form.includes("min-h-[44px]") && column.includes("min-h-[44px]") && mobile.includes("min-h-[44px]"),
    "Task workflow controls must provide 44px interaction targets"
  );
  assert(
    form.includes("pickDefaultHourlyRate") &&
      form.includes("/rates?projectId=") &&
      form.includes("prev && hourly.some"),
    "Task form refresh must preserve project-scoped default-rate behavior"
  );

  console.log("✅ tasks-experience: quick add, disclosure, targets, and rate guardrails pass");
}

try {
  run();
  process.exit(0);
} catch (error) {
  console.error("❌ tasks-experience:", error instanceof Error ? error.message : error);
  process.exit(1);
}
