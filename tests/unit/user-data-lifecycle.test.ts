import {
  USER_DATA_DELETE_ORDER,
  USER_DATA_EXPORT_TABLES,
  buildUserDataDeleteStatements,
} from "../../lib/user-data-lifecycle";
import { readFileSync } from "node:fs";
import { join } from "node:path";

class TestRunner {
  private tests: Array<{ name: string; fn: () => void }> = [];
  private passed = 0;
  private failed = 0;

  test(name: string, fn: () => void) {
    this.tests.push({ name, fn });
  }

  async run() {
    console.log("🧪 Running user-data-lifecycle tests...\n");
    for (const { name, fn } of this.tests) {
      try {
        fn();
        this.passed += 1;
        console.log(`  ✅ ${name}`);
      } catch (error) {
        this.failed += 1;
        console.error(`  ❌ ${name}`);
        if (error instanceof Error) console.error(`     ${error.message}`);
      }
    }
    console.log(`\n${this.passed} passed, ${this.failed} failed`);
    if (this.failed > 0) process.exit(1);
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function assertSameMembers(actual: readonly string[], expected: readonly string[]) {
  const a = [...actual].sort();
  const e = [...expected].sort();
  assert(JSON.stringify(a) === JSON.stringify(e), `Expected ${JSON.stringify(e)}, got ${JSON.stringify(a)}`);
}

const EXPECTED_APP_TABLES = [
  "user_profiles",
  "clients",
  "client_rates",
  "projects",
  "tasks",
  "time_entries",
  "charge_documents",
  "charge_document_lines",
  "charge_document_payments",
  "report_presets",
  "currency_rates",
  "custom_tags",
  "push_subscriptions",
  "trial_emails_sent",
] as const;

const runner = new TestRunner();

runner.test("export covers every user-scoped application table", () => {
  assertSameMembers(USER_DATA_EXPORT_TABLES, EXPECTED_APP_TABLES);
});

runner.test("delete covers the same application tables as export", () => {
  assertSameMembers(USER_DATA_DELETE_ORDER, EXPECTED_APP_TABLES);
});

runner.test("delete order removes charge documents before restricted clients", () => {
  const documents = USER_DATA_DELETE_ORDER.indexOf("charge_documents");
  const clients = USER_DATA_DELETE_ORDER.indexOf("clients");
  assert(documents >= 0 && documents < clients, "charge_documents must be deleted before clients");
});

runner.test("delete order removes child rows before charge documents", () => {
  const documents = USER_DATA_DELETE_ORDER.indexOf("charge_documents");
  for (const child of ["charge_document_lines", "charge_document_payments"] as const) {
    const index = USER_DATA_DELETE_ORDER.indexOf(child);
    assert(index >= 0 && index < documents, `${child} must be deleted before charge_documents`);
  }
});

runner.test("delete statements only interpolate allow-listed table names", () => {
  const statements = buildUserDataDeleteStatements();
  assert(statements.length === USER_DATA_DELETE_ORDER.length, "expected one statement per table");
  statements.forEach((statement, index) => {
    assert(
      statement === `DELETE FROM ${USER_DATA_DELETE_ORDER[index]} WHERE user_id = $1`,
      `unexpected statement: ${statement}`
    );
  });
});

runner.test("the production RLS drift check covers every application data table", () => {
  const source = readFileSync(join(process.cwd(), "scripts", "check-rls.mjs"), "utf8");
  for (const table of USER_DATA_EXPORT_TABLES) {
    assert(source.includes(`"${table}"`), `scripts/check-rls.mjs is missing ${table}`);
  }
});

runner.test("the lifecycle list matches user-scoped tables declared in the schema", () => {
  const source = readFileSync(join(process.cwd(), "src", "db", "schema.ts"), "utf8");
  const matches = source.matchAll(
    /export const \w+ = pgTable\(\s*"([^"]+)"([\s\S]*?)(?=\nexport const |$)/g
  );
  const authTables = new Set(["account", "session"]);
  const schemaUserScopedTables = [...matches]
    .filter((match) => match[2].includes('text("user_id")'))
    .map((match) => match[1])
    .filter((table) => !authTables.has(table));
  // currency_rates was introduced by the hand-written 0005 migration and is
  // not present in the historical Drizzle snapshot/schema declaration.
  const userScopedTables = [...schemaUserScopedTables, "currency_rates"];

  assertSameMembers(USER_DATA_EXPORT_TABLES, userScopedTables);
});

runner.test("all deletion and export routes consume the shared lifecycle source", () => {
  const selfDelete = readFileSync(join(process.cwd(), "app", "api", "account", "route.ts"), "utf8");
  const adminDelete = readFileSync(
    join(process.cwd(), "app", "api", "admin", "users", "[id]", "actions", "route.ts"),
    "utf8"
  );
  const accountExport = readFileSync(
    join(process.cwd(), "app", "api", "account", "export", "route.ts"),
    "utf8"
  );

  assert(selfDelete.includes("deleteUserDatabaseRows"), "self-delete bypasses shared executor");
  assert(adminDelete.includes("deleteUserDatabaseRows"), "admin delete bypasses shared executor");
  assert(accountExport.includes("USER_DATA_EXPORT_TABLES"), "account export bypasses shared tables");
  assert(selfDelete.includes("deleteFile(url)"), "self-delete does not remove stored files");
  assert(adminDelete.includes("deleteFile(url)"), "admin delete does not remove stored files");
});

runner.run();
