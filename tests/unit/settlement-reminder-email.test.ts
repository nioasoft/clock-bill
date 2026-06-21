/** Unit tests for lib/emails/settlement-reminder.ts (bilingual digest). */
import { settlementReminderEmail } from "../../lib/emails/settlement-reminder";

class TestRunner {
  private tests: Array<{ name: string; fn: () => void }> = [];
  private passed = 0; private failed = 0;
  test(name: string, fn: () => void) { this.tests.push({ name, fn }); }
  async run() {
    console.log("🧪 Running settlement-reminder-email tests...\n");
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

const URL = "https://www.clock-bill.com/dashboard";
const clients = [{ name: "אלפא", amountLabel: "₪1,200.00" }, { name: "בטא", amountLabel: "₪800.00" }];

runner.test("he: RTL, lists both clients + count + dashboard link", () => {
  const { subject, html } = settlementReminderEmail("he", { clients, dashboardUrl: URL });
  assert(subject.length > 0, "subject empty");
  assert(html.includes('dir="rtl"'), "expected RTL");
  assert(html.includes("אלפא") && html.includes("בטא"), "both clients listed");
  assert(html.includes("₪1,200.00"), "amount shown");
  assert(html.includes(URL), "dashboard link");
});
runner.test("en: LTR + count of 2", () => {
  const { subject, html } = settlementReminderEmail("en", { clients: [{ name: "Alpha", amountLabel: "$100" }, { name: "Beta", amountLabel: "$50" }], dashboardUrl: URL });
  assert(html.includes('dir="ltr"'), "expected LTR");
  assert(subject.includes("2"), "count in subject");
  assert(html.includes("Alpha") && html.includes("Beta"), "clients listed");
});
runner.test("escapes client names", () => {
  const { html } = settlementReminderEmail("he", { clients: [{ name: "<b>x</b>", amountLabel: "₪1" }], dashboardUrl: URL });
  assert(!html.includes("<b>x</b>"), "name must be escaped");
  assert(html.includes("&lt;b&gt;"), "escaped form present");
});

runner.run();
