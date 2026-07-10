import { readFileSync } from "node:fs";
import { join } from "node:path";

const pages = ["login", "register", "forgot-password", "reset-password"] as const;

let failed = 0;
for (const page of pages) {
  const source = readFileSync(
    join(process.cwd(), "app", "[locale]", page, "page.tsx"),
    "utf8"
  );
  const formTag = source.match(/<form\b[^>]*>/)?.[0] ?? "";
  const safe = /method=["']post["']/.test(formTag);
  if (safe) {
    console.log(`  ✅ ${page} fallback never serializes credentials into the URL`);
  } else {
    failed += 1;
    console.error(`  ❌ ${page} form is missing method="post"`);
  }
}

if (failed > 0) {
  throw new Error(`${failed} authentication form fallback(s) can submit with GET`);
}
