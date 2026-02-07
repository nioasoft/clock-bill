/**
 * CSV parsing utilities
 * Shared parser for import routes
 */

/**
 * Parse CSV text into raw lines, handling quoted fields
 */
export function parseCSV(text: string): string[] {
  const lines: string[] = [];
  let currentLine = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentLine += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      currentLine += "\0";
    } else if (char === "\n" && !inQuotes) {
      lines.push(currentLine);
      currentLine = "";
    } else if (char === "\r" && !inQuotes) {
      continue;
    } else {
      currentLine += char;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

/**
 * Parse CSV text into an array of records with header keys
 */
export function parseCSVWithHeaders(text: string): Record<string, string>[] {
  const lines = parseCSV(text);

  if (lines.length < 2) {
    return [];
  }

  const headers = lines[0].split("\0").map((h) => h.trim().replace(/^"|"$/g, ""));

  const records: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split("\0");
    const record: Record<string, string> = {};

    for (let j = 0; j < headers.length && j < values.length; j++) {
      record[headers[j]] = values[j]?.trim().replace(/^"|"$/g, "") || "";
    }

    if (Object.values(record).some((v) => v !== "")) {
      records.push(record);
    }
  }

  return records;
}
