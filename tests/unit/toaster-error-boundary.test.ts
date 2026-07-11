import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(process.cwd(), "components/ui/toaster.tsx"), "utf8");
if (source.includes("useTranslations")) throw new Error("Toaster must render without next-intl in the global error boundary");
if (!source.includes("aria-label")) throw new Error("Toast close control needs an accessible name");
console.log("✅ toaster-error-boundary: provider-independent recovery passes");
