import { formatMarketingAmount } from "../../components/landing/marketing-amount";

function assertEqual(actual: string, expected: string, message: string): void {
  if (actual !== expected) {
    throw new Error(
      `${message}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`
    );
  }
}

function assertNoBidiControls(value: string, message: string): void {
  if (/[\u061c\u200e\u200f]/u.test(value)) {
    throw new Error(`${message}: unexpected bidi control in ${JSON.stringify(value)}`);
  }
}

assertEqual(formatMarketingAmount(1820, "he"), "1,820\u00a0₪", "Hebrew amount");
assertEqual(formatMarketingAmount(0, "he"), "0\u00a0₪", "Hebrew zero balance");
assertEqual(formatMarketingAmount(-180, "he"), "-180\u00a0₪", "Hebrew negative amount");
assertEqual(formatMarketingAmount(1820, "en"), "$1,820", "English amount");
assertEqual(formatMarketingAmount(-180, "en"), "-$180", "English negative amount");
assertNoBidiControls(formatMarketingAmount(1820, "he"), "Hebrew formatter");
assertNoBidiControls(formatMarketingAmount(1820, "en"), "English formatter");

console.log("✅ marketing-currency: locale placement and bidi output pass");
