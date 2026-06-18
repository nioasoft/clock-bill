'use client';

import { useEffect } from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';
import { createLogger } from '@/lib/logger';

const log = createLogger('global-error');

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    log.error('Unhandled global error', error, {
      action: 'global_error',
      digest: error.digest,
      route: typeof window !== 'undefined' ? window.location.pathname : undefined,
    });
  }, [error]);

  return (
    <html lang="he" dir="rtl">
      <body>
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-destructive/5 via-primary/5 to-background p-4">
          <div className="max-w-2xl w-full">
            <div className="text-center bg-card rounded-2xl shadow-xl p-8 md:p-12">
              <div className="mb-6 flex justify-center">
                <div className="relative">
                  <div className="w-24 h-24 bg-destructive/10 rounded-full flex items-center justify-center">
                    <AlertCircle className="w-12 h-12 text-destructive" />
                  </div>
                  <div className="absolute -top-2 -right-2 w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-bold">!</span>
                  </div>
                </div>
              </div>

              <h1 className="text-3xl font-bold text-foreground mb-3">
                משהו השתבש
              </h1>

              <p className="text-muted-foreground mb-6 text-lg">
                אירעה שגיאה בלתי צפויה באפליקציה. אנו מצטערים על אי הנוחות.
              </p>

              {process.env.NODE_ENV === 'development' && error.message && (
                <div className="mb-6 p-4 bg-destructive/5 border border-destructive/20 rounded-lg">
                  <p className="text-sm text-destructive/80 font-mono text-right" dir="ltr">
                    {error.message}
                  </p>
                  {error.digest && (
                    <p className="text-xs text-destructive/70 mt-2 font-mono">
                      Error ID: {error.digest}
                    </p>
                  )}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={reset}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium shadow-sm"
                >
                  <RefreshCw className="w-5 h-5" />
                  נסה שוב
                </button>
                <Link
                  href="/"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-card text-muted-foreground rounded-lg hover:bg-muted/50 transition-colors font-medium border border-border shadow-sm"
                >
                  <Home className="w-5 h-5" />
                  דף בית
                </Link>
              </div>

              <div className="mt-8 pt-6 border-t border-border">
                <p className="text-sm text-muted-foreground mb-2">
                  אם השגיאה ממשיכה להופיע, אנא:
                </p>
                <ul className="text-sm text-muted-foreground space-y-1 text-right">
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
