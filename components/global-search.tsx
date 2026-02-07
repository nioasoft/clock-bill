"use client";

import { useState, useEffect, useRef } from "react";
import { Search, Users, FolderKanban, Clock, X } from "lucide-react";
import { useRouter } from "next/navigation";

interface SearchResult {
  id: string;
  type: "client" | "project" | "entry";
  name: string;
  clientName?: string; // For projects and entries
  projectName?: string; // For entries
  date?: string; // For entries
  duration?: number; // For entries
  url: string;
}

export function GlobalSearch() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close search when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Focus input when opening
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Handle keyboard shortcut (Cmd+K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (event.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Search API call
  useEffect(() => {
    const search = async () => {
      if (query.trim().length < 2) {
        setResults([]);
        return;
      }

      setLoading(true);
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`);
        const data = await response.json();

        if (data.success) {
          setResults(data.results || []);
        }
      } catch (error) {
        console.error("Search error:", error);
        setResults([]);
      } finally {
        setLoading(false);
      }
    };

    const debounceTimer = setTimeout(search, 300);
    return () => clearTimeout(debounceTimer);
  }, [query]);

  const handleResultClick = (result: SearchResult) => {
    router.push(result.url);
    setIsOpen(false);
    setQuery("");
    setResults([]);
  };

  const handleClose = () => {
    setIsOpen(false);
    setQuery("");
    setResults([]);
  };

  return (
    <>
      {/* Search Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 w-full px-4 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
      >
        <Search className="h-4 w-4" />
        <span>חיפוש...</span>
        <kbd className="ms-auto hidden sm:inline-block px-2 py-0.5 text-xs font-semibold text-gray-400 bg-gray-100 border border-gray-200 rounded">
          ⌘K
        </kbd>
      </button>

      {/* Search Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 sm:pt-32 px-4">
          {/* Backdrop */}
          <div className="fixed inset-0 bg-black/20" onClick={handleClose} />

          {/* Search Modal */}
          <div
            ref={searchRef}
            className="relative w-full max-w-2xl bg-white rounded-xl shadow-2xl overflow-hidden"
            dir="rtl"
          >
            {/* Search Input */}
            <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-200">
              <Search className="h-5 w-5 text-gray-400 flex-shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="חפש לקוחות, פרויקטים, רשומות זמן..."
                className="flex-1 text-lg text-gray-900 placeholder-gray-400 focus:outline-none"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
              <kbd className="hidden sm:inline-block px-2 py-1 text-xs font-semibold text-gray-400 bg-gray-100 border border-gray-200 rounded">
                ESC
              </kbd>
            </div>

            {/* Search Results */}
            <div className="max-h-[60vh] overflow-y-auto">
              {query.length < 2 ? (
                <div className="px-4 py-12 text-center text-gray-500">
                  <Search className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-lg font-medium">התחל להקליד לחיפוש</p>
                  <p className="text-sm mt-1">חפש לקוחות, פרויקטים ורשומות זמן לפי שם</p>
                </div>
              ) : loading ? (
                <div className="px-4 py-12 text-center text-gray-500">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-3 border-gray-300 border-t-orange-600" />
                  <p className="mt-3">מחפש...</p>
                </div>
              ) : results.length === 0 ? (
                <div className="px-4 py-12 text-center text-gray-500">
                  <Search className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-lg font-medium">לא נמצאו תוצאות</p>
                  <p className="text-sm mt-1">נסה לחפש מילים אחרות</p>
                </div>
              ) : (
                <div className="py-2">
                  {/* Clients Section */}
                  {results.filter((r) => r.type === "client").length > 0 && (
                    <div className="px-4 py-2">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                        לקוחות
                      </p>
                      {results
                        .filter((r) => r.type === "client")
                        .map((result) => (
                          <button
                            key={result.id}
                            onClick={() => handleResultClick(result)}
                            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors text-start"
                          >
                            <div className="flex-shrink-0 w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                              <Users className="h-5 w-5 text-orange-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {result.name}
                              </p>
                            </div>
                          </button>
                        ))}
                    </div>
                  )}

                  {/* Projects Section */}
                  {results.filter((r) => r.type === "project").length > 0 && (
                    <div className="px-4 py-2 mt-2">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                        פרויקטים
                      </p>
                      {results
                        .filter((r) => r.type === "project")
                        .map((result) => (
                          <button
                            key={result.id}
                            onClick={() => handleResultClick(result)}
                            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors text-start"
                          >
                            <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                              <FolderKanban className="h-5 w-5 text-blue-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {result.name}
                              </p>
                              {result.clientName && (
                                <p className="text-xs text-gray-500 truncate">
                                  {result.clientName}
                                </p>
                              )}
                            </div>
                          </button>
                        ))}
                    </div>
                  )}

                  {/* Time Entries Section */}
                  {results.filter((r) => r.type === "entry").length > 0 && (
                    <div className="px-4 py-2 mt-2">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                        רשומות זמן
                      </p>
                      {results
                        .filter((r) => r.type === "entry")
                        .map((result) => (
                          <button
                            key={result.id}
                            onClick={() => handleResultClick(result)}
                            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors text-start"
                          >
                            <div className="flex-shrink-0 w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                              <Clock className="h-5 w-5 text-green-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {result.name}
                              </p>
                              <div className="flex items-center gap-2 text-xs text-gray-500">
                                {result.clientName && (
                                  <span className="truncate">{result.clientName}</span>
                                )}
                                {result.projectName && (
                                  <>
                                    {result.clientName && <span>•</span>}
                                    <span className="truncate">{result.projectName}</span>
                                  </>
                                )}
                                {result.date && (
                                  <>
                                    <span>•</span>
                                    <span>{new Date(result.date).toLocaleDateString('he-IL')}</span>
                                  </>
                                )}
                                {result.duration && (
                                  <>
                                    <span>•</span>
                                    <span>{Math.floor(result.duration / 60)}:{(result.duration % 60).toString().padStart(2, '0')}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded">
                      ↑↓
                    </kbd>
                    לנווט
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded">
                      ↵
                    </kbd>
                    לבחור
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded">
                      ESC
                    </kbd>
                    לסגור
                  </span>
                </div>
                {results.length > 0 && (
                  <span>{results.length} תוצאות</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
