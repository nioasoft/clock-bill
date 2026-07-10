import { readFileSync } from "node:fs";
import { join } from "node:path";

interface LockPackage {
  version?: string;
}

interface PackageLock {
  packages: Record<string, LockPackage>;
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function atLeast(version: string, minimum: readonly [number, number, number]): boolean {
  const parts = version.split(".").map((part) => Number.parseInt(part, 10));
  for (let index = 0; index < minimum.length; index += 1) {
    const actual = parts[index] ?? 0;
    if (actual > minimum[index]) return true;
    if (actual < minimum[index]) return false;
  }
  return true;
}

const lock = JSON.parse(
  readFileSync(join(process.cwd(), "package-lock.json"), "utf8")
) as PackageLock;

const affectedPackages = Object.entries(lock.packages).filter(
  ([path]) => path === "node_modules/postcss" || path.endsWith("/node_modules/postcss") ||
    path === "node_modules/esbuild" || path.endsWith("/node_modules/esbuild")
);

let failed = 0;
for (const [path, pkg] of affectedPackages) {
  try {
    assert(Boolean(pkg.version), `${path} has no locked version`);
    const version = pkg.version as string;
    if (path.endsWith("postcss")) {
      assert(atLeast(version, [8, 5, 10]), `${path} is vulnerable PostCSS ${version}`);
    } else {
      assert(atLeast(version, [0, 25, 0]), `${path} is vulnerable esbuild ${version}`);
    }
    console.log(`  ✅ ${path}@${version}`);
  } catch (error) {
    failed += 1;
    console.error(`  ❌ ${error instanceof Error ? error.message : String(error)}`);
  }
}

assert(affectedPackages.length > 0, "No PostCSS/esbuild packages found in package-lock.json");
console.log(`\n${affectedPackages.length - failed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
