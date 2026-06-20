/** Unit tests for trial email templates (bilingual). */
import {
  trialWelcomeEmail,
  trialDay3Email,
  trialDay7Email,
  trialDay11Email,
  trialEndedEmail,
  trialWinbackEmail,
  trialEmailFor,
} from "../../lib/emails/trial";

class TestRunner {
  private tests: Array<{ name: string; fn: () => void }> = [];
  private passed = 0; private failed = 0;
  test(name: string, fn: () => void) { this.tests.push({ name, fn }); }
  async run() {
    console.log("🧪 Running trial-emails tests...\n");
    for (const { name, fn } of this.tests) {
      try { fn(); this.passed++; console.log(`  ✅ ${name}`); }
      catch (e) { this.failed++; console.error(`  ❌ ${name}`); if (e instanceof Error) console.error(`     ${e.message}`); }
    }
    console.log(`\n${this.passed} passed, ${this.failed} failed`);
    if (this.failed > 0) process.exit(1);
  }
}
function assert(cond: boolean, message: string) { if (!cond) throw new Error(message); }
const runner = new TestRunner();
const APP_URL = "https://www.clock-bill.com";

// ---- Welcome (day 0) ----

runner.test("he welcome: RTL html + 14 + subject", () => {
  const { subject, html } = trialWelcomeEmail("he", APP_URL);
  assert(subject.length > 0, "subject empty");
  assert(html.includes('dir="rtl"'), "expected RTL");
  assert(html.includes("14"), "expected trial days");
  assert(html.includes(APP_URL), "expected CTA url");
});
runner.test("en welcome: LTR html + 14 + subject", () => {
  const { subject, html } = trialWelcomeEmail("en", APP_URL);
  assert(subject.length > 0, "subject empty");
  assert(html.includes('dir="ltr"'), "expected LTR");
  assert(html.includes("14"), "expected trial days");
  assert(html.includes(APP_URL), "expected CTA url");
});

// ---- Day 3 ----

runner.test("he day3: RTL + subject + CTA /clients", () => {
  const { subject, html } = trialDay3Email("he", { appUrl: APP_URL });
  assert(subject.length > 0, "subject empty");
  assert(html.includes('dir="rtl"'), "expected RTL");
  assert(html.includes(`${APP_URL}/clients`), "expected /clients CTA url");
});
runner.test("en day3: LTR + subject + CTA /clients", () => {
  const { subject, html } = trialDay3Email("en", { appUrl: APP_URL });
  assert(subject.length > 0, "subject empty");
  assert(html.includes('dir="ltr"'), "expected LTR");
  assert(html.includes(`${APP_URL}/clients`), "expected /clients CTA url");
});

// ---- Day 7 ----

runner.test("he day7: RTL + subject + CTA /dashboard", () => {
  const { subject, html } = trialDay7Email("he", { appUrl: APP_URL });
  assert(subject.length > 0, "subject empty");
  assert(html.includes('dir="rtl"'), "expected RTL");
  assert(html.includes(`${APP_URL}/dashboard`), "expected /dashboard CTA url");
});
runner.test("en day7: LTR + subject + CTA /dashboard", () => {
  const { subject, html } = trialDay7Email("en", { appUrl: APP_URL });
  assert(subject.length > 0, "subject empty");
  assert(html.includes('dir="ltr"'), "expected LTR");
  assert(html.includes(`${APP_URL}/dashboard`), "expected /dashboard CTA url");
});

// ---- Day 11 ----

runner.test("he day11: RTL + subject includes daysLeft + CTA /pricing", () => {
  const { subject, html } = trialDay11Email("he", { appUrl: APP_URL, daysLeft: 3 });
  assert(subject.length > 0, "subject empty");
  assert(html.includes('dir="rtl"'), "expected RTL");
  assert(subject.includes("3") || html.includes("3"), "expected daysLeft in content");
  assert(html.includes(`${APP_URL}/pricing`), "expected /pricing CTA url");
});
runner.test("en day11: LTR + subject includes daysLeft + CTA /pricing", () => {
  const { subject, html } = trialDay11Email("en", { appUrl: APP_URL, daysLeft: 3 });
  assert(subject.length > 0, "subject empty");
  assert(html.includes('dir="ltr"'), "expected LTR");
  assert(subject.includes("3") || html.includes("3"), "expected daysLeft in content");
  assert(html.includes(`${APP_URL}/pricing`), "expected /pricing CTA url");
});

// ---- Trial ended ----

runner.test("he trial_ended: RTL + subject + lockedCount + CTA /pricing", () => {
  const { subject, html } = trialEndedEmail("he", { appUrl: APP_URL, lockedCount: 5 });
  assert(subject.length > 0, "subject empty");
  assert(html.includes('dir="rtl"'), "expected RTL");
  assert(html.includes("5"), "expected lockedCount in html");
  assert(html.includes(`${APP_URL}/pricing`), "expected /pricing CTA url");
});
runner.test("en trial_ended: LTR + subject + lockedCount + CTA /pricing", () => {
  const { subject, html } = trialEndedEmail("en", { appUrl: APP_URL, lockedCount: 5 });
  assert(subject.length > 0, "subject empty");
  assert(html.includes('dir="ltr"'), "expected LTR");
  assert(html.includes("5"), "expected lockedCount in html");
  assert(html.includes(`${APP_URL}/pricing`), "expected /pricing CTA url");
});

// ---- Winback ----

runner.test("he winback: RTL + subject + CTA /pricing", () => {
  const { subject, html } = trialWinbackEmail("he", { appUrl: APP_URL });
  assert(subject.length > 0, "subject empty");
  assert(html.includes('dir="rtl"'), "expected RTL");
  assert(html.includes(`${APP_URL}/pricing`), "expected /pricing CTA url");
});
runner.test("en winback: LTR + subject + CTA /pricing", () => {
  const { subject, html } = trialWinbackEmail("en", { appUrl: APP_URL });
  assert(subject.length > 0, "subject empty");
  assert(html.includes('dir="ltr"'), "expected LTR");
  assert(html.includes(`${APP_URL}/pricing`), "expected /pricing CTA url");
});

// ---- Dispatcher ----

runner.test("trialEmailFor trial_ended he includes lockedCount 4", () => {
  const { html } = trialEmailFor("trial_ended", "he", { appUrl: "https://x", lockedCount: 4 });
  assert(html.includes("4"), "expected lockedCount 4 in html");
});
runner.test("trialEmailFor trial_d3 routes to day3 template", () => {
  const { html } = trialEmailFor("trial_d3", "en", { appUrl: APP_URL });
  assert(html.includes(`${APP_URL}/clients`), "expected /clients CTA from day3 template");
});
runner.test("trialEmailFor trial_winback routes to winback template", () => {
  const { html } = trialEmailFor("trial_winback", "en", { appUrl: APP_URL });
  assert(html.includes(`${APP_URL}/pricing`), "expected /pricing CTA from winback template");
});

runner.run();
