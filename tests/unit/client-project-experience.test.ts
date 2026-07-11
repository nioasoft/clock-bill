import { readFileSync } from "node:fs";
import { join } from "node:path";

const files = [
  "app/[locale]/clients/page.tsx",
  "app/[locale]/clients/[id]/page.tsx",
  "app/[locale]/projects/page.tsx",
  "app/[locale]/projects/[id]/page.tsx",
  "components/client-rates-editor.tsx",
] as const;

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function run(): void {
  const sources = files.map(source);
  const combined = sources.join("\n");
  const ratesEditor = source("components/client-rates-editor.tsx");
  const clientsPage = source("app/[locale]/clients/page.tsx");
  const projectDetail = source("app/[locale]/projects/[id]/page.tsx");

  assert(
    !combined.includes("transition-all"),
    "Client and project surfaces must transition explicit properties only"
  );
  assert(
    !/\b(?:left|right|ml|mr|pl|pr)-/.test(combined),
    "Client and project surfaces must use RTL-safe logical positioning"
  );
  assert(
    sources.every((value) => value.includes('components/ui/button')),
    "Every client and project surface must use the shared Button primitive"
  );
  assert(
    ratesEditor.includes('components/ui/input') &&
      ratesEditor.includes('name={`rates.${idx}.name`}') &&
      ratesEditor.includes('name={`rates.${idx}.rate`}') &&
      ratesEditor.includes("rateEditor.nameColumn") &&
      ratesEditor.includes("min-h-11"),
    "The rate editor must keep shared inputs, real labels, field names, and touch targets"
  );
  assert(
    clientsPage.includes("clientsLoadError") && clientsPage.includes('role="alert"'),
    "The clients list must distinguish a load failure from a real empty state"
  );
  assert(
    projectDetail.includes('<dl className="grid grid-cols-2'),
    "Project summary metrics must use description-list semantics"
  );

  console.log("✅ client-project-experience: controls, states, RTL, and semantics pass");
}

try {
  run();
  process.exit(0);
} catch (error) {
  console.error(
    "❌ client-project-experience:",
    error instanceof Error ? error.message : error
  );
  process.exit(1);
}
