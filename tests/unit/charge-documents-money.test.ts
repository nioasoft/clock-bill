import {
  applyDiscount,
  documentMoney,
  paymentStatus,
  outstanding,
  PAYMENT_METHODS,
} from "../../lib/charge-documents";

let passed = 0;
let failed = 0;
function assert(name: string, cond: boolean): void {
  if (cond) { passed++; } else { failed++; console.error(`  ✗ ${name}`); }
}
function eq(name: string, a: number, b: number): void {
  assert(`${name} (${a} === ${b})`, Math.abs(a - b) < 1e-9);
}

// applyDiscount
{
  const p = applyDiscount(1000, "percent", 10);
  eq("percent discountAmount", p.discountAmount, 100);
  eq("percent discountedNet", p.discountedNet, 900);

  const a = applyDiscount(1000, "amount", 150);
  eq("amount discountAmount", a.discountAmount, 150);
  eq("amount discountedNet", a.discountedNet, 850);

  const clamp = applyDiscount(100, "amount", 250); // never below 0
  eq("amount clamp discountAmount", clamp.discountAmount, 100);
  eq("amount clamp discountedNet", clamp.discountedNet, 0);

  const none = applyDiscount(1000, null, null);
  eq("null discountAmount", none.discountAmount, 0);
  eq("null discountedNet", none.discountedNet, 1000);
}

// documentMoney
{
  const plain = documentMoney({ total: 1000, discountType: null, discountValue: null, vatRate: null });
  eq("plain gross", plain.gross, 1000);
  eq("plain net", plain.netSubtotal, 1000);
  eq("plain vat", plain.vatAmount, 0);

  const vat = documentMoney({ total: 1000, discountType: null, discountValue: null, vatRate: 18 });
  eq("vat gross", vat.gross, 1180);
  eq("vat vatAmount", vat.vatAmount, 180);

  const disc = documentMoney({ total: 1000, discountType: "percent", discountValue: 10, vatRate: null });
  eq("disc gross", disc.gross, 900);

  const both = documentMoney({ total: 1000, discountType: "percent", discountValue: 10, vatRate: 18 });
  // 1000 - 100 = 900 net; 900 * 1.18 = 1062
  eq("both discountedNet", both.discountedNet, 900);
  eq("both vatAmount", both.vatAmount, 162);
  eq("both gross", both.gross, 1062);
}

// paymentStatus + outstanding
{
  assert("status pending", paymentStatus(1180, 0) === "pending");
  assert("status partial", paymentStatus(1180, 600) === "partial");
  assert("status paid exact", paymentStatus(1180, 1180) === "paid");
  assert("status paid float dust", paymentStatus(1000, 999.999999) === "paid");
  assert("status paid overpay", paymentStatus(1000, 1200) === "paid");

  eq("outstanding partial", outstanding(1180, 600), 580);
  eq("outstanding overpay clamps to 0", outstanding(1000, 1200), 0);
  eq("outstanding full", outstanding(1000, 1000), 0);
}

// catalog
assert("6 payment methods", PAYMENT_METHODS.length === 6);
assert("includes bit", PAYMENT_METHODS.includes("bit"));

console.log(`\ncharge-documents-money: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
