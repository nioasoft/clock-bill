/** Unit tests for lib/emails/charge-document-approved.ts (bilingual approval notification). */
import { chargeDocumentApprovedEmail } from "../../lib/emails/charge-document-approved";

class TestRunner {
  private tests: Array<{ name: string; fn: () => void }> = [];
  private passed = 0; private failed = 0;
  test(name: string, fn: () => void) { this.tests.push({ name, fn }); }
  async run() {
    console.log("🧪 Running charge-document-approved-email tests...\n");
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

const URL = "https://www.clock-bill.com/reports?tab=documents";
const params = { clientName: "אלפא", docNumber: 12, amountLabel: "₪1,200.00", documentUrl: URL };

runner.test("he: RTL, client name + doc number + amount + link", () => {
  const { subject, html } = chargeDocumentApprovedEmail("he", params);
  assert(subject.includes("אלפא") && subject.includes("12"), "subject names client + doc number");
  assert(html.includes('dir="rtl"'), "expected RTL");
  assert(html.includes("₪1,200.00"), "amount shown");
  assert(html.includes(URL), "document link present");
});
runner.test("en: LTR + client name + doc number", () => {
  const { subject, html } = chargeDocumentApprovedEmail("en", { ...params, clientName: "Alpha", amountLabel: "$100" });
  assert(html.includes('dir="ltr"'), "expected LTR");
  assert(subject.includes("Alpha") && subject.includes("#12"), "subject names client + doc number");
  assert(html.includes("$100"), "amount shown");
});
runner.test("escapes client names", () => {
  const { html } = chargeDocumentApprovedEmail("he", { ...params, clientName: "<b>x</b>" });
  assert(!html.includes("<b>x</b>"), "name must be escaped");
  assert(html.includes("&lt;b&gt;"), "escaped form present");
});

runner.run();
