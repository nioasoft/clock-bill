'use client';

import { useEffect } from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';
import { logError } from '@/lib/error-logging';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logError(error, {
      action: 'global_error',
      route: typeof window !== 'undefined' ? window.location.pathname : undefined,
    });
  }, [error]);

  return (
    <html lang="he" dir="rtl">
      <body>
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 via-orange-50 to-white p-4">
          <div className="max-w-2xl w-full">
            <div className="text-center bg-white rounded-2xl shadow-xl p-8 md:p-12">
              <div className="mb-6 flex justify-center">
                <div className="relative">
                  <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center">
                    <AlertCircle className="w-12 h-12 text-red-500" />
                  </div>
                  <div className="absolute -top-2 -right-2 w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-bold">!</span>
                  </div>
                </div>
              </div>

              <h1 className="text-3xl font-bold text-gray-900 mb-3">
                משהו השתבש
              </h1>

              <p className="text-gray-600 mb-6 text-lg">
                אירעה שגיאה בלתי צפויה באפליקציה. אנו מצטערים על אי הנוחות.
              </p>

              {process.env.NODE_ENV === 'development' && error.message && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700 font-mono text-right" dir="ltr">
                    {error.message}
                  </p>
                  {error.digest && (
                    <p className="text-xs text-red-600 mt-2 font-mono">
                      Error ID: {error.digest}
                    </p>
                  )}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={reset}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-medium shadow-sm"
                >
                  <RefreshCw className="w-5 h-5" />
                  נסה שוב
                </button>
                <Link
                  href="/"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium border border-gray-200 shadow-sm"
                >
                  <Home className="w-5 h-5" />
                  דף בית
                </Link>
              </div>

              <div className="mt-8 pt-6 border-t border-gray-200">
                <p className="text-sm text-gray-500 mb-2">
                  אם השגיאה ממשיכה להופיע, אנא:
                </p>
                <ul className="text-sm text-gray-600 space-y-1 text-right">
                  <li>• נסה לרענן את הדפדפן</li>
                  <li>• נקה את המטמון של הדפדפן</li>
                  <li>• פנה לתמיכה דרך כתובת המייל שלך</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
