"use client";

import { ChangeEvent, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, FileSpreadsheet, Upload } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { AppLayout } from "@/components/app-layout";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { FieldMessage } from "@/components/ui/field-message";
import { Skeleton } from "@/components/ui/skeleton";
import { useProjects } from "@/hooks/use-clients";
import { Link } from "@/src/i18n/navigation";
import {
  CSV_IMPORT_BATCH_SIZE,
  CSV_IMPORT_MAX_FILE_BYTES,
  parseEntryCsv,
  type CsvImportErrorCode,
  type CsvImportRow,
  type ImportProject,
} from "@/lib/csv-entry-import";
import { appToday } from "@/lib/dates";

const EMPTY_PROJECTS: ImportProject[] = [];

export default function CsvEntryImportPage() {
  const t = useTranslations("CsvImport");
  const tRoot = useTranslations();
  const locale = useLocale();
  const { data: projectsData, isPending: projectsLoading, isError: projectsError, refetch } =
    useProjects<ImportProject>();
  const projects = projectsData ?? EMPTY_PROJECTS;
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<CsvImportRow[]>([]);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [approved, setApproved] = useState(false);
  const [parseError, setParseError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [importedCount, setImportedCount] = useState<number | null>(null);

  const validRows = useMemo(() => rows.filter((row) => row.normalized !== null), [rows]);
  const invalidCount = rows.length - validRows.length;
  const selectedEntries = useMemo(
    () =>
      rows
        .filter((row) => selectedRows.has(row.rowNumber))
        .map((row) => row.normalized)
        .filter((entry): entry is NonNullable<typeof entry> => entry !== null),
    [rows, selectedRows]
  );
  const templateHref = useMemo(() => {
    // The sample row is often imported as-is, so this date can become real data.
    const today = appToday();
    const csv = locale === "he"
      ? `\uFEFFתאריך,לקוח,פרויקט,תיאור,משך_בדקות,הערות,לחיוב,תעריף\n${today},שם לקוח,שם פרויקט,פגישת עבודה,60,,כן,250`
      : `date,client,project,description,duration_minutes,notes,billable,rate\n${today},Client name,Project name,Work session,60,,yes,250`;
    return `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
  }, [locale]);

  function resetReview() {
    setRows([]);
    setSelectedRows(new Set());
    setApproved(false);
    setParseError("");
    setSubmitError("");
    setImportedCount(null);
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    resetReview();
    if (!file) {
      setFileName("");
      return;
    }
    setFileName(file.name);
    if (file.size > CSV_IMPORT_MAX_FILE_BYTES) {
      setParseError(t("errors.fileTooLarge"));
      return;
    }
    try {
      const result = parseEntryCsv(await file.text(), projects, file.size);
      if (!result.ok) {
        const suffix = result.missingHeaders?.length
          ? `: ${result.missingHeaders.map((header) => t(`headers.${header}`)).join(", ")}`
          : "";
        setParseError(`${t(`errors.${result.error}`)}${suffix}`);
        return;
      }
      setRows(result.rows);
    } catch {
      setParseError(t("errors.readFailed"));
    }
  }

  function toggleRow(rowNumber: number) {
    setSelectedRows((current) => {
      const next = new Set(current);
      if (next.has(rowNumber)) next.delete(rowNumber);
      else next.add(rowNumber);
      return next;
    });
    setApproved(false);
  }

  function selectValidRows() {
    setSelectedRows(new Set(validRows.slice(0, CSV_IMPORT_BATCH_SIZE).map((row) => row.rowNumber)));
    setApproved(false);
  }

  async function importSelected() {
    if (!approved || selectedEntries.length === 0 || selectedEntries.length > CSV_IMPORT_BATCH_SIZE) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const response = await fetch("/api/entries/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries: selectedEntries }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        const knownError =
          data.error_code === "CLIENT_PLAN_LOCKED" ||
          data.error_code === "PROJECT_NOT_FOUND" ||
          data.error_code === "UNAUTHORIZED"
            ? tRoot(`errors.${data.error_code}`)
            : data.error_code === "RATE_LIMITED"
              ? t("errors.rateLimited")
              : t("errors.importFailed");
        throw new Error(knownError);
      }
      setImportedCount(data.importedCount);
      setRows([]);
      setSelectedRows(new Set());
      setApproved(false);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : t("errors.importFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  if (importedCount !== null) {
    return (
      <AppLayout>
        <PageContainer maxWidth="max-w-3xl">
          <div className="rounded-[var(--radius-card)] border border-success/35 bg-card p-6 text-center shadow-sm sm:p-10">
            <CheckCircle2 aria-hidden="true" className="mx-auto h-12 w-12 text-success" />
            <h1 className="mt-4 font-display text-2xl font-bold text-foreground">{t("success.title")}</h1>
            <p className="mt-2 text-base leading-relaxed text-muted-foreground">
              {t("success.description", { count: importedCount })}
            </p>
            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              <Button asChild><Link href="/entries">{t("success.viewEntries")}</Link></Button>
              <Button variant="outline" onClick={() => setImportedCount(null)}>{t("success.importMore")}</Button>
            </div>
          </div>
        </PageContainer>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageContainer>
        <PageHeader title={t("title")} subtitle={t("subtitle")}>
          <Button asChild variant="outline"><Link href="/entries">{t("back")}</Link></Button>
        </PageHeader>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="min-w-0 space-y-6">
            <section aria-labelledby="upload-heading" className="rounded-[var(--radius-card)] border border-border bg-card p-5 shadow-sm sm:p-6">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius)] bg-primary/10 text-primary">
                  <Upload aria-hidden="true" className="h-5 w-5" />
                </span>
                <div>
                  <h2 id="upload-heading" className="font-display text-lg font-bold text-foreground">{t("upload.title")}</h2>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t("upload.description")}</p>
                </div>
              </div>

              {projectsLoading ? (
                <div role="status" aria-label={t("loadingProjects")} className="mt-5 space-y-3">
                  <Skeleton className="h-11 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              ) : projectsError ? (
                <div role="alert" className="mt-5 rounded-[var(--radius)] border border-destructive/35 bg-destructive/10 p-4">
                  <p className="text-sm text-destructive">{t("errors.projectsFailed")}</p>
                  <Button className="mt-3" variant="outline" onClick={() => void refetch()}>{t("retry")}</Button>
                </div>
              ) : projects.length === 0 ? (
                <div className="mt-5 rounded-[var(--radius)] border border-border bg-muted/40 p-4">
                  <p className="text-sm text-foreground">{t("emptyProjects")}</p>
                  <Button asChild className="mt-3"><Link href="/projects">{t("createProject")}</Link></Button>
                </div>
              ) : (
                <div className="mt-5">
                  <label className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-[var(--radius)] border border-dashed border-border-strong bg-muted/30 px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:border-primary hover:bg-primary/5 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                    <FileSpreadsheet aria-hidden="true" className="h-5 w-5 text-primary" />
                    <span>{fileName || t("upload.choose")}</span>
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      onClick={(event) => { event.currentTarget.value = ""; }}
                      onChange={handleFile}
                      className="sr-only"
                    />
                  </label>
                  <FieldMessage>{t("upload.limit")}</FieldMessage>
                </div>
              )}

              {parseError && (
                <div role="alert" className="mt-4 flex gap-2 rounded-[var(--radius)] border border-destructive/35 bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{parseError}</span>
                </div>
              )}
            </section>

            {rows.length > 0 && (
              <section aria-labelledby="review-heading" className="rounded-[var(--radius-card)] border border-border bg-card shadow-sm">
                <div className="flex flex-col gap-3 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 id="review-heading" className="font-display text-lg font-bold text-foreground">{t("review.title")}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t("review.summary", { valid: validRows.length, invalid: invalidCount })}
                    </p>
                  </div>
                  <Button variant="outline" onClick={selectValidRows} disabled={validRows.length === 0}>
                    {t("review.selectValid")}
                  </Button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] border-collapse text-sm">
                    <thead className="bg-muted/45 text-start text-muted-foreground">
                      <tr>
                        <th scope="col" className="w-14 px-4 py-3 text-start">{t("review.select")}</th>
                        <th scope="col" className="px-3 py-3 text-start">{t("headers.date")}</th>
                        <th scope="col" className="px-3 py-3 text-start">{t("headers.client")}</th>
                        <th scope="col" className="px-3 py-3 text-start">{t("headers.project")}</th>
                        <th scope="col" className="px-3 py-3 text-start">{t("headers.description")}</th>
                        <th scope="col" className="px-3 py-3 text-start">{t("headers.duration")}</th>
                        <th scope="col" className="px-3 py-3 text-start">{t("review.status")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {rows.map((row) => {
                        const valid = row.normalized !== null;
                        return (
                          <tr key={row.rowNumber} className={valid ? "hover:bg-muted/25" : "bg-destructive/5"}>
                            <td className="px-4 py-2">
                              <label className="flex min-h-11 min-w-11 items-center justify-center">
                                <span className="sr-only">{t("review.selectRow", { row: row.rowNumber })}</span>
                                <input
                                  type="checkbox"
                                  className="h-5 w-5 accent-primary"
                                  checked={selectedRows.has(row.rowNumber)}
                                  disabled={!valid}
                                  onChange={() => toggleRow(row.rowNumber)}
                                />
                              </label>
                            </td>
                            <td className="whitespace-nowrap px-3 py-3"><bdi>{row.normalized?.date || row.date || "—"}</bdi></td>
                            <td className="px-3 py-3">{row.client || "—"}</td>
                            <td className="px-3 py-3">{row.project || "—"}</td>
                            <td className="max-w-xs px-3 py-3"><span className="line-clamp-2" dir="auto">{row.description || "—"}</span></td>
                            <td className="whitespace-nowrap px-3 py-3"><bdi>{row.duration || "—"}</bdi></td>
                            <td className="px-3 py-3">
                              {valid ? (
                                <span className="inline-flex rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">{t("review.ready")}</span>
                              ) : (
                                <ul className="space-y-1 text-xs leading-relaxed text-destructive">
                                  {row.errors.map((error: CsvImportErrorCode) => <li key={error}>{t(`errors.${error}`)}</li>)}
                                </ul>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="border-t border-border p-5">
                  {selectedRows.size > CSV_IMPORT_BATCH_SIZE && (
                    <FieldMessage variant="error">{t("errors.batchLimit", { count: CSV_IMPORT_BATCH_SIZE })}</FieldMessage>
                  )}
                  <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-[var(--radius)] border border-border bg-muted/30 p-3">
                    <input
                      type="checkbox"
                      checked={approved}
                      onChange={(event) => setApproved(event.target.checked)}
                      disabled={selectedEntries.length === 0}
                      className="mt-0.5 h-5 w-5 shrink-0 accent-primary"
                    />
                    <span className="text-sm leading-relaxed text-foreground">
                      {t("review.approval", { count: selectedEntries.length })}
                    </span>
                  </label>
                  {submitError && <FieldMessage variant="error" className="mt-3">{submitError}</FieldMessage>}
                  <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p aria-live="polite" className="text-sm text-muted-foreground">
                      {t("review.selected", { count: selectedEntries.length })}
                    </p>
                    <Button
                      onClick={importSelected}
                      disabled={!approved || selectedEntries.length === 0 || selectedEntries.length > CSV_IMPORT_BATCH_SIZE || submitting}
                    >
                      {submitting ? t("review.importing") : t("review.import", { count: selectedEntries.length })}
                    </Button>
                  </div>
                </div>
              </section>
            )}
          </div>

          <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <section className="rounded-[var(--radius-card)] border border-border bg-card p-5">
              <h2 className="font-display text-base font-bold text-foreground">{t("guide.title")}</h2>
              <ol className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground">
                <li>{t("guide.step1")}</li>
                <li>{t("guide.step2")}</li>
                <li>{t("guide.step3")}</li>
              </ol>
              <a
                className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-primary hover:underline"
                download={locale === "he" ? "clockbill-template-he.csv" : "clockbill-template-en.csv"}
                href={templateHref}
              >
                {t("guide.downloadTemplate")}
              </a>
            </section>
            <p className="rounded-[var(--radius)] border border-primary/20 bg-primary/5 p-4 text-sm leading-relaxed text-muted-foreground">
              {t("privacy")}
            </p>
          </aside>
        </div>
      </PageContainer>
    </AppLayout>
  );
}
