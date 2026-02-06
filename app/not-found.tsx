"use client";

import Link from "next/link";
import { Home, Search } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-white p-4">
      <div className="max-w-md w-full">
        <div className="text-center">
          {/* 404 Number */}
          <div className="mb-6 relative">
            <h1 className="text-9xl font-bold text-orange-500 opacity-20">404</h1>
            <div className="absolute inset-0 flex items-center justify-center">
              <Search className="w-20 h-20 text-orange-500" />
            </div>
          </div>

          {/* Error Message */}
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            העמוד לא נמצא
          </h2>
          <p className="text-gray-600 mb-8">
            אופס! העמוד שחיפשת לא קיים או שהועבר למקום אחר.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-medium shadow-sm"
            >
              <Home className="w-5 h-5" />
              חזרה לדשבורד
            </Link>
            <button
              onClick={() => window.history.back()}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium border border-gray-200 shadow-sm"
            >
              חזור אחורה
            </button>
          </div>

          {/* Helpful Links */}
          <div className="mt-12 pt-8 border-t border-gray-200">
            <p className="text-sm text-gray-500 mb-4">אולי התכוונת ל:</p>
            <div className="flex flex-wrap gap-2 justify-center">
              <Link
                href="/entries"
                className="px-4 py-2 text-sm text-gray-600 hover:text-orange-500 hover:bg-orange-50 rounded-md transition-colors"
              >
                רשומות זמן
              </Link>
              <span className="text-gray-300">•</span>
              <Link
                href="/clients"
                className="px-4 py-2 text-sm text-gray-600 hover:text-orange-500 hover:bg-orange-50 rounded-md transition-colors"
              >
                לקוחות
              </Link>
              <span className="text-gray-300">•</span>
              <Link
                href="/projects"
                className="px-4 py-2 text-sm text-gray-600 hover:text-orange-500 hover:bg-orange-50 rounded-md transition-colors"
              >
                פרויקטים
              </Link>
              <span className="text-gray-300">•</span>
              <Link
                href="/reports"
                className="px-4 py-2 text-sm text-gray-600 hover:text-orange-500 hover:bg-orange-50 rounded-md transition-colors"
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
