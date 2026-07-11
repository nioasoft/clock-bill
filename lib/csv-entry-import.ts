export const CSV_IMPORT_MAX_FILE_BYTES = 1_000_000;
export const CSV_IMPORT_MAX_ROWS = 200;
export const CSV_IMPORT_BATCH_SIZE = 100;

export type CsvImportErrorCode =
  | "emptyFile"
  | "fileTooLarge"
  | "tooManyRows"
  | "missingHeaders"
  | "malformedCsv"
  | "missingDate"
  | "invalidDate"
  | "missingProject"
  | "projectNotFound"
  | "projectAmbiguous"
  | "missingDescription"
  | "descriptionTooLong"
  | "invalidDuration"
  | "notesTooLong"
  | "invalidBillable"
  | "invalidRate"
  | "duplicateRow";

export interface ImportProject {
  id: string;
  name: string;
  clientName: string;
}

export interface CsvImportEntry {
  projectId: string;
  date: string;
  duration: number;
  description: string;
  notes: string | null;
  isBillable: boolean;
  rate: number | null;
}

export interface CsvImportRow {
  rowNumber: number;
  client: string;
  project: string;
  date: string;
  duration: string;
  description: string;
  notes: string;
  billable: string;
  rate: string;
  projectId: string | null;
  normalized: CsvImportEntry | null;
  errors: CsvImportErrorCode[];
}

export type CsvImportParseResult =
  | { ok: true; rows: CsvImportRow[] }
  | { ok: false; error: CsvImportErrorCode; missingHeaders?: string[] };

type CanonicalHeader =
  | "date"
  | "client"
  | "project"
  | "description"
  | "duration"
  | "notes"
  | "billable"
  | "rate";

const HEADER_ALIASES: Record<string, CanonicalHeader> = {
  date: "date",
  "תאריך": "date",
  client: "client",
  "לקוח": "client",
  project: "project",
  "פרויקט": "project",
  description: "description",
  details: "description",
  "תיאור": "description",
  "פירוט": "description",
  duration_minutes: "duration",
  duration: "duration",
  minutes: "duration",
  "משך_בדקות": "duration",
  "משך": "duration",
  notes: "notes",
  "הערות": "notes",
  billable: "billable",
  "לחיוב": "billable",
  rate: "rate",
  hourly_rate: "rate",
  "תעריף": "rate",
};

const REQUIRED_HEADERS: CanonicalHeader[] = ["date", "project", "description", "duration"];

function normalizeHeader(value: string): string {
  return value.replace(/^\uFEFF/, "").trim().toLocaleLowerCase("en-US").replace(/[ -]+/g, "_");
}

function parseCsvGrid(input: string): string[][] | null {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (quoted) {
      if (character === '"' && input[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"' && field.length === 0) {
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && input[index + 1] === "\n") index += 1;
      row.push(field);
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }

  if (quoted) return null;
  row.push(field);
  if (row.some((value) => value.trim() !== "")) rows.push(row);
  return rows;
}

function normalizeDate(raw: string): string | null {
  const value = raw.trim();
  let year: number;
  let month: number;
  let day: number;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const local = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/.exec(value);
  if (iso) {
    [, year, month, day] = iso.map(Number);
  } else if (local) {
    day = Number(local[1]);
    month = Number(local[2]);
    year = Number(local[3]);
  } else {
    return null;
  }
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    return null;
  }
  const timestamp = candidate.getTime();
  const now = Date.now();
  if (timestamp < now - 2 * 365 * 24 * 60 * 60 * 1000 || timestamp > now + 24 * 60 * 60 * 1000) {
    return null;
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseBillable(raw: string): boolean | null {
  const value = raw.trim().toLocaleLowerCase("en-US");
  if (!value || ["true", "yes", "y", "1", "כן"].includes(value)) return true;
  if (["false", "no", "n", "0", "לא"].includes(value)) return false;
  return null;
}

function projectMatches(projects: ImportProject[], projectName: string, clientName: string) {
  const projectNeedle = projectName.trim().toLocaleLowerCase();
  const clientNeedle = clientName.trim().toLocaleLowerCase();
  return projects.filter(
    (project) =>
      project.name.trim().toLocaleLowerCase() === projectNeedle &&
      (!clientNeedle || project.clientName.trim().toLocaleLowerCase() === clientNeedle)
  );
}

function getCell(row: string[], headers: Map<CanonicalHeader, number>, header: CanonicalHeader) {
  const index = headers.get(header);
  return index === undefined ? "" : (row[index] ?? "").trim();
}

export function parseEntryCsv(
  input: string,
  projects: ImportProject[],
  fileSize = new Blob([input]).size
): CsvImportParseResult {
  if (fileSize > CSV_IMPORT_MAX_FILE_BYTES) return { ok: false, error: "fileTooLarge" };
  const grid = parseCsvGrid(input);
  if (!grid) return { ok: false, error: "malformedCsv" };
  if (grid.length < 2) return { ok: false, error: "emptyFile" };
  if (grid.length - 1 > CSV_IMPORT_MAX_ROWS) return { ok: false, error: "tooManyRows" };

  const headers = new Map<CanonicalHeader, number>();
  grid[0].forEach((header, index) => {
    const canonical = HEADER_ALIASES[normalizeHeader(header)];
    if (canonical && !headers.has(canonical)) headers.set(canonical, index);
  });
  const missingHeaders = REQUIRED_HEADERS.filter((header) => !headers.has(header));
  if (missingHeaders.length > 0) {
    return { ok: false, error: "missingHeaders", missingHeaders };
  }

  const fingerprints = new Set<string>();
  const rows = grid.slice(1).map((cells, rowIndex): CsvImportRow => {
    const date = getCell(cells, headers, "date");
    const client = getCell(cells, headers, "client");
    const project = getCell(cells, headers, "project");
    const description = getCell(cells, headers, "description");
    const duration = getCell(cells, headers, "duration");
    const notes = getCell(cells, headers, "notes");
    const billable = getCell(cells, headers, "billable");
    const rate = getCell(cells, headers, "rate");
    const errors: CsvImportErrorCode[] = [];
    const normalizedDate = date ? normalizeDate(date) : null;
    const durationNumber = Number(duration);
    const rateNumber = rate === "" ? null : Number(rate);
    const billableValue = parseBillable(billable);
    const matches = project ? projectMatches(projects, project, client) : [];

    if (!date) errors.push("missingDate");
    else if (!normalizedDate) errors.push("invalidDate");
    if (!project) errors.push("missingProject");
    else if (matches.length === 0) errors.push("projectNotFound");
    else if (matches.length > 1) errors.push("projectAmbiguous");
    if (!description) errors.push("missingDescription");
    else if (description.length > 5000) errors.push("descriptionTooLong");
    if (!duration || !Number.isInteger(durationNumber) || durationNumber < 1 || durationNumber > 1440) {
      errors.push("invalidDuration");
    }
    if (notes.length > 5000) errors.push("notesTooLong");
    if (billableValue === null) errors.push("invalidBillable");
    if (rateNumber !== null && (!Number.isFinite(rateNumber) || rateNumber < 0 || rateNumber > 1_000_000)) {
      errors.push("invalidRate");
    }

    const projectId = matches.length === 1 ? matches[0].id : null;
    const fingerprint = [projectId, normalizedDate, durationNumber, description, notes, billableValue, rateNumber].join("\u001f");
    if (errors.length === 0 && fingerprints.has(fingerprint)) errors.push("duplicateRow");
    if (errors.length === 0) fingerprints.add(fingerprint);

    const normalized =
      errors.length === 0 && projectId && normalizedDate && billableValue !== null
        ? {
            projectId,
            date: normalizedDate,
            duration: durationNumber,
            description,
            notes: notes || null,
            isBillable: billableValue,
            rate: rateNumber,
          }
        : null;

    return {
      rowNumber: rowIndex + 2,
      client,
      project,
      date,
      duration,
      description,
      notes,
      billable,
      rate,
      projectId,
      normalized,
      errors,
    };
  });

  return { ok: true, rows };
}
