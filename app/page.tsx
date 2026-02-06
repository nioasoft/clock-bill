import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "../lib/db";
import Link from "next/link";

async function getUser() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("session")?.value;

  if (!sessionToken) {
    return null;
  }

  const db = getDb();
  const session = db.prepare(
    `SELECT s.user_id, s.expires_at, u.email
     FROM sessions s
     JOIN users u ON s.user_id = u.id
     WHERE s.token = ?`
  ).get(sessionToken) as
    | { user_id: string; expires_at: string; email: string }
    | undefined;

  if (!session) {
    return null;
  }

  // Check if session is expired
  const expiresAt = new Date(session.expires_at);
  if (expiresAt < new Date()) {
    return null;
  }

  return {
    id: session.user_id,
    email: session.email,
  };
}

export default async function Home() {
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-zinc-50" dir="rtl">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">שעון</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{user.email}</span>
            <form action="/api/auth/logout" method="POST">
              <button
                type="submit"
                className="text-sm text-orange-600 hover:text-orange-500"
              >
                התנתק
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900">
            ברוך הבא, {user.email}!
          </h2>
          <p className="mt-2 text-gray-600">
            זהו הדשבורד שלך. כאן תוכל לנהל את שעות העבודה והפרויקטים שלך.
          </p>
        </div>

        {/* Quick Actions */}
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Link
            href="/entries"
            className="rounded-lg bg-white p-6 shadow hover:shadow-md transition-shadow"
          >
            <h3 className="text-lg font-medium text-gray-900">רשומות זמן</h3>
            <p className="mt-2 text-sm text-gray-600">
              צפה ונהל את רשומות הזמן שלך
            </p>
          </Link>

          <Link
            href="/clients"
            className="rounded-lg bg-white p-6 shadow hover:shadow-md transition-shadow"
          >
            <h3 className="text-lg font-medium text-gray-900">לקוחות</h3>
            <p className="mt-2 text-sm text-gray-600">
              נהל את הלקוחות שלך
            </p>
          </Link>

          <Link
            href="/reports"
            className="rounded-lg bg-white p-6 shadow hover:shadow-md transition-shadow"
          >
            <h3 className="text-lg font-medium text-gray-900">דוחות</h3>
            <p className="mt-2 text-sm text-gray-600">
              צור דוחות PDF ו-Excel
            </p>
          </Link>
        </div>
      </main>
    </div>
  );
}
