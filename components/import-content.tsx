"use client";

import { fieldClass } from "@/lib/form-styles";

interface ImportContentProps {
  importType: "clients" | "entries";
  setImportType: (type: "clients" | "entries") => void;
  importFile: File | null;
  setImportFile: (file: File | null) => void;
  importLoading: boolean;
  setImportLoading: (loading: boolean) => void;
  importError: string;
  setImportError: (error: string) => void;
  importSuccess: string;
  setImportSuccess: (success: string) => void;
  importResults: { imported: number; errors?: Array<{ row: number; message: string }> } | null;
  setImportResults: (results: { imported: number; errors?: Array<{ row: number; message: string }> } | null) => void;
  csvHeaders: string[];
  setCsvHeaders: (headers: string[]) => void;
  csvPreview: Record<string, string>[];
  setCsvPreview: (preview: Record<string, string>[]) => void;
  columnMapping: Record<string, string>;
  setColumnMapping: (mapping: Record<string, string>) => void;
  showMappingStep: boolean;
  setShowMappingStep: (show: boolean) => void;
  importClientsRef: React.RefObject<HTMLInputElement | null>;
  importEntriesRef: React.RefObject<HTMLInputElement | null>;
  // JSON Backup props
  backupFile: File | null;
  setBackupFile: (file: File | null) => void;
  backupLoading: boolean;
  backupError: string;
  setBackupError: (error: string) => void;
  backupSuccess: string;
  setBackupSuccess: (success: string) => void;
  backupImportResults: {
    profile: number;
    clients: number;
    projects: number;
    timeEntries: number;
    customTags: number;
    currencyRates: number;
    tasks: number;
    errors: Array<{ entity: string; message: string }>;
  } | null;
  setBackupImportResults: (results: {
    profile: number;
    clients: number;
    projects: number;
    timeEntries: number;
    customTags: number;
    currencyRates: number;
    tasks: number;
    errors: Array<{ entity: string; message: string }>;
  } | null) => void;
  importMode: "merge" | "replace";
  setImportMode: (mode: "merge" | "replace") => void;
  backupInputRef: React.RefObject<HTMLInputElement | null>;
  handleExportBackup: () => Promise<void>;
  handleImportBackup: () => Promise<void>;
}

export function ImportContent({
  importType,
  setImportType,
  importFile,
  setImportFile,
  importLoading,
  setImportLoading,
  importError,
  setImportError,
  importSuccess,
  setImportSuccess,
  importResults,
  setImportResults,
  csvHeaders,
  setCsvHeaders,
  csvPreview,
  setCsvPreview,
  columnMapping,
  setColumnMapping,
  showMappingStep,
  setShowMappingStep,
  importClientsRef,
  importEntriesRef,
  backupFile,
  setBackupFile,
  backupLoading,
  backupError,
  setBackupError,
  backupSuccess,
  setBackupSuccess,
  backupImportResults,
  setBackupImportResults,
  importMode,
  setImportMode,
  backupInputRef,
  handleExportBackup,
  handleImportBackup,
}: ImportContentProps) {
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".csv")) {
      setImportError("הקובץ חייב להיות בפורמט CSV");
      return;
    }

    setImportFile(file);
    setImportError("");

    // Parse CSV to show headers and preview
    try {
      const text = await file.text();
      const lines = text.split("\n").filter((line) => line.trim());

      if (lines.length < 2) {
        setImportError("הקובץ ריק או מכיל רק כותרת");
        return;
      }

      // Parse headers
      const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
      setCsvHeaders(headers);

      // Parse up to 3 rows for preview
      const preview: Record<string, string>[] = [];
      for (let i = 1; i < Math.min(4, lines.length); i++) {
        const values = lines[i].split(",");
        const row: Record<string, string> = {};
        headers.forEach((header, idx) => {
          row[header] = values[idx]?.trim().replace(/^"|"$/g, "") || "";
        });
        preview.push(row);
      }
      setCsvPreview(preview);

      // Set default column mapping
      if (importType === "clients") {
        const defaultMapping: Record<string, string> = {};
        headers.forEach((header) => {
          const lowerHeader = header.toLowerCase();
          if (lowerHeader.includes("name") || lowerHeader.includes("שם")) {
            defaultMapping.name = header;
          } else if (lowerHeader.includes("contact") || lowerHeader.includes("איש_קשר")) {
            defaultMapping.contactName = header;
          } else if (lowerHeader.includes("email") || lowerHeader.includes("אימייל")) {
            defaultMapping.email = header;
          } else if (lowerHeader.includes("phone") || lowerHeader.includes("טלפון")) {
            defaultMapping.phone = header;
          } else if (lowerHeader.includes("address") || lowerHeader.includes("כתובת")) {
            defaultMapping.address = header;
          } else if (lowerHeader.includes("rate") || lowerHeader.includes("שעור")) {
            defaultMapping.defaultRate = header;
          } else if (lowerHeader.includes("notes") || lowerHeader.includes("הערות")) {
            defaultMapping.notes = header;
          }
        });
        setColumnMapping(defaultMapping);
      } else {
        const defaultMapping: Record<string, string> = {};
        headers.forEach((header) => {
          const lowerHeader = header.toLowerCase();
          if (lowerHeader.includes("project") || lowerHeader.includes("פרויקט")) {
            defaultMapping.projectName = header;
          } else if (lowerHeader.includes("description") || lowerHeader.includes("תיאור")) {
            defaultMapping.description = header;
          } else if (lowerHeader.includes("date") || lowerHeader.includes("תאריך")) {
            defaultMapping.date = header;
          } else if (lowerHeader.includes("duration") || lowerHeader.includes("משך")) {
            defaultMapping.duration = header;
          } else if (lowerHeader.includes("start") || lowerHeader.includes("התחלה")) {
            defaultMapping.startTime = header;
          } else if (lowerHeader.includes("end") || lowerHeader.includes("סיום")) {
            defaultMapping.endTime = header;
          } else if (lowerHeader.includes("tags") || lowerHeader.includes("תגיות")) {
            defaultMapping.tags = header;
          } else if (lowerHeader.includes("notes") || lowerHeader.includes("הערות")) {
            defaultMapping.notes = header;
          } else if (lowerHeader.includes("billable") || lowerHeader.includes("חיוב")) {
            defaultMapping.isBillable = header;
          }
        });
        setColumnMapping(defaultMapping);
      }

      setShowMappingStep(true);
    } catch {
      setImportError("שגיאה בקריאת הקובץ");
    }
  };

  const handleImport = async () => {
    if (!importFile) return;

    // Validate required fields
    if (importType === "clients") {
      if (!columnMapping.name) {
        setImportError("יש למפות את שדה 'שם הלקוח'");
        return;
      }
    } else {
      if (!columnMapping.projectName || !columnMapping.description || !columnMapping.date) {
        setImportError("יש למפות את שדות 'שם הפרויקט', 'תיאור', ו-'תאריך'");
        return;
      }
    }

    setImportLoading(true);
    setImportError("");
    setImportSuccess("");
    setImportResults(null);

    try {
      const formData = new FormData();
      formData.append("file", importFile);
      formData.append("columnMapping", JSON.stringify(columnMapping));

      const endpoint = importType === "clients"
        ? "/api/import/clients"
        : "/api/import/entries";

      const response = await fetch(endpoint, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        setImportSuccess(data.message);
        setImportResults({
          imported: data.imported,
          errors: data.errors,
        });
      } else {
        setImportError(data.message || "שגיאה בייבוא הנתונים");
      }
    } catch {
      setImportError("שגיאת תקשורת. אנא נסה שוב.");
    } finally {
      setImportLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* JSON Backup/Restore Section */}
      <div className="bg-card rounded-[var(--radius-card)] border border-border p-6">
        <h2 className="text-xl font-semibold text-foreground mb-4">
          גיבוי ושחזור נתונים
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          צור גיבוי מלא של כל הנתונים שלך כקובץ JSON, או שחזר נתונים מגיבוי קיים.
        </p>

        {backupError && (
          <div className="rounded-md bg-destructive/5 p-4 mb-4">
            <p className="text-sm text-destructive">{backupError}</p>
          </div>
        )}

        {backupSuccess && (
          <div className="rounded-md bg-success/5 p-4 mb-4">
            <p className="text-sm text-success">{backupSuccess}</p>
          </div>
        )}

        {/* Export Section */}
        <div className="mb-6">
          <h3 className="text-lg font-medium text-foreground mb-3">יצירת גיבוי</h3>
          <p className="text-sm text-muted-foreground mb-4">
            הורד גיבוי מלא של כל הנתונים שלך כולל פרופיל, לקוחות, פרויקטים, רשומות זמן, תגיות מותאמות אישית ושערי מטבעות.
          </p>
          <button
            onClick={handleExportBackup}
            disabled={backupLoading}
            className="flex items-center gap-2 px-4 py-2 border border-border bg-card text-foreground text-sm font-medium rounded-[var(--radius)] hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {backupLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-foreground border-t-transparent"></div>
                יוצר גיבוי...
              </>
            ) : (
              <>
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                  />
                </svg>
                הורד גיבוי JSON
              </>
            )}
          </button>
        </div>

        {/* Import Section */}
        <div className="border-t border-border pt-6">
          <h3 className="text-lg font-medium text-foreground mb-3">שחזור מגיבוי</h3>
          <p className="text-sm text-muted-foreground mb-4">
            שחזר נתונים מקובץ גיבוי שנוצר קודם לכן. אתה יכול לבחור למזג עם הנתונים הקיימים או להחליף את כל הנתונים.
          </p>

          {/* Import Mode Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-foreground mb-2">
              מצב ייבוא
            </label>
            <div className="flex gap-4">
              <button
                onClick={() => setImportMode("merge")}
                className={`px-4 py-2 rounded-[var(--radius)] font-medium transition-colors ${
                  importMode === "merge"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground hover:bg-card-elevated"
                }`}
              >
                מיזוג
                <span className="block text-xs font-normal opacity-80">הוסף לנתונים קיימים</span>
              </button>
              <button
                onClick={() => setImportMode("replace")}
                className={`px-4 py-2 rounded-[var(--radius)] font-medium transition-colors ${
                  importMode === "replace"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground hover:bg-card-elevated"
                }`}
              >
                החלפה
                <span className="block text-xs font-normal opacity-80">מחק הכל והחלף</span>
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {importMode === "merge"
                ? "מיזוג: נתונים חדשים יתווספו, נתונים קיימים עם אותו שם לא יוחלפו"
                : "החלפה: כל הנתונים הקיימים יימחקו לפני הייבוא"}
            </p>
          </div>

          {/* File Upload */}
          <div className="mb-4">
            <input
              ref={backupInputRef}
              type="file"
              accept=".json"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  if (!file.name.endsWith(".json")) {
                    setBackupError("יש לבחור קובץ JSON");
                    return;
                  }
                  setBackupFile(file);
                  setBackupError("");
                  setBackupSuccess("");
                  setBackupImportResults(null);
                }
              }}
              className="hidden"
            />
            <button
              onClick={() => backupInputRef.current?.click()}
              disabled={backupLoading}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-[var(--radius)] hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                />
              </svg>
              בחר קובץ גיבוי
            </button>
            {backupFile && (
              <span className="me-4 text-sm text-muted-foreground">{backupFile.name}</span>
            )}
          </div>

          {/* Import Button */}
          {backupFile && (
            <button
              onClick={handleImportBackup}
              disabled={backupLoading}
              className="px-6 py-2 bg-success text-success-foreground font-medium rounded-[var(--radius)] hover:bg-success/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {backupLoading ? (
                <span className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-success-foreground border-t-transparent"></div>
                  משחזר...
                </span>
              ) : (
                "שחזר נתונים"
              )}
            </button>
          )}

          {/* Import Results */}
          {backupImportResults && (
            <div className="mt-6 border border-border rounded-[var(--radius-card)] p-4 bg-muted/50">
              <h4 className="font-semibold text-foreground mb-3">תוצאות השחזור</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-success">{backupImportResults.profile}</p>
                  <p className="text-xs text-muted-foreground">פרופיל</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-success">{backupImportResults.clients}</p>
                  <p className="text-xs text-muted-foreground">לקוחות</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-success">{backupImportResults.projects}</p>
                  <p className="text-xs text-muted-foreground">פרויקטים</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-success">{backupImportResults.timeEntries}</p>
                  <p className="text-xs text-muted-foreground">רשומות זמן</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-success">{backupImportResults.customTags}</p>
                  <p className="text-xs text-muted-foreground">תגיות</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-success">{backupImportResults.currencyRates}</p>
                  <p className="text-xs text-muted-foreground">שערי מטבע</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-success">{backupImportResults.tasks}</p>
                  <p className="text-xs text-muted-foreground">משימות</p>
                </div>
              </div>
              {backupImportResults.errors.length > 0 && (
                <div className="mt-3">
                  <p className="text-sm font-medium text-destructive mb-2">
                    ⚠️ {backupImportResults.errors.length} שגיאות:
                  </p>
                  <div className="max-h-40 overflow-y-auto">
                    {backupImportResults.errors.slice(0, 10).map((error, idx) => (
                      <p key={idx} className="text-xs text-destructive">
                        {error.entity}: {error.message}
                      </p>
                    ))}
                    {backupImportResults.errors.length > 10 && (
                      <p className="text-xs text-muted-foreground mt-2">
                        ...ועוד {backupImportResults.errors.length - 10} שגיאות
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* CSV Import Section */}
      <div className="bg-card rounded-[var(--radius-card)] border border-border p-6">
        <h2 className="text-xl font-semibold text-foreground mb-4">
          ייבוא נתונים מ-CSV
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          ייבא לקוחות או רשומות זמן מקובץ CSV. הקובץ חייב להכיל שורת כותרת עם שמות השדות.
        </p>

        {importError && (
          <div className="rounded-md bg-destructive/5 p-4 mb-4">
            <p className="text-sm text-destructive">{importError}</p>
          </div>
        )}

        {importSuccess && (
          <div className="rounded-md bg-success/5 p-4 mb-4">
            <p className="text-sm text-success">{importSuccess}</p>
          </div>
        )}

        {/* Import Type Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-foreground mb-2">
            סוג הנתונים לייבוא
          </label>
          <div className="flex gap-4">
            <button
              onClick={() => {
                setImportType("clients");
                setImportFile(null);
                setImportResults(null);
                setShowMappingStep(false);
                setCsvHeaders([]);
                setCsvPreview([]);
                setColumnMapping({});
                setImportError("");
                setImportSuccess("");
              }}
              className={`px-4 py-2 rounded-[var(--radius)] font-medium transition-colors ${
                importType === "clients"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground hover:bg-card-elevated"
              }`}
            >
              לקוחות
            </button>
            <button
              onClick={() => {
                setImportType("entries");
                setImportFile(null);
                setImportResults(null);
                setShowMappingStep(false);
                setCsvHeaders([]);
                setCsvPreview([]);
                setColumnMapping({});
                setImportError("");
                setImportSuccess("");
              }}
              className={`px-4 py-2 rounded-[var(--radius)] font-medium transition-colors ${
                importType === "entries"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground hover:bg-card-elevated"
              }`}
            >
              רשומות זמן
            </button>
          </div>
        </div>

        {!showMappingStep ? (
          <>
            {/* File Upload */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-foreground mb-2">
                בחר קובץ CSV
              </label>
              <input
                ref={importType === "clients" ? importClientsRef : importEntriesRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                onClick={() => {
                  if (importType === "clients") {
                    importClientsRef.current?.click();
                  } else {
                    importEntriesRef.current?.click();
                  }
                }}
                disabled={importLoading}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-[var(--radius)] hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                  />
                </svg>
                בחר קובץ CSV
              </button>
              {importFile && (
                <span className="me-4 text-sm text-muted-foreground">{importFile.name}</span>
              )}
            </div>

            {/* Help Text */}
            <div className="bg-secondary-light border border-secondary/20 rounded-[var(--radius-card)] p-4">
              <h4 className="text-sm font-medium text-foreground mb-2">
                פורמט הקובץ לייבוא {importType === "clients" ? "לקוחות" : "רשומות זמן"}
              </h4>
              {importType === "clients" ? (
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>הקובץ חייב להכיל לפחות את השדות הבאים:</p>
                  <ul className="list-disc list-inside mr-4">
                    <li>שם הלקוח (name)</li>
                  </ul>
                  <p className="mt-2">שדות אופציונליים:</p>
                  <ul className="list-disc list-inside mr-4">
                    <li>שם איש קשר (contact_name)</li>
                    <li>אימייל (email)</li>
                    <li>טלפון (phone)</li>
                    <li>כתובת (address)</li>
                    <li>שעור שעתי (default_rate)</li>
                    <li>הערות (notes)</li>
                  </ul>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>הקובץ חייב להכיל לפחות את השדות הבאים:</p>
                  <ul className="list-disc list-inside mr-4">
                    <li>שם הפרויקט (project_name)</li>
                    <li>תיאור (description)</li>
                    <li>תאריך (date)</li>
                  </ul>
                  <p className="mt-2">שדות אופציונליים:</p>
                  <ul className="list-disc list-inside mr-4">
                    <li>משך זמן בדקות (duration)</li>
                    <li>שעת התחלה (start_time)</li>
                    <li>שעת סיום (end_time)</li>
                    <li>תגיות (tags) - מופרדות בפסיקים</li>
                    <li>הערות (notes)</li>
                    <li>ניתן לחיוב (is_billable) - true/false</li>
                  </ul>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Column Mapping */}
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-4">
                  מיפוי עמודות
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  מפה את עמודות הקובץ שלך לשדות המערכת. הערכנו את המיפוי האוטומטי, אך תוכל לשנות אותו.
                </p>

                {/* CSV Preview Table */}
                <div className="mb-6 overflow-x-auto">
                  <table className="min-w-full divide-y divide-border border border-border">
                    <thead className="bg-muted/50">
                      <tr>
                        {csvHeaders.map((header) => (
                          <th
                            key={header}
                            className="px-4 py-2 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider"
                          >
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-card divide-y divide-border">
                      {csvPreview.map((row, idx) => (
                        <tr key={idx}>
                          {csvHeaders.map((header) => (
                            <td
                              key={header}
                              className="px-4 py-2 whitespace-nowrap text-sm text-foreground"
                            >
                              {row[header]}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="text-xs text-muted-foreground mt-2">
                    הצגה מקדימה של 3 השורות הראשונות בקובץ
                  </p>
                </div>

                {/* Mapping Form */}
                <div className="space-y-4">
                  {importType === "clients" ? (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-1">
                            שם הלקוח * (שדה חובה)
                          </label>
                          <select
                            value={columnMapping.name || ""}
                            onChange={(e) => setColumnMapping({ ...columnMapping, name: e.target.value })}
                            className={fieldClass()}
                          >
                            <option value="">בחר עמודה</option>
                            {csvHeaders.map((header) => (
                              <option key={header} value={header}>
                                {header}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-1">
                            שם איש קשר
                          </label>
                          <select
                            value={columnMapping.contactName || ""}
                            onChange={(e) => setColumnMapping({ ...columnMapping, contactName: e.target.value })}
                            className={fieldClass()}
                          >
                            <option value="">בחר עמודה</option>
                            {csvHeaders.map((header) => (
                              <option key={header} value={header}>
                                {header}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-1">
                            אימייל
                          </label>
                          <select
                            value={columnMapping.email || ""}
                            onChange={(e) => setColumnMapping({ ...columnMapping, email: e.target.value })}
                            className={fieldClass()}
                          >
                            <option value="">בחר עמודה</option>
                            {csvHeaders.map((header) => (
                              <option key={header} value={header}>
                                {header}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-1">
                            טלפון
                          </label>
                          <select
                            value={columnMapping.phone || ""}
                            onChange={(e) => setColumnMapping({ ...columnMapping, phone: e.target.value })}
                            className={fieldClass()}
                          >
                            <option value="">בחר עמודה</option>
                            {csvHeaders.map((header) => (
                              <option key={header} value={header}>
                                {header}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-1">
                            כתובת
                          </label>
                          <select
                            value={columnMapping.address || ""}
                            onChange={(e) => setColumnMapping({ ...columnMapping, address: e.target.value })}
                            className={fieldClass()}
                          >
                            <option value="">בחר עמודה</option>
                            {csvHeaders.map((header) => (
                              <option key={header} value={header}>
                                {header}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-1">
                            שעור שעתי
                          </label>
                          <select
                            value={columnMapping.defaultRate || ""}
                            onChange={(e) => setColumnMapping({ ...columnMapping, defaultRate: e.target.value })}
                            className={fieldClass()}
                          >
                            <option value="">בחר עמודה</option>
                            {csvHeaders.map((header) => (
                              <option key={header} value={header}>
                                {header}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1">
                          הערות
                        </label>
                        <select
                          value={columnMapping.notes || ""}
                          onChange={(e) => setColumnMapping({ ...columnMapping, notes: e.target.value })}
                          className={fieldClass()}
                        >
                          <option value="">בחר עמודה</option>
                          {csvHeaders.map((header) => (
                            <option key={header} value={header}>
                              {header}
                            </option>
                          ))}
                        </select>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-1">
                            שם הפרויקט * (שדה חובה)
                          </label>
                          <select
                            value={columnMapping.projectName || ""}
                            onChange={(e) => setColumnMapping({ ...columnMapping, projectName: e.target.value })}
                            className={fieldClass()}
                          >
                            <option value="">בחר עמודה</option>
                            {csvHeaders.map((header) => (
                              <option key={header} value={header}>
                                {header}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-1">
                            תיאור * (שדה חובה)
                          </label>
                          <select
                            value={columnMapping.description || ""}
                            onChange={(e) => setColumnMapping({ ...columnMapping, description: e.target.value })}
                            className={fieldClass()}
                          >
                            <option value="">בחר עמודה</option>
                            {csvHeaders.map((header) => (
                              <option key={header} value={header}>
                                {header}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-1">
                            תאריך * (שדה חובה)
                          </label>
                          <select
                            value={columnMapping.date || ""}
                            onChange={(e) => setColumnMapping({ ...columnMapping, date: e.target.value })}
                            className={fieldClass()}
                          >
                            <option value="">בחר עמודה</option>
                            {csvHeaders.map((header) => (
                              <option key={header} value={header}>
                                {header}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-1">
                            משך זמן (דקות) או שעות התחלה/סיום
                          </label>
                          <select
                            value={columnMapping.duration || ""}
                            onChange={(e) => setColumnMapping({ ...columnMapping, duration: e.target.value })}
                            className={fieldClass()}
                          >
                            <option value="">בחר עמודה</option>
                            {csvHeaders.map((header) => (
                              <option key={header} value={header}>
                                {header}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-1">
                            שעת התחלה
                          </label>
                          <select
                            value={columnMapping.startTime || ""}
                            onChange={(e) => setColumnMapping({ ...columnMapping, startTime: e.target.value })}
                            className={fieldClass()}
                          >
                            <option value="">בחר עמודה</option>
                            {csvHeaders.map((header) => (
                              <option key={header} value={header}>
                                {header}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-1">
                            שעת סיום
                          </label>
                          <select
                            value={columnMapping.endTime || ""}
                            onChange={(e) => setColumnMapping({ ...columnMapping, endTime: e.target.value })}
                            className={fieldClass()}
                          >
                            <option value="">בחר עמודה</option>
                            {csvHeaders.map((header) => (
                              <option key={header} value={header}>
                                {header}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-1">
                            תגיות
                          </label>
                          <select
                            value={columnMapping.tags || ""}
                            onChange={(e) => setColumnMapping({ ...columnMapping, tags: e.target.value })}
                            className={fieldClass()}
                          >
                            <option value="">בחר עמודה</option>
                            {csvHeaders.map((header) => (
                              <option key={header} value={header}>
                                {header}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-1">
                            הערות
                          </label>
                          <select
                            value={columnMapping.notes || ""}
                            onChange={(e) => setColumnMapping({ ...columnMapping, notes: e.target.value })}
                            className={fieldClass()}
                          >
                            <option value="">בחר עמודה</option>
                            {csvHeaders.map((header) => (
                              <option key={header} value={header}>
                                {header}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-1">
                            ניתן לחיוב
                          </label>
                          <select
                            value={columnMapping.isBillable || ""}
                            onChange={(e) => setColumnMapping({ ...columnMapping, isBillable: e.target.value })}
                            className={fieldClass()}
                          >
                            <option value="">בחר עמודה</option>
                            {csvHeaders.map((header) => (
                              <option key={header} value={header}>
                                {header}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 justify-end mt-6">
                <button
                  onClick={() => {
                    setShowMappingStep(false);
                    setImportFile(null);
                    setCsvHeaders([]);
                    setCsvPreview([]);
                    setColumnMapping({});
                  }}
                  disabled={importLoading}
                  className="px-4 py-2 border border-border bg-card text-foreground rounded-[var(--radius)] hover:bg-muted disabled:opacity-50 transition-colors"
                >
                  חזור
                </button>
                <button
                  onClick={handleImport}
                  disabled={importLoading}
                  className="px-6 py-2 bg-primary text-primary-foreground font-medium rounded-[var(--radius)] hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {importLoading ? (
                    <span className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary-foreground border-t-transparent"></div>
                      מייבא...
                    </span>
                  ) : (
                    "ייבא נתונים"
                  )}
                </button>
              </div>

              {/* Import Results */}
              {importResults && (
                <div className="mt-6 border border-border rounded-[var(--radius-card)] p-4 bg-muted/50">
                  <h4 className="font-semibold text-foreground mb-2">תוצאות הייבוא</h4>
                  <p className="text-sm text-foreground">
                    ✅ יובאו בהצלחה <strong>{importResults.imported}</strong> רשומות
                  </p>
                  {importResults.errors && importResults.errors.length > 0 && (
                    <div className="mt-3">
                      <p className="text-sm font-medium text-destructive mb-2">
                        ⚠️ {importResults.errors.length} שגיאות:
                      </p>
                      <div className="max-h-40 overflow-y-auto">
                        {importResults.errors.slice(0, 10).map((error, idx) => (
                          <p key={idx} className="text-xs text-destructive">
                            שורה {error.row}: {error.message}
                          </p>
                        ))}
                        {importResults.errors.length > 10 && (
                          <p className="text-xs text-muted-foreground mt-2">
                            ...ועוד {importResults.errors.length - 10} שגיאות
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
