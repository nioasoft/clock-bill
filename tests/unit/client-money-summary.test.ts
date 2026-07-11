import { summarizeClientMoney } from "../../lib/client-money-summary";

const tests: Array<{ name: string; run: () => void }> = [];
const test = (name: string, run: () => void) => tests.push({ name, run });
function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
}

test("uses entry rate snapshots and effective rounding for unbilled work", () => {
  const result = summarizeClientMoney({
    clientCurrencies: new Map([["client-1", "ILS"]]),
    profileRounding: "none",
    entries: [
      {
        clientId: "client-1",
        id: "entry-1",
        description: "Consulting",
        notes: null,
        billingKind: "hourly",
        duration: 61,
        quantity: null,
        rate: 120,
        rateLabel: "Standard",
        itemRef: null,
        projectRounding: "quarter_hour_up",
        clientRounding: "none",
      },
      {
        clientId: "client-1",
        id: "entry-2",
        description: "Workshop",
        notes: null,
        billingKind: "item",
        duration: 0,
        quantity: 2,
        rate: 350,
        rateLabel: "Workshop",
        itemRef: 1,
        projectRounding: null,
        clientRounding: null,
      },
    ],
    documents: [],
  });

  assertEqual(result.get("client-1")?.unbilled, 850, "75 minutes × 120 + 2 × 350");
});

test("separates outstanding and paid document money without mixing currencies", () => {
  const result = summarizeClientMoney({
    clientCurrencies: new Map([["client-1", "USD"]]),
    profileRounding: "none",
    entries: [],
    documents: [
      { clientId: "client-1", currency: "USD", total: 1000, discountType: null, discountValue: null, vatRate: 0, paidSum: 250 },
      { clientId: "client-1", currency: "ILS", total: 500, discountType: null, discountValue: null, vatRate: 0, paidSum: 500 },
    ],
  });

  assertEqual(result.get("client-1")?.outstanding, 750, "open USD balance");
  assertEqual(result.get("client-1")?.paid, 250, "paid USD amount");
  assertEqual(result.get("client-1")?.hasOtherCurrency, true, "flags excluded legacy currency");
});

let failed = 0;
for (const item of tests) {
  try {
    item.run();
    console.log(`  ✅ ${item.name}`);
  } catch (error) {
    failed += 1;
    console.error(`  ❌ ${item.name}`);
    console.error(error instanceof Error ? `     ${error.message}` : error);
  }
}
console.log(`\n📊 Results: ${tests.length - failed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
