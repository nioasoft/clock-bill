import { readFileSync } from "node:fs";
import { join } from "node:path";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function run(): void {
  const source = readFileSync(
    join(process.cwd(), "components", "onboarding-modal.tsx"),
    "utf8"
  );

  assert(
    source.includes("<Dialog open>") &&
      source.includes('variant="sheet"') &&
      source.includes("showCloseButton={false}"),
    "Onboarding must use the shared, deliberately non-dismissible Dialog sheet"
  );
  assert(
    source.includes("role=\"progressbar\"") &&
      source.includes("aria-valuenow={step}") &&
      source.includes("TOTAL_STEPS = 2"),
    "Onboarding must expose visible and assistive two-step progress"
  );
  assert(
    source.includes("step === 1") && source.includes("setStep(2)") && source.includes("setStep(1)"),
    "Onboarding must progressively disclose profession and billing settings"
  );
  assert(
    source.includes("<details") && source.includes('t("appearanceLabel")'),
    "Theme selection must remain available at a lower visual priority"
  );
  assert(
    source.includes('locale === "he"') &&
      source.includes("selectedPreset.modelHintHe") &&
      source.includes("selectedPreset.modelHintEn"),
    "Profession hints must follow the active Hebrew or English locale"
  );
  assert(
    source.includes('fetch("/api/profile"') &&
      source.includes("profession,") &&
      source.includes("defaultCurrency: currency") &&
      source.includes("defaultBillingRounding: rounding") &&
      source.includes("preferredPdfTemplate") &&
      source.includes("onboarded: true"),
    "The polished flow must preserve profile setup persistence"
  );
  assert(
    source.includes("async function handleSkip()") &&
      source.includes("JSON.stringify({ onboarded: true })") &&
      source.includes("finally") &&
      source.includes("onDone();"),
    "Skip must remain best-effort and never trap a new user"
  );
  assert(!source.includes("transition-all"), "Onboarding must transition explicit properties only");

  console.log("✅ onboarding-experience: accessible progressive flow guardrails pass");
}

try {
  run();
  process.exit(0);
} catch (error) {
  console.error("❌ onboarding-experience:", error instanceof Error ? error.message : error);
  process.exit(1);
}
