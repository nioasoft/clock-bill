/** Unit tests for trial email templates (bilingual). */
import { trialWelcomeEmail } from "../../lib/emails/trial";

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

runner.test("he welcome: RTL html + 14 + subject", () => {
  const { subject, html } = trialWelcomeEmail("he", "https://www.clock-bill.com");
  assert(subject.length > 0, "subject empty");
  assert(html.includes('dir="rtl"'), "expected RTL");
  assert(html.includes("14"), "expected trial days");
  assert(html.includes("https://www.clock-bill.com"), "expected CTA url");
});
runner.test("en welcome: LTR html + 14 + subject", () => {
  const { subject, html } = trialWelcomeEmail("en", "https://www.clock-bill.com");
  assert(subject.length > 0, "subject empty");
  assert(html.includes('dir="ltr"'), "expected LTR");
  assert(html.includes("14"), "expected trial days");
  assert(html.includes("https://www.clock-bill.com"), "expected CTA url");
});

runner.run();
