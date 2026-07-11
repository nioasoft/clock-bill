export interface ImportedTransaction {
  id: string;
  paidAt: string;
  amount: number;
  currency: string;
  reference: string;
  description: string;
}

export interface ReconciliationCandidate {
  id: string;
  documentNumber: number;
  clientName: string;
  issuedAt: string | null;
  currency: string;
  outstanding: number;
}

const HEADER_ALIASES = {
  date: ["date", "transaction date", "paid at", "תאריך", "תאריך עסקה"],
  amount: ["amount", "credit", "deposit", "סכום", "זכות"],
  currency: ["currency", "מטבע"],
  reference: ["reference", "ref", "document", "אסמכתא", "מספר מסמך"],
  description: ["description", "details", "memo", "תיאור", "פרטים"],
} as const;

function csvRows(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (char === '"') {
      if (quoted && input[i + 1] === '"') { cell += '"'; i += 1; }
      else quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell.trim()); cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && input[i + 1] === "\n") i += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = []; cell = "";
    } else cell += char;
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function findColumn(headers: string[], aliases: readonly string[]): number {
  return headers.findIndex((header) => aliases.includes(header.toLocaleLowerCase() as never));
}

function parseDate(value: string): string | null {
  const clean = value.trim();
  const isoMatch = clean.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const localMatch = clean.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (!isoMatch && !localMatch) return null;
  const year = Number(isoMatch?.[1] ?? localMatch?.[3]);
  const month = Number(isoMatch?.[2] ?? localMatch?.[2]);
  const day = Number(isoMatch?.[3] ?? localMatch?.[1]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseAmount(value: string): number | null {
  const negative = /^\s*\(.*\)\s*$/.test(value);
  const normalized = value.replace(/[()₪$€£\s]/g, "").replace(/,/g, "");
  const amount = Number(normalized) * (negative ? -1 : 1);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

export function parseReconciliationCsv(input: string): ImportedTransaction[] {
  if (input.length > 1_000_000) throw new Error("FILE_TOO_LARGE");
  const rows = csvRows(input.replace(/^\uFEFF/, ""));
  if (rows.length < 2) throw new Error("EMPTY_FILE");
  if (rows.length > 501) throw new Error("TOO_MANY_ROWS");
  const headers = rows[0].map((value) => value.toLocaleLowerCase());
  const dateIndex = findColumn(headers, HEADER_ALIASES.date);
  const amountIndex = findColumn(headers, HEADER_ALIASES.amount);
  if (dateIndex < 0 || amountIndex < 0) throw new Error("MISSING_COLUMNS");
  const currencyIndex = findColumn(headers, HEADER_ALIASES.currency);
  const referenceIndex = findColumn(headers, HEADER_ALIASES.reference);
  const descriptionIndex = findColumn(headers, HEADER_ALIASES.description);

  return rows.slice(1).map((row, index) => {
    const paidAt = parseDate(row[dateIndex] ?? "");
    const amount = parseAmount(row[amountIndex] ?? "");
    if (!paidAt || amount === null) throw new Error(`INVALID_ROW:${index + 2}`);
    return {
      id: String(index + 1),
      paidAt,
      amount,
      currency: (currencyIndex >= 0 ? row[currencyIndex] : "ILS")?.toUpperCase() || "ILS",
      reference: referenceIndex >= 0 ? row[referenceIndex] ?? "" : "",
      description: descriptionIndex >= 0 ? row[descriptionIndex] ?? "" : "",
    };
  });
}

function normalized(value: string): string {
  return value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

export function suggestCandidate(
  transaction: ImportedTransaction,
  candidates: ReconciliationCandidate[]
): ReconciliationCandidate | null {
  const reference = normalized(`${transaction.reference} ${transaction.description}`);
  const scored = candidates
    .filter((candidate) => candidate.currency === transaction.currency && candidate.outstanding + 0.005 >= transaction.amount)
    .map((candidate) => {
      let score = Math.abs(candidate.outstanding - transaction.amount) < 0.005 ? 50 : 0;
      if (reference.includes(String(candidate.documentNumber))) score += 100;
      if (reference.includes(normalized(candidate.clientName))) score += 40;
      return { candidate, score };
    })
    .sort((a, b) => b.score - a.score || a.candidate.outstanding - b.candidate.outstanding);
  if (!scored[0] || scored[0].score === 0) return null;
  if (scored[1]?.score === scored[0].score) return null;
  return scored[0].candidate;
}

export function makeReconciliationKey(batchId: string, rowId: string, documentId: string): string {
  return `recon:${batchId}:${rowId}:${documentId}`.slice(0, 200);
}
