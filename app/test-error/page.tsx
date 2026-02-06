'use client';

import { useState } from 'react';
import { ErrorBoundary } from '@/components/error-boundary';

function BuggyComponent({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('זוהי שגיאת בדיקה - Test error triggered');
  }
  return (
    <div className="p-4 bg-green-50 border rounded">
      <p className="text-green-700">✓ הרכיב עובד כראוי</p>
    </div>
  );
}

export default function TestErrorPage() {
  const [throwError, setThrowError] = useState(false);

  return (
    <div className="container mx-auto p-6 max-w-2xl" dir="rtl">
      <h1 className="text-3xl font-bold mb-4">בדיקת Error Boundaries</h1>
      <p className="text-gray-600 mb-6">
        לחץ על הכפתור כדי להפעיל שגיאה ולראות שה-Error Boundary לוכד אותה.
      </p>

      <div className="bg-white rounded-lg shadow p-6">
        <ErrorBoundary>
          <BuggyComponent shouldThrow={throwError} />
        </ErrorBoundary>

        {!throwError && (
          <button
            onClick={() => setThrowError(true)}
            className="mt-4 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            הפעל שגיאה
          </button>
        )}

        {throwError && (
          <p className="mt-4 text-sm text-gray-500">
            רענן את הדף כדי לנסות שוב
          </p>
        )}
      </div>

      <div className="mt-8 p-4 bg-blue-50 rounded border border-blue-200">
        <h2 className="font-bold mb-2">מידע טכני:</h2>
        <ul className="text-sm space-y-1 text-gray-700">
          <li>• דף זה משמש לבדיקת טיפול בשגיאות</li>
          <li>• שגיאות מודפסות לקונסול (Console)</li>
          <li>• Next.js מספק ממשק שגיאה מובנה</li>
        </ul>
      </div>
    </div>
  );
}
