"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Search, Users, FolderKanban, Clock, X, Play, Plus, FileText } from "lucide-react";
import { useRouter } from "@/src/i18n/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { HourglassSVG } from "@/components/ui/thematic-elements";
import { useTimer } from "@/contexts/timer-context";

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
  const t = useTranslations("Timer");
  const intlLocale = useLocale() === "en" ? "en-US" : "he-IL";
  const router = useRouter();
  const { setShowTimerModal } = useTimer();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

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

  const runAction = (action: "timer" | "manual" | "item" | "task" | "client" | "billing") => {
    handleClose();
    if (action === "timer") setShowTimerModal(true);
    else if (action === "manual") router.push("/entries?new=manual");
    else if (action === "item") router.push("/entries?new=item");
    else if (action === "task") router.push("/tasks?create=true");
    else if (action === "client") router.push("/clients?create=true");
    else router.push("/reports");
  };

  const actions = [
    { id: "timer" as const, label: t("search.actions.startTimer"), icon: Play },
    { id: "manual" as const, label: t("search.actions.logTime"), icon: Clock },
    { id: "item" as const, label: t("search.actions.addItem"), icon: Plus },
    { id: "task" as const, label: t("search.actions.newTask"), icon: FolderKanban },
    { id: "client" as const, label: t("search.actions.newClient"), icon: Users },
    { id: "billing" as const, label: t("search.actions.openBilling"), icon: FileText },
  ].filter((action) => query.trim().length < 2 || action.label.toLocaleLowerCase(intlLocale).includes(query.trim().toLocaleLowerCase(intlLocale)));

  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); else setIsOpen(true); }}>
      {/* Search Trigger Button */}
      <DialogPrimitive.Trigger asChild>
        <button
          className="flex min-h-11 w-full touch-manipulation items-center gap-2 rounded-[var(--radius)] px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Search className="h-4 w-4" />
          <span>{t("search.trigger")}</span>
          <kbd className="ms-auto hidden sm:inline-block px-2 py-0.5 text-xs font-semibold text-muted-foreground bg-muted border border-border rounded">
            ⌘K
          </kbd>
        </button>
      </DialogPrimitive.Trigger>

      {/* Search Overlay */}
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/20 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className="fixed inset-0 z-50 flex items-start justify-center pt-24 sm:pt-32 px-4"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {/* Radix requires a Title/Description for screen readers; hidden visually. */}
          <DialogPrimitive.Title className="sr-only">{t("search.dialogTitle")}</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            {t("search.dialogDescription")}
          </DialogPrimitive.Description>
          {/* Search Modal */}
          <div
            className="relative w-full max-w-2xl bg-card rounded-[var(--radius-card)] shadow-2xl overflow-hidden motion-safe:animate-scale-in border border-border/50"
          >
            {/* Search Input */}
            <div className="flex items-center gap-3 px-4 py-4 border-b border-border/50">
              <Search className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("search.placeholder")}
                className="min-h-11 flex-1 bg-transparent text-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
                aria-label={t("search.inputAriaLabel")}
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[var(--radius)] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={t("search.clear")}
                >
                  <X className="h-5 w-5" />
                </button>
              )}
              <kbd className="hidden sm:inline-block px-2 py-1 text-xs font-semibold text-muted-foreground bg-muted border border-border rounded">
                ESC
              </kbd>
            </div>

            {/* Search Results */}
            <div className="max-h-[60vh] overflow-y-auto">
              {actions.length > 0 && (
                <div className="border-b border-border/60 px-4 py-3">
                  <p className="mb-2 text-xs font-semibold text-muted-foreground">{t("search.actions.title")}</p>
                  <div className="grid gap-1 sm:grid-cols-2">
                    {actions.map((action) => {
                      const Icon = action.icon;
                      return (
                        <button key={action.id} type="button" onClick={() => runAction(action.id)} className="flex min-h-11 items-center gap-3 rounded-[var(--radius)] px-3 py-2 text-start text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                          <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
                          {action.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {query.length < 2 ? (
                <div className="px-4 py-8 text-center text-muted-foreground">
                  <HourglassSVG size={48} className="mx-auto mb-3 text-muted-foreground/30" />
                  <p className="text-lg font-medium">{t("search.startTyping")}</p>
                  <p className="text-sm mt-1">{t("search.startTypingHint")}</p>
                </div>
              ) : loading ? (
                <div className="px-4 py-12 text-center text-muted-foreground">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-3 border-border border-t-primary" />
                  <p className="mt-3">{t("search.searching")}</p>
                </div>
              ) : results.length === 0 ? (
                <div className="px-4 py-12 text-center text-muted-foreground">
                  <HourglassSVG size={48} className="mx-auto mb-3 text-muted-foreground/30" />
                  <p className="text-lg font-medium">{t("search.noResults")}</p>
                  <p className="text-sm mt-1">{t("search.noResultsHint")}</p>
                </div>
              ) : (
                <div className="py-2">
                  {/* Clients Section */}
                  {results.filter((r) => r.type === "client").length > 0 && (
                    <div className="px-4 py-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                        {t("search.groupClients")}
                      </p>
                      {results
                        .filter((r) => r.type === "client")
                        .map((result) => (
                          <button
                            key={result.id}
                            onClick={() => handleResultClick(result)}
                            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface transition-colors text-start"
                          >
                            <div className="flex-shrink-0 w-10 h-10 bg-primary-light rounded-lg flex items-center justify-center">
                              <Users className="h-5 w-5 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">
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
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                        {t("search.groupProjects")}
                      </p>
                      {results
                        .filter((r) => r.type === "project")
                        .map((result) => (
                          <button
                            key={result.id}
                            onClick={() => handleResultClick(result)}
                            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface transition-colors text-start"
                          >
                            <div className="flex-shrink-0 w-10 h-10 bg-secondary-light rounded-lg flex items-center justify-center">
                              <FolderKanban className="h-5 w-5 text-secondary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">
                                {result.name}
                              </p>
                              {result.clientName && (
                                <p className="text-xs text-muted-foreground truncate">
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
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                        {t("search.groupEntries")}
                      </p>
                      {results
                        .filter((r) => r.type === "entry")
                        .map((result) => (
                          <button
                            key={result.id}
                            onClick={() => handleResultClick(result)}
                            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface transition-colors text-start"
                          >
                            <div className="flex-shrink-0 w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center">
                              <Clock className="h-5 w-5 text-accent" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">
                                {result.name}
                              </p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
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
                                    <span>{new Date(result.date).toLocaleDateString(intlLocale)}</span>
                                  </>
                                )}
                                {result.duration && (
                                  <>
                                    <span>•</span>
                                    <span className="font-mono">{Math.floor(result.duration / 60)}:{(result.duration % 60).toString().padStart(2, '0')}</span>
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
            <div className="px-4 py-3 border-t border-border bg-surface/50">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 bg-card border border-border rounded">
                      ↑↓
                    </kbd>
                    {t("search.hintNavigate")}
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 bg-card border border-border rounded">
                      ↵
                    </kbd>
                    {t("search.hintSelect")}
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 bg-card border border-border rounded">
                      ESC
                    </kbd>
                    {t("search.hintClose")}
                  </span>
                </div>
                {results.length > 0 && (
                  <span>{t("search.resultCount", { count: results.length })}</span>
                )}
              </div>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
