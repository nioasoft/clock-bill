import Link from "next/link";
import { Suspense } from "react";
import { AppLayout } from "@/components/app-layout";
import { Skeleton } from "@/components/ui/skeleton";
import { EmailVerificationNotice } from "@/components/email-verification-notice";

function QuickActionsSkeleton() {
  return (
    <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="rounded-lg bg-white p-6 shadow">
          <Skeleton className="h-5 w-1/2 mb-2" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      ))}
    </div>
  );
}

function QuickActions() {
  return (
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
        href="/projects"
        className="rounded-lg bg-white p-6 shadow hover:shadow-md transition-shadow"
      >
        <h3 className="text-lg font-medium text-gray-900">פרויקטים</h3>
        <p className="mt-2 text-sm text-gray-600">
          נהל את הפרויקטים שלך
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
  );
}

export default function Home() {
  return (
    <AppLayout>
      <div className="px-4 py-8 sm:px-6 lg:px-8">
        {/* Email Verification Notice */}
        <EmailVerificationNotice />

        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900">
            ברוך הבא לשעון!
          </h2>
          <p className="mt-2 text-gray-600">
            נהל את שעות העבודה והפרויקטים שלך בקלות
          </p>
        </div>

        {/* Quick Actions with Suspense for better perceived performance */}
        <Suspense fallback={<QuickActionsSkeleton />}>
          <QuickActions />
        </Suspense>
      </div>
    </AppLayout>
  );
}
