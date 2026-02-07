"use client";

import Link from "next/link";
import { Home, Search } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-background p-4">
      <div className="max-w-md w-full">
        <div className="text-center">
          {/* 404 Number */}
          <div className="mb-6 relative">
            <h1 className="text-9xl font-bold text-primary opacity-20">404</h1>
            <div className="absolute inset-0 flex items-center justify-center">
              <Search className="w-20 h-20 text-primary" />
            </div>
          </div>

          {/* Error Message */}
          <h2 className="text-2xl font-bold text-foreground mb-2">
            העמוד לא נמצא
          </h2>
          <p className="text-muted-foreground mb-8">
            אופס! העמוד שחיפשת לא קיים או שהועבר למקום אחר.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-medium shadow-sm"
            >
              <Home className="w-5 h-5" />
              חזרה לדשבורד
            </Link>
            <button
              onClick={() => window.history.back()}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white text-muted-foreground rounded-lg hover:bg-muted/50 transition-colors font-medium border border-border shadow-sm"
            >
              חזור אחורה
            </button>
          </div>

          {/* Helpful Links */}
          <div className="mt-12 pt-8 border-t border-border">
            <p className="text-sm text-muted-foreground mb-4">אולי התכוונת ל:</p>
            <div className="flex flex-wrap gap-2 justify-center">
              <Link
                href="/entries"
                className="px-4 py-2 text-sm text-muted-foreground hover:text-primary hover:bg-primary-light rounded-md transition-colors"
              >
                רשומות זמן
              </Link>
              <span className="text-border">•</span>
              <Link
                href="/clients"
                className="px-4 py-2 text-sm text-muted-foreground hover:text-primary hover:bg-primary-light rounded-md transition-colors"
              >
                לקוחות
              </Link>
              <span className="text-border">•</span>
              <Link
                href="/projects"
                className="px-4 py-2 text-sm text-muted-foreground hover:text-primary hover:bg-primary-light rounded-md transition-colors"
              >
                פרויקטים
              </Link>
              <span className="text-border">•</span>
              <Link
                href="/reports"
                className="px-4 py-2 text-sm text-muted-foreground hover:text-primary hover:bg-primary-light rounded-md transition-colors"
              >
                דוחות
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
