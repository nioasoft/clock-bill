import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const q = searchParams.get("q");

    if (!q || q.trim().length < 2) {
      return NextResponse.json({
        success: true,
        results: [],
      });
    }

    const user = await getUser();
    if (!user) {
      return NextResponse.json({
        success: true,
        results: [],
      });
    }

    const searchTerm = `%${q.trim()}%`;
    const results: any[] = [];

    const { query } = await import("@/lib/db");

    // Search clients
    const clientsResult = await query(
      `SELECT id, name
       FROM clients
       WHERE user_id = $1
         AND is_active = true
         AND name ILIKE $2
       ORDER BY name
       LIMIT 5`,
      [user.id, searchTerm]
    );

    for (const client of clientsResult.rows) {
      results.push({
        id: client.id,
        type: "client",
        name: client.name,
        url: `/clients/${client.id}`,
      });
    }

    // Search projects (with client name)
    const projectsResult = await query(
      `SELECT p.id, p.name, c.name as client_name
       FROM projects p
       JOIN clients c ON p.client_id = c.id
       WHERE p.user_id = $1
         AND c.is_active = true
         AND p.name ILIKE $2
       ORDER BY p.name
       LIMIT 5`,
      [user.id, searchTerm]
    );

    for (const project of projectsResult.rows) {
      results.push({
        id: project.id,
        type: "project",
        name: project.name,
        clientName: project.client_name,
        url: `/projects/${project.id}`,
      });
    }

    // Search time entries (by description, notes, and tags)
    const entriesResult = await query(
      `SELECT e.id, e.description, e.date, e.duration, p.name as project_name, c.name as client_name
       FROM time_entries e
       JOIN projects p ON e.project_id = p.id
       JOIN clients c ON p.client_id = c.id
       WHERE e.user_id = $1
         AND c.is_active = true
         AND (e.description ILIKE $2 OR e.notes ILIKE $2 OR e.tags::text ILIKE $2)
       ORDER BY e.date DESC, e.start_time DESC
       LIMIT 5`,
      [user.id, searchTerm]
    );

    for (const entry of entriesResult.rows) {
      results.push({
        id: entry.id,
        type: "entry",
        name: entry.description,
        date: entry.date,
        duration: entry.duration,
        projectName: entry.project_name,
        clientName: entry.client_name,
        url: `/entries?entry=${entry.id}`,
      });
    }

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error) {
    console.error("Search API error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "שגיאה בחיפוש",
      },
      { status: 500 }
    );
  }
}
