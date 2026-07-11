import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function source(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), "utf8");
}

function run(): void {
  const legal = source("components", "legal-page.tsx");
  const contact = source("components", "contact-form.tsx");
  const feedback = source("app", "[locale]", "feedback", "page.tsx");
  const notFound = source("app", "[locale]", "not-found.tsx");
  const adminDirectory = join(process.cwd(), "app", "[locale]", "admin");
  const adminSources = [
    source("app", "[locale]", "admin", "page.tsx"),
    source("app", "[locale]", "admin", "stats", "page.tsx"),
    source("app", "[locale]", "admin", "users", "page.tsx"),
    source("app", "[locale]", "admin", "users", "[id]", "page.tsx"),
    ...readdirSync(adminDirectory)
      .filter((file) => file.endsWith(".tsx") && file !== "page.tsx")
      .map((file) => readFileSync(join(adminDirectory, file), "utf8")),
  ].join("\n");

  assert(
    legal.includes("<article") &&
      legal.includes("text-balance") &&
      legal.includes("min-h-11") &&
      legal.includes("rtl:-scale-x-100"),
    "Legal pages must provide readable hierarchy, touch targets, and directional back navigation"
  );
  assert(
    contact.includes('from "@/components/ui/input"') &&
      contact.includes('from "@/components/ui/textarea"') &&
      contact.includes('from "@/components/ui/button"') &&
      contact.includes("aria-busy={submitting}"),
    "Public contact must use shared accessible form controls and announce submission state"
  );
  assert(
    feedback.includes("messageRef.current?.focus()") &&
      feedback.includes("<FieldMessage variant=\"error\"") &&
      !feedback.includes("submitting || message.trim().length < 5"),
    "Feedback validation must explain and focus errors instead of pre-emptively disabling submit"
  );
  assert(
    notFound.includes('<h1 className="mb-2') &&
      notFound.includes('aria-hidden="true">404</div>') &&
      notFound.includes("min-h-11"),
    "The localized 404 message must be the semantic heading with usable recovery targets"
  );
  assert(
    adminSources.includes('role="alert"') &&
      adminSources.includes('role="status"') &&
      adminSources.includes("setLoadError(true)") &&
      adminSources.includes("min-h-11"),
    "Admin screens must expose loading, error, empty, and touch-friendly action states"
  );
  assert(!adminSources.includes("transition-all"), "Admin screens must transition explicit properties only");

  console.log("✅ secondary-ui-experience: public and admin guardrails pass");
}

try {
  run();
  process.exit(0);
} catch (error) {
  console.error("❌ secondary-ui-experience:", error instanceof Error ? error.message : error);
  process.exit(1);
}
