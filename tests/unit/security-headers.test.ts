import { readFileSync } from "node:fs";
import { join } from "node:path";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const config = readFileSync(join(process.cwd(), "next.config.mjs"), "utf8");

const checks: Array<[string, boolean]> = [
  [
    "production responses enforce CSP instead of report-only mode",
    config.includes('{ key: "Content-Security-Policy", value: contentSecurityPolicy }') &&
      !config.includes("Content-Security-Policy-Report-Only"),
  ],
  [
    "development stays compatible with Turbopack HMR",
    config.includes('process.env.NODE_ENV === "production"'),
  ],
  [
    "the production script policy never enables eval",
    config.includes("script-src 'self' 'unsafe-inline'") && !config.includes("unsafe-eval"),
  ],
  [
    "high-risk embedding and plugin surfaces are denied",
    config.includes("frame-ancestors 'none'") &&
      config.includes("object-src 'none'") &&
      config.includes("base-uri 'self'") &&
      config.includes("form-action 'self'"),
  ],
  [
    "PWA workers and manifests are explicitly constrained",
    config.includes("worker-src 'self' blob:") && config.includes("manifest-src 'self'"),
  ],
];

let failed = 0;
for (const [name, passed] of checks) {
  if (passed) {
    console.log(`  ✅ ${name}`);
  } else {
    failed += 1;
    console.error(`  ❌ ${name}`);
  }
}

assert(failed === 0, `${failed} security header check(s) failed`);
