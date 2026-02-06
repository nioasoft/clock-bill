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

// POST /api/import/entries - Import time entries from CSV
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
      projectName: columnMapping.projectName || "project_name",
      description: columnMapping.description || "description",
      date: columnMapping.date || "date",
      duration: columnMapping.duration || "duration",
      startTime: columnMapping.startTime || "start_time",
      endTime: columnMapping.endTime || "end_time",
      tags: columnMapping.tags || "tags",
      notes: columnMapping.notes || "notes",
      isBillable: columnMapping.isBillable || "is_billable",
    };

    // Validate that required fields are mapped
    if (!fieldMapping.projectName || !fieldMapping.description || !fieldMapping.date) {
      return NextResponse.json(
        { success: false, message: "יש למפות את שדות 'שם הפרויקט', 'תיאור', ו-'תאריך'" },
        { status: 400 }
      );
    }

    // Get user's projects to map project names to IDs
    const projectsResult = await query(
      `SELECT id, name FROM projects WHERE user_id = $1`,
      [userId]
    );

    const projectMap = new Map<string, string>();
    for (const project of projectsResult.rows) {
      projectMap.set(project.name as string, project.id as string);
    }

    // Process and insert entries
    const importedEntries = [];
    const errors = [];

    for (let i = 0; i < records.length; i++) {
      const record = records[i] as Record<string, string>;

      try {
        // Extract data from CSV record using column mapping
        const projectName = record[fieldMapping.projectName]?.trim();
        const description = record[fieldMapping.description]?.trim();
        const dateStr = record[fieldMapping.date]?.trim();
        const durationStr = record[fieldMapping.duration]?.trim();
        const startTimeStr = record[fieldMapping.startTime]?.trim();
        const endTimeStr = record[fieldMapping.endTime]?.trim();
        const tagsStr = record[fieldMapping.tags]?.trim();
        const notes = record[fieldMapping.notes]?.trim() || null;
        const isBillableStr = record[fieldMapping.isBillable]?.trim();

        // Validate required fields
        if (!projectName) {
          errors.push({ row: i + 1, message: "שם הפרויקט חסר" });
          continue;
        }

        if (!description) {
          errors.push({ row: i + 1, message: "התיאור חסר" });
          continue;
        }

        if (!dateStr) {
          errors.push({ row: i + 1, message: "התאריך חסר" });
          continue;
        }

        // Find project ID
        const projectId = projectMap.get(projectName);
        if (!projectId) {
          errors.push({ row: i + 1, message: `הפרויקט '${projectName}' לא נמצא` });
          continue;
        }

        // Parse date
        const entryDate = new Date(dateStr);
        if (isNaN(entryDate.getTime())) {
          errors.push({ row: i + 1, message: "תאריך לא תקין" });
          continue;
        }

        // Parse duration or start/end times
        let duration = 0;
        let startTime: Date | null = null;
        let endTime: Date | null = null;

        if (durationStr) {
          // Duration is provided (in minutes or hours)
          duration = parseFloat(durationStr);
          if (isNaN(duration)) {
            errors.push({ row: i + 1, message: "משך זמן לא תקין" });
            continue;
          }

          // If duration looks like it's in hours (e.g., "2.5" or "2:30"), convert to minutes
          if (durationStr.includes(":")) {
            const parts = durationStr.split(":");
            if (parts.length === 2) {
              const hours = parseInt(parts[0], 10);
              const minutes = parseInt(parts[1], 10);
              duration = hours * 60 + minutes;
            }
          } else if (duration < 1000) {
            // Assume it's in hours, convert to minutes
            duration = duration * 60;
          }
        } else if (startTimeStr && endTimeStr) {
          // Start and end times are provided
          startTime = new Date(`${dateStr}T${startTimeStr}`);
          endTime = new Date(`${dateStr}T${endTimeStr}`);

          if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
            errors.push({ row: i + 1, message: "שעות התחלה/סיום לא תקינות" });
            continue;
          }

          // Calculate duration in minutes
          duration = Math.round((endTime.getTime() - startTime.getTime()) / 60000);
        } else {
          errors.push({ row: i + 1, message: "יש לספק משך זמן או שעות התחלה/סיום" });
          continue;
        }

        // Parse tags
        let tags: string[] = [];
        if (tagsStr) {
          tags = tagsStr.split(",").map((t) => t.trim()).filter(Boolean);
        }

        // Parse isBillable
        let isBillable = true;
        if (isBillableStr) {
          isBillable = isBillableStr.toLowerCase() === "true" ||
                        isBillableStr.toLowerCase() === "yes" ||
                        isBillableStr === "1" ||
                        isBillableStr.toLowerCase() === "כן";
        }

        // Generate ID and insert
        const id = `entry_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

        await query(
          `INSERT INTO time_entries (id, user_id, project_id, description, start_time, end_time, duration, date, tags, notes, is_billable, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())`,
          [
            id,
            userId,
            projectId,
            description,
            startTime,
            endTime,
            Math.round(duration),
            entryDate,
            JSON.stringify(tags),
            notes,
            isBillable,
          ]
        );

        importedEntries.push({
          id,
          projectName,
          description,
          date: dateStr,
          duration: Math.round(duration),
        });
      } catch (error) {
        console.error(`Error importing entry at row ${i + 1}:`, error);
        errors.push({ row: i + 1, message: "שגיאה בייבוא הרשומה" });
      }
    }

    return NextResponse.json({
      success: true,
      message: `יובאו בהצלחה ${importedEntries.length} רשומות זמן`,
      imported: importedEntries.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Error importing entries:", error);
    return NextResponse.json(
      { success: false, message: "שגיאה בייבוא רשומות הזמן" },
      { status: 500 }
    );
  }
}
