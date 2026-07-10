import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import he from "../../messages/he.json";
import en from "../../messages/en.json";

interface LandingCatalog {
  hero: {
    headlinePrefix: string;
    headlineSuffix: string;
    subhead: string;
    trail: {
      work: { label: string; value: string };
      recorded: { label: string; value: string };
      ready: { label: string; value: string };
      paid: { label: string; value: string };
    };
  };
  howItWorks: {
    step4: { title: string; description: string };
  };
}

interface AccessibilityCatalog {
  title: string;
  updated: string;
  contact: { email: string };
  limitations: { heading: string; body: string };
}

const BANNED_HEBREW_MARKETING_WORDS = [
  "מגוון",
  "מרתק",
  "חיוני",
  "מהותי",
  "ייחודי",
  "רב-ממדי",
  "מקיף",
  "חדשני",
  "פורץ דרך",
  "חסר תקדים",
  "משמעותי",
  "מרכזי",
  "בולט",
  "רלוונטי",
  "רב-תכליתי",
  "מאתגר",
] as const;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function wordCount(value: string): number {
  return value.trim().split(/\s+/u).filter(Boolean).length;
}

function landingSources(): string {
  const directory = join(process.cwd(), "components", "landing");
  return readdirSync(directory)
    .filter((file) => file.endsWith(".tsx"))
    .map((file) => readFileSync(join(directory, file), "utf8"))
    .join("\n");
}

function localeLayoutSource(): string {
  return readFileSync(join(process.cwd(), "app", "[locale]", "layout.tsx"), "utf8");
}

function run(): void {
  const heLanding = he.Landing as LandingCatalog;
  const enLanding = en.Landing as LandingCatalog;
  const heAccessibility = he.Legal.accessibility as AccessibilityCatalog;
  const enAccessibility = en.Legal.accessibility as AccessibilityCatalog;

  assert(
    heLanding.hero.headlinePrefix === "כל העבודה נרשמת.",
    "Hebrew hero must lead with the approved completeness promise"
  );
  assert(
    enLanding.hero.headlinePrefix === "Every job gets logged.",
    "English hero must carry the same completeness promise"
  );
  assert(
    wordCount(`${heLanding.hero.headlinePrefix} ${heLanding.hero.headlineSuffix}`) <= 8,
    "Hebrew landing headline must remain scannable at eight words or fewer"
  );
  assert(
    wordCount(`${enLanding.hero.headlinePrefix} ${enLanding.hero.headlineSuffix}`) <= 8,
    "English landing headline must remain scannable at eight words or fewer"
  );
  assert(wordCount(heLanding.hero.subhead) <= 20, "Hebrew hero subhead must be 20 words or fewer");
  assert(wordCount(enLanding.hero.subhead) <= 20, "English hero subhead must be 20 words or fewer");

  const trailStages = ["work", "recorded", "ready", "paid"] as const;
  for (const locale of [heLanding, enLanding]) {
    for (const stage of trailStages) {
      assert(locale.hero.trail[stage].label.length > 0, `Hero money trail needs a ${stage} label`);
      assert(locale.hero.trail[stage].value.length > 0, `Hero money trail needs a ${stage} value`);
    }
    assert(locale.howItWorks.step4.title.length > 0, "How-it-works must finish with payment collection");
  }

  const hebrewLandingText = JSON.stringify(he.Landing);
  assert(!/[—–]/u.test(hebrewLandingText), "Hebrew landing copy must not contain em/en dashes");
  for (const word of BANNED_HEBREW_MARKETING_WORDS) {
    const pattern = new RegExp(`(^|[\\s,.:;!?()״\"])+${word}(?=$|[\\s,.:;!?()״\"])`, "u");
    assert(!pattern.test(hebrewLandingText), `Hebrew landing copy contains AI-style word: ${word}`);
  }

  for (const catalog of [heAccessibility, enAccessibility]) {
    assert(catalog.title.length > 0, "Accessibility statement needs a localized title");
    assert(catalog.updated.length > 0, "Accessibility statement needs a last-updated date");
    assert(catalog.contact.email === "support@clock-bill.com", "Accessibility contact email must be explicit");
    assert(catalog.limitations.body.length > 0, "Accessibility statement must disclose known limitations");
  }

  const sources = landingSources();
  assert(!sources.includes("transition-all"), "Landing components must transition explicit properties only");
  assert(!sources.includes("bg-clip-text"), "Landing components must not use gradient text");
  assert(!sources.includes("getBoundingClientRect"), "Landing cards must not measure layout on pointer movement");
  assert(!sources.includes("IntersectionObserver"), "Landing components must not ship unused observers");

  const layoutSource = localeLayoutSource();
  assert(
    !/^\s*<script\b/mu.test(layoutSource),
    "The root layout must not render a raw script tag during client navigation"
  );
  assert(
    layoutSource.includes('strategy="beforeInteractive"'),
    "The no-flash theme script must execute before hydration"
  );

  console.log("✅ marketing-experience: copy, structure, and implementation guardrails pass");
}

try {
  run();
  process.exit(0);
} catch (error) {
  console.error("❌ marketing-experience:", error instanceof Error ? error.message : error);
  process.exit(1);
}
