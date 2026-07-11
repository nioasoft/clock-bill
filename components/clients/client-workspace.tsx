"use client";

import { useLocale, useTranslations } from "next-intl";
import { ArrowUpLeft, BriefcaseBusiness, CalendarClock, Mail, Phone, Plus, ReceiptText, TimerReset } from "lucide-react";
import { Link } from "@/src/i18n/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { CURRENCY_SYMBOLS, formatCurrency } from "@/lib/currency";
import type { ClientRate } from "@/lib/schemas/rates";
import type { RoundingMode } from "@/lib/rounding";

export type ClientWorkspaceTab = "overview" | "projects" | "billing" | "details";

export interface WorkspaceClient {
  id: string;
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  defaultRate: number | null;
  currency: string;
  billingRounding: string | null;
  isRetainer: boolean;
  retainerHours: number | null;
  retainerMonthlyFee: number | null;
  overageRate: number | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  rates?: ClientRate[];
  documentLanguage: string | null;
  vatMode: string | null;
  settlementBillingDay: number | null;
}

export interface ClientWorkspaceData {
  currency: string;
  totalHours: number;
  money: {
    unbilled: number;
    outstanding: number;
    paid: number;
    hasOtherCurrency: boolean;
  };
  projects: Array<{
    id: string;
    name: string;
    status: string;
    totalHours: number;
    unbilledTotal: number;
    lastEntryAt: string | null;
  }>;
}

interface ClientWorkspaceProps {
  client: WorkspaceClient;
  data: ClientWorkspaceData | null;
  dataLoading: boolean;
  dataError: boolean;
  activeTab: ClientWorkspaceTab;
  onEditDetails: () => void;
  onEditBilling: () => void;
  onArchive: () => void;
}

const tabs: ClientWorkspaceTab[] = ["overview", "projects", "billing", "details"];

function statusClass(status: string): string {
  if (status === "active") return "border-success/30 bg-success/10 text-success";
  if (status === "paused") return "border-warning/30 bg-warning/10 text-warning";
  return "border-border bg-muted text-muted-foreground";
}

export function ClientWorkspace({
  client,
  data,
  dataLoading,
  dataError,
  activeTab,
  onEditDetails,
  onEditBilling,
  onArchive,
}: ClientWorkspaceProps) {
  const t = useTranslations("Clients.workspace");
  const tClients = useTranslations("Clients");
  const tRounding = useTranslations("Rounding");
  const locale = useLocale();
  const dateLocale = locale === "en" ? "en-US" : "he-IL";

  return (
    <div className="space-y-0">
      <header className="border-b border-border pb-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-balance font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                {client.name}
              </h1>
              <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${client.isActive ? "border-success/30 bg-success/10 text-success" : "border-border bg-muted text-muted-foreground"}`}>
                {client.isActive ? tClients("statusActive") : tClients("statusInactive")}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
              {client.contactName && <span>{client.contactName}</span>}
              {client.email && <a href={`mailto:${client.email}`} className="inline-flex items-center gap-1.5 hover:text-foreground"><Mail className="h-4 w-4" aria-hidden="true" /><bdi>{client.email}</bdi></a>}
              {client.phone && <a href={`tel:${client.phone}`} className="inline-flex items-center gap-1.5 hover:text-foreground"><Phone className="h-4 w-4" aria-hidden="true" /><bdi>{client.phone}</bdi></a>}
              {!client.contactName && !client.email && !client.phone && <span>{t("missingContact")}</span>}
            </div>
          </div>

          {client.isActive && (
            <div className="flex flex-wrap gap-2">
              <Link href={`/entries?new=manual&clientId=${client.id}`} className={buttonVariants()}>
                <TimerReset className="h-4 w-4" aria-hidden="true" />{t("logWork")}
              </Link>
              <Link href={`/projects?create=true&clientId=${client.id}`} className={buttonVariants({ variant: "outline" })}>
                <Plus className="h-4 w-4" aria-hidden="true" />{t("newProject")}
              </Link>
              <Button variant="ghost" onClick={onEditDetails}>{t("editDetails")}</Button>
            </div>
          )}
        </div>
      </header>

      <nav className="-mx-1 overflow-x-auto border-b border-border" aria-label={t("tabsLabel")}>
        <div className="flex min-w-max gap-1 px-1" role="tablist">
          {tabs.map((tab) => (
            <Link
              key={tab}
              href={`/clients/${client.id}?tab=${tab}`}
              role="tab"
              aria-selected={activeTab === tab}
              className={`border-b-2 px-4 py-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${
                activeTab === tab
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t(`tabs.${tab}`)}
            </Link>
          ))}
        </div>
      </nav>

      <div className="py-6">
        {activeTab === "overview" && (
          <Overview client={client} data={data} loading={dataLoading} error={dataError} />
        )}
        {activeTab === "projects" && (
          <Projects client={client} data={data} loading={dataLoading} error={dataError} />
        )}
        {activeTab === "billing" && (
          <Billing client={client} projects={data?.projects ?? []} onEdit={onEditBilling} />
        )}
        {activeTab === "details" && (
          <Details client={client} dateLocale={dateLocale} onEdit={onEditDetails} onArchive={onArchive} />
        )}
      </div>
    </div>
  );

  function Overview({ client: overviewClient, data: overviewData, loading, error }: { client: WorkspaceClient; data: ClientWorkspaceData | null; loading: boolean; error: boolean }) {
    if (loading) return <WorkspaceSkeleton />;
    if (error || !overviewData) return <WorkspaceError />;
    const nextAction = overviewData.money.outstanding > 0
      ? "followPayment"
      : overviewData.money.unbilled > 0
        ? "createDocument"
        : overviewData.projects.length === 0
          ? "createProject"
          : "logWork";
    const nextHref = nextAction === "followPayment"
      ? `/reports?clientId=${overviewClient.id}`
      : nextAction === "createDocument"
        ? `/reports?clientId=${overviewClient.id}`
        : nextAction === "createProject"
          ? `/projects?create=true&clientId=${overviewClient.id}`
          : `/entries?new=manual&clientId=${overviewClient.id}`;

    return (
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0 space-y-8">
          <section aria-labelledby="money-trail-title">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 id="money-trail-title" className="font-display text-lg font-semibold text-foreground">{t("moneyTrail.title")}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{t("moneyTrail.description")}</p>
              </div>
              {overviewData.money.hasOtherCurrency && <span className="text-xs text-muted-foreground">{t("moneyTrail.otherCurrency")}</span>}
            </div>
            <dl className="mt-4 grid overflow-hidden rounded-[var(--radius-card)] border border-border sm:grid-cols-2 lg:grid-cols-4">
              <MoneyStage icon={BriefcaseBusiness} label={t("moneyTrail.tracked")} value={t("hours", { hours: overviewData.totalHours.toFixed(1) })} />
              <MoneyStage icon={CalendarClock} label={t("moneyTrail.unbilled")} value={formatCurrency(overviewData.money.unbilled, overviewData.currency, locale)} />
              <MoneyStage icon={ReceiptText} label={t("moneyTrail.outstanding")} value={formatCurrency(overviewData.money.outstanding, overviewData.currency, locale)} warn={overviewData.money.outstanding > 0} />
              <MoneyStage icon={ArrowUpLeft} label={t("moneyTrail.paid")} value={formatCurrency(overviewData.money.paid, overviewData.currency, locale)} />
            </dl>
          </section>

          <section aria-labelledby="active-projects-title">
            <div className="flex items-center justify-between gap-4 border-b border-border pb-3">
              <div>
                <h2 id="active-projects-title" className="font-display text-lg font-semibold text-foreground">{t("projects.title")}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{t("projects.description")}</p>
              </div>
              <Link href={`/clients/${overviewClient.id}?tab=projects`} className="text-sm font-semibold text-primary hover:underline">{t("projects.viewAll")}</Link>
            </div>
            <ProjectList projects={overviewData.projects.filter((project) => project.status === "active").slice(0, 4)} currency={overviewData.currency} clientId={overviewClient.id} />
          </section>
        </div>

        <aside className="space-y-6 xl:border-s xl:border-border xl:ps-6">
          <section>
            <h2 className="text-sm font-semibold text-foreground">{t("nextAction.title")}</h2>
            <div className="mt-3 rounded-[var(--radius-card)] border border-primary/25 bg-primary/5 p-4">
              <p className="font-medium text-foreground">{t(`nextAction.${nextAction}.title`)}</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{t(`nextAction.${nextAction}.description`)}</p>
              <Link href={nextHref} className={`${buttonVariants({ size: "sm" })} mt-4`}>{t(`nextAction.${nextAction}.action`)}</Link>
            </div>
          </section>
          <section className="border-t border-border pt-5">
            <h2 className="text-sm font-semibold text-foreground">{t("contact.title")}</h2>
            <dl className="mt-3 space-y-3 text-sm">
              <DetailRow label={tClients("contactNameLabel")} value={overviewClient.contactName} />
              <DetailRow label={tClients("emailLabel")} value={overviewClient.email} bidi />
              <DetailRow label={tClients("phoneLabel")} value={overviewClient.phone} bidi />
              <DetailRow label={tClients("settlementDay")} value={overviewClient.settlementBillingDay ? t("dayOfMonth", { day: overviewClient.settlementBillingDay }) : null} />
            </dl>
          </section>
        </aside>
      </div>
    );
  }

  function Projects({ client: projectsClient, data: projectsData, loading, error }: { client: WorkspaceClient; data: ClientWorkspaceData | null; loading: boolean; error: boolean }) {
    if (loading) return <WorkspaceSkeleton />;
    if (error || !projectsData) return <WorkspaceError />;
    return (
      <section aria-labelledby="projects-tab-title">
        <div className="flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="projects-tab-title" className="font-display text-xl font-semibold text-foreground">{t("projects.allTitle")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("projects.allDescription")}</p>
          </div>
          {projectsClient.isActive && <Link href={`/projects?create=true&clientId=${projectsClient.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}><Plus className="h-4 w-4" aria-hidden="true" />{t("newProject")}</Link>}
        </div>
        <ProjectList projects={projectsData.projects} currency={projectsData.currency} clientId={projectsClient.id} />
      </section>
    );
  }

  function Billing({ client: billingClient, projects, onEdit }: { client: WorkspaceClient; projects: ClientWorkspaceData["projects"]; onEdit: () => void }) {
    const hourly = (billingClient.rates ?? []).filter((rate) => rate.kind === "hourly");
    const items = (billingClient.rates ?? []).filter((rate) => rate.kind === "item");
    const generalDefault = hourly.find((rate) => rate.isDefault && !rate.projectId) ?? hourly.find((rate) => !rate.projectId);
    const scoped = (billingClient.rates ?? []).filter((rate) => rate.projectId);
    const symbol = CURRENCY_SYMBOLS[billingClient.currency] || billingClient.currency;
    return (
      <div className="grid gap-8 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <aside>
          <h2 className="font-display text-lg font-semibold text-foreground">{t("billing.title")}</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{t("billing.description")}</p>
          {billingClient.isActive && <Button className="mt-4" onClick={onEdit}>{t("billing.edit")}</Button>}
        </aside>
        <div className="space-y-8">
          <section aria-labelledby="rate-hierarchy-title">
            <h3 id="rate-hierarchy-title" className="text-sm font-semibold text-foreground">{t("billing.hierarchyTitle")}</h3>
            <ol className="mt-3 grid overflow-hidden rounded-[var(--radius-card)] border border-border sm:grid-cols-3">
              <HierarchyStep number="1" label={t("billing.accountDefault")} value={t("billing.fallback")} />
              <HierarchyStep number="2" label={t("billing.clientDefault")} value={generalDefault ? `${symbol}${generalDefault.rate}` : t("billing.notSet")} active={Boolean(generalDefault)} />
              <HierarchyStep number="3" label={t("billing.projectOverride")} value={t("billing.overrideCount", { count: scoped.length })} active={scoped.length > 0} />
            </ol>
            <p className="mt-3 text-sm text-muted-foreground">{t("billing.hierarchyHint")}</p>
          </section>

          <section aria-labelledby="rates-title" className="border-t border-border pt-6">
            <h3 id="rates-title" className="font-display text-lg font-semibold text-foreground">{tClients("ratesAndItems")}</h3>
            {hourly.length === 0 && items.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">{tClients("noRatesDefined", { action: t("billing.edit") })}</p>
            ) : (
              <div className="mt-4 overflow-hidden rounded-[var(--radius-card)] border border-border">
                <div className="hidden grid-cols-[minmax(10rem,1fr)_8rem_minmax(10rem,1fr)] gap-4 border-b border-border bg-surface px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:grid">
                  <span>{t("billing.rateName")}</span><span>{t("billing.price")}</span><span>{t("billing.appliesTo")}</span>
                </div>
                <ul className="divide-y divide-border">
                  {[...hourly, ...items].map((rate) => (
                    <li key={rate.id} className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(10rem,1fr)_8rem_minmax(10rem,1fr)] sm:items-center sm:gap-4">
                      <span className="font-medium text-foreground">{rate.name}</span>
                      <span className="font-mono text-sm tabular-nums text-foreground"><bdi>{formatCurrency(rate.rate, billingClient.currency, locale)}</bdi>{rate.kind === "hourly" ? tClients("perHourSuffix") : rate.unit ? ` / ${rate.unit}` : tClients("perUnitSuffix")}</span>
                      <span className="text-sm text-muted-foreground">{rate.projectId ? projects.find((project) => project.id === rate.projectId)?.name ?? tClients("rateScopeAria") : tClients("rateScopeAll")}{rate.isDefault ? ` · ${tClients("defaultBadge")}` : ""}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <section aria-labelledby="billing-rules-title" className="border-t border-border pt-6">
            <h3 id="billing-rules-title" className="font-display text-lg font-semibold text-foreground">{t("billing.rulesTitle")}</h3>
            <dl className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-2">
              <DetailRow label={tClients("currencyLabel")} value={billingClient.currency} bidi />
              <DetailRow label={tClients("billingRoundingLabel")} value={billingClient.billingRounding ? tRounding(billingClient.billingRounding as RoundingMode) : tClients("roundingInherit")} />
              <DetailRow label={tClients("documentLanguageLabel")} value={billingClient.documentLanguage ? tClients(billingClient.documentLanguage === "he" ? "documentLanguageHe" : "documentLanguageEn") : tClients("documentLanguageAuto")} />
              <DetailRow label={tClients("settlementDay")} value={billingClient.settlementBillingDay ? t("dayOfMonth", { day: billingClient.settlementBillingDay }) : tClients("settlementDayNone")} />
              {billingClient.isRetainer && <DetailRow label={tClients("retainerHeader")} value={tClients("retainerSummary", { hours: billingClient.retainerHours ?? 0, symbol, fee: billingClient.retainerMonthlyFee ?? 0 })} />}
            </dl>
          </section>
        </div>
      </div>
    );
  }

  function Details({ client: detailsClient, dateLocale: detailsDateLocale, onEdit, onArchive }: { client: WorkspaceClient; dateLocale: string; onEdit: () => void; onArchive: () => void }) {
    return (
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <section aria-labelledby="client-details-title">
          <div className="flex items-center justify-between gap-4 border-b border-border pb-3">
            <h2 id="client-details-title" className="font-display text-xl font-semibold text-foreground">{t("details.title")}</h2>
            {detailsClient.isActive && <Button variant="outline" size="sm" onClick={onEdit}>{t("editDetails")}</Button>}
          </div>
          <dl className="mt-5 grid gap-x-10 gap-y-5 sm:grid-cols-2">
            <DetailRow label={tClients("clientNameLabel")} value={detailsClient.name} />
            <DetailRow label={tClients("contactNameLabel")} value={detailsClient.contactName} />
            <DetailRow label={tClients("emailLabel")} value={detailsClient.email} bidi />
            <DetailRow label={tClients("phoneLabel")} value={detailsClient.phone} bidi />
            <DetailRow label={tClients("addressLabel")} value={detailsClient.address} />
            <DetailRow label={tClients("createdLabel")} value={new Date(detailsClient.createdAt).toLocaleDateString(detailsDateLocale)} />
          </dl>
          <div className="mt-8 border-t border-border pt-6">
            <h3 className="text-sm font-semibold text-foreground">{tClients("notesSection")}</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{detailsClient.notes || t("details.noNotes")}</p>
          </div>
        </section>
        {detailsClient.isActive && (
          <aside className="border-t border-border pt-6 lg:border-s lg:border-t-0 lg:ps-6 lg:pt-0">
            <h2 className="text-sm font-semibold text-foreground">{t("details.archiveTitle")}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{t("details.archiveDescription")}</p>
            <Button variant="ghost" size="sm" onClick={onArchive} className="mt-3 text-destructive hover:bg-destructive/10 hover:text-destructive">{tClients("archiveClientButton")}</Button>
          </aside>
        )}
      </div>
    );
  }

  function ProjectList({ projects, currency, clientId }: { projects: ClientWorkspaceData["projects"]; currency: string; clientId: string }) {
    if (projects.length === 0) {
      return (
        <div className="py-10 text-center">
          <p className="font-medium text-foreground">{t("projects.empty")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("projects.emptyHint")}</p>
          <Link href={`/projects?create=true&clientId=${clientId}`} className={`${buttonVariants({ variant: "outline", size: "sm" })} mt-4`}>{t("newProject")}</Link>
        </div>
      );
    }
    return (
      <ul className="divide-y divide-border">
        {projects.map((project) => (
          <li key={project.id} className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_8rem_9rem_3rem] sm:items-center sm:gap-5">
            <div className="min-w-0">
              <Link href={`/projects/${project.id}`} className="font-semibold text-foreground underline-offset-4 hover:underline">{project.name}</Link>
              <p className="mt-1 text-xs text-muted-foreground">{project.lastEntryAt ? t("projects.lastWork", { date: new Date(project.lastEntryAt).toLocaleDateString(dateLocale) }) : t("projects.noWork")}</p>
            </div>
            <div><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(project.status)}`}>{tClients(`projectStatus${project.status.charAt(0).toUpperCase()}${project.status.slice(1)}`)}</span></div>
            <div className="grid grid-cols-2 gap-3 sm:block">
              <span className="text-xs text-muted-foreground">{t("moneyTrail.unbilled")}</span>
              <p className="font-mono text-sm font-semibold tabular-nums text-foreground"><bdi>{formatCurrency(project.unbilledTotal, currency, locale)}</bdi></p>
              <p className="text-xs text-muted-foreground">{t("hours", { hours: project.totalHours.toFixed(1) })}</p>
            </div>
            <Link href={`/projects/${project.id}`} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-[var(--radius)] text-muted-foreground hover:bg-surface hover:text-foreground" aria-label={t("projects.open", { name: project.name })}><ArrowUpLeft className={`h-4 w-4 ${locale === "en" ? "scale-x-[-1]" : ""}`} aria-hidden="true" /></Link>
          </li>
        ))}
      </ul>
    );
  }

  function WorkspaceSkeleton() {
    return <div className="space-y-4" role="status"><span className="sr-only">{t("loading")}</span>{[0, 1, 2].map((item) => <div key={item} className="h-24 animate-pulse rounded-[var(--radius-card)] bg-surface" />)}</div>;
  }
  function WorkspaceError() {
    return <div className="rounded-[var(--radius)] border border-destructive/25 bg-destructive/10 p-5 text-sm text-destructive" role="alert">{t("error")}</div>;
  }
}

function MoneyStage({ icon: Icon, label, value, warn = false }: { icon: typeof BriefcaseBusiness; label: string; value: string; warn?: boolean }) {
  return (
    <div className="border-b border-border p-4 last:border-b-0 sm:[&:nth-child(odd)]:border-e sm:[&:nth-child(-n+2)]:border-b lg:border-b-0 lg:border-e lg:last:border-e-0">
      <dt className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><Icon className="h-4 w-4" aria-hidden="true" />{label}</dt>
      <dd className={`mt-2 font-mono text-lg font-semibold tabular-nums ${warn ? "text-warning" : "text-foreground"}`}><bdi>{value}</bdi></dd>
    </div>
  );
}

function DetailRow({ label, value, bidi = false }: { label: string; value: string | null | undefined; bidi?: boolean }) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm text-foreground">{value ? (bidi ? <bdi>{value}</bdi> : value) : "—"}</dd>
    </div>
  );
}

function HierarchyStep({ number, label, value, active = false }: { number: string; label: string; value: string; active?: boolean }) {
  return (
    <li className="border-b border-border p-4 last:border-b-0 sm:border-b-0 sm:border-e sm:last:border-e-0">
      <div className="flex items-center gap-2"><span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{number}</span><span className="text-xs font-semibold text-muted-foreground">{label}</span></div>
      <p className="mt-3 text-sm font-semibold text-foreground">{value}</p>
    </li>
  );
}
