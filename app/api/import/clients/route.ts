import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { query } from "@/lib/db";

// Simple CSV parser function
function parseCSV(text: string): string[] {
  const lines: string[] = [];
  let currentLine = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        currentLine += '"';
        i++;
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      currentLine += "\0"; // Use null character as separator
    } else if (char === "\n" && !inQuotes) {
      lines.push(currentLine);
      currentLine = "";
    } else if (char === "\r" && !inQuotes) {
      // Skip carriage return
      continue;
    } else {
      currentLine += char;
    }
  }

  // Add last line
  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

function parseCSVWithHeaders(text: string): Record<string, string>[] {
  const lines = parseCSV(text);

  if (lines.length < 2) {
    return [];
  }

  // Parse headers
  const headers = lines[0].split("\0").map((h) => h.trim().replace(/^"|"$/g, ""));

  // Parse data rows
  const records: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split("\0");
    const record: Record<string, string> = {};

    for (let j = 0; j < headers.length && j < values.length; j++) {
      record[headers[j]] = values[j]?.trim().replace(/^"|"$/g, "") || "";
    }

    // Skip empty rows
    if (Object.values(record).some((v) => v !== "")) {
      records.push(record);
    }
  }

  return records;
}

// POST /api/import/clients - Import clients from CSV
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ success: false, message: "לא מחובר" }, { status: 401 });
    }

    const userId = user.id;

    // Parse form data
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ success: false, message: "לא צורף קובץ" }, { status: 400 });
    }

    // Validate file type
    if (!file.name.endsWith(".csv")) {
      return NextResponse.json({ success: false, message: "הקובץ חייב להיות בפורמט CSV" }, { status: 400 });
    }

    // Read file content
    const text = await file.text();

    // Parse CSV with simple parser
    const records = parseCSVWithHeaders(text);

    if (!records || records.length === 0) {
      return NextResponse.json({ success: false, message: "הקובץ ריק או לא תקין" }, { status: 400 });
    }

    // Get column mapping from form data
    const columnMapping = JSON.parse(formData.get("columnMapping") as string || "{}");

    // Map CSV columns to database fields
    const fieldMapping: Record<string, string> = {
      name: columnMapping.name || "name",
      contactName: columnMapping.contactName || "contact_name",
      email: columnMapping.email || "email",
      phone: columnMapping.phone || "phone",
      address: columnMapping.address || "address",
      defaultRate: columnMapping.defaultRate || "default_rate",
      notes: columnMapping.notes || "notes",
    };

    // Validate that required field is mapped
    if (!fieldMapping.name) {
      return NextResponse.json(
        { success: false, message: "יש למפות את שדה 'שם הלקוח'" },
        { status: 400 }
      );
    }

    // Process and insert clients
    const importedClients = [];
    const errors = [];

    for (let i = 0; i < records.length; i++) {
      const record = records[i] as Record<string, string>;

      try {
        // Extract data from CSV record using column mapping
        const name = record[fieldMapping.name]?.trim();
        const contactName = record[fieldMapping.contactName]?.trim() || null;
        const email = record[fieldMapping.email]?.trim() || null;
        const phone = record[fieldMapping.phone]?.trim() || null;
        const address = record[fieldMapping.address]?.trim() || null;
        const defaultRate = record[fieldMapping.defaultRate]?.trim() || null;
        const notes = record[fieldMapping.notes]?.trim() || null;

        // Validate required fields
        if (!name) {
          errors.push({ row: i + 1, message: "שם הלקוח חסר" });
          continue;
        }

        // Parse rate if provided
        let parsedRate: number | null = null;
        if (defaultRate) {
          parsedRate = parseFloat(defaultRate);
          if (isNaN(parsedRate)) {
            errors.push({ row: i + 1, message: "שעור שעהי לא תקין" });
            continue;
          }
        }

        // Generate ID and insert
        const id = `client_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

        await query(
          `INSERT INTO clients (id, user_id, name, contact_name, email, phone, address, default_rate, notes, is_active, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())`,
          [
            id,
            userId,
            name,
            contactName,
            email,
            phone,
            address,
            parsedRate,
            notes,
            true,
          ]
        );

        importedClients.push({
          id,
          name,
          contactName,
          email,
          phone,
        });
      } catch (error) {
        console.error(`Error importing client at row ${i + 1}:`, error);
        errors.push({ row: i + 1, message: "שגיאה בייבוא הלקוח" });
      }
    }

    return NextResponse.json({
      success: true,
      message: `יובאו בהצלחה ${importedClients.length} לקוחות`,
      imported: importedClients.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Error importing clients:", error);
    return NextResponse.json(
      { success: false, message: "שגיאה בייבוא הלקוחות" },
      { status: 500 }
    );
  }
}
