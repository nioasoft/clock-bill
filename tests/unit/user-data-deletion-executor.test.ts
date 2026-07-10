import {
  USER_DATA_DELETE_ORDER,
  deleteUserDatabaseRows,
} from "../../lib/user-data-lifecycle";
import type { PoolClient } from "pg";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const expectedSql = [
  ...USER_DATA_DELETE_ORDER.map((table) => `DELETE FROM ${table} WHERE user_id = $1`),
  'DELETE FROM "session" WHERE user_id = $1',
  'DELETE FROM "account" WHERE user_id = $1',
  'DELETE FROM "user" WHERE id = $1',
];

async function main(): Promise<void> {
  const calls: Array<{ text: string; params?: unknown[] }> = [];
  const client = {
    query: async (text: string, params?: unknown[]) => {
      calls.push({ text, params });
      return { rowCount: 1, rows: [] };
    },
  } as unknown as PoolClient;
  const userId = "user_target";

  await deleteUserDatabaseRows(client, userId);

  assert(calls.length === expectedSql.length, `expected ${expectedSql.length} queries, got ${calls.length}`);
  calls.forEach((call, index) => {
    assert(call.text === expectedSql[index], `query ${index + 1} was ${call.text}`);
    assert(call.params?.length === 1 && call.params[0] === userId, `query ${index + 1} lost user scope`);
  });

  console.log("  ✅ shared deletion executor keeps child-first order and explicit user scope");
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
