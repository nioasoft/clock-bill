/** Unit tests for lib/emails/charge-document.ts (bilingual + reply-to). */
import { chargeDocumentEmail, resolveReplyTo } from "../../lib/emails/charge-document";

class TestRunner {
  private tests: Array<{ name: string; fn: () => void }> = [];
  private passed = 0; private failed = 0;
  test(name: string, fn: () => void) { this.tests.push({ name, fn }); }
  async run() {
    console.log("🧪 Running charge-document-email tests...\n");
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

const URL = "https://www.clock-bill.com/doc/abc123";
const P = { businessName: "סטודיו רן", clientName: "חברת אלפא", docNumber: 7, amountLabel: "₪1,170.00", url: URL };

runner.test("he: RTL, subject has doc number + business, body has amount + link", () => {
  const { subject, html } = chargeDocumentEmail("he", P);
  assert(subject.includes("7") && subject.includes("סטודיו רן"), "subject missing number/business");
  assert(html.includes('dir="rtl"'), "expected RTL");
  assert(html.includes("₪1,170.00"), "expected amount");
  assert(html.includes(URL), "expected CTA url");
});
runner.test("en: LTR, subject + amount + link", () => {
  const { subject, html } = chargeDocumentEmail("en", { ...P, businessName: "Ran Studio", clientName: "Alpha Ltd" });
  assert(subject.includes("7") && subject.includes("Ran Studio"), "subject missing number/business");
  assert(html.includes('dir="ltr"'), "expected LTR");
  assert(html.includes("₪1,170.00") && html.includes(URL), "expected amount + url");
});
runner.test("html-escapes interpolated names (no raw angle brackets)", () => {
  const { html } = chargeDocumentEmail("he", { ...P, clientName: "<script>x</script>" });
  assert(!html.includes("<script>x</script>"), "client name must be escaped");
  assert(html.includes("&lt;script&gt;"), "expected escaped form");
});
runner.test("resolveReplyTo prefers profile email, falls back to account", () => {
  assert(resolveReplyTo("biz@x.com", "acct@x.com") === "biz@x.com", "should use profile");
  assert(resolveReplyTo("  ", "acct@x.com") === "acct@x.com", "blank profile → account");
  assert(resolveReplyTo(null, "acct@x.com") === "acct@x.com", "null profile → account");
});

runner.run();
