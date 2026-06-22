import { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Clock, Boxes, LayoutGrid, ArrowLeft, Wallet } from "lucide-react";
import { ClockFaceMarks } from "@/components/ui/thematic-elements";

/**
 * Dedicated highlight section: three standout flows shown in more depth than a
 * feature-card allows. Each row alternates the text/visual sides on desktop and
 * stacks (text first) on mobile. Visuals are lightweight faux-UI mocks built
 * from design tokens, matching the hero mock language. Server component (no
 * client hooks) — animations are CSS-only.
 */

interface Highlight {
  eyebrow: string;
  title: string;
  body: string;
  visual: ReactNode;
}

/** Parallel timers running for several clients at once. */
function TimersMock({ t }: { t: ReturnType<typeof useTranslations> }) {
  const rows = [
    { client: t("highlights.timers.mock.client1"), time: "01:24", live: true },
    { client: t("highlights.timers.mock.client2"), time: "00:47", live: true },
    { client: t("highlights.timers.mock.client3"), time: "02:08", live: false },
  ];
  return (
    <div className="w-full rounded-[var(--radius-card)] border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{t("highlights.timers.mock.activeTimers")}</span>
        <span className="text-xs font-medium text-primary">{t("highlights.timers.mock.running", { count: 3 })}</span>
      </div>
      <div className="space-y-3">
        {rows.map((row) => (
          <div
            key={row.client}
            className="flex items-center justify-between rounded-[var(--radius)] border border-border bg-surface px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <span
                className={`h-2 w-2 rounded-full ${
                  row.live ? "bg-success" : "bg-muted"
                }`}
              />
              <span className="text-sm text-foreground">{row.client}</span>
            </div>
            <span className="font-mono text-sm tabular-nums text-foreground">
              {row.time}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Item-based billing: quantity × unit price → line total. */
function ItemsMock({ t }: { t: ReturnType<typeof useTranslations> }) {
  const items = [
    { name: t("highlights.items.mock.item1"), qty: "2", unit: "₪450", total: "₪900" },
    { name: t("highlights.items.mock.item2"), qty: "1", unit: "₪320", total: "₪320" },
    { name: t("highlights.items.mock.item3"), qty: "3", unit: "₪200", total: "₪600" },
  ];
  return (
    <div className="w-full rounded-[var(--radius-card)] border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between text-xs text-muted-foreground">
        <span>{t("highlights.items.mock.itemLabel")}</span>
        <span>{t("highlights.items.mock.qtyUnitLabel")}</span>
      </div>
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.name} className="flex items-center justify-between">
            <span className="text-sm text-foreground">{item.name}</span>
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs tabular-nums text-muted-foreground">
                {item.qty} × {item.unit}
              </span>
              <span className="font-mono text-sm tabular-nums text-foreground">
                {item.total}
              </span>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
        <span className="text-sm font-medium text-foreground">{t("highlights.items.mock.total")}</span>
        <span className="font-mono text-base font-bold tabular-nums text-primary">
          ₪1,820
        </span>
      </div>
    </div>
  );
}

/** Task → timer → settlement document → PDF flow. */
function FlowMock({ t }: { t: ReturnType<typeof useTranslations> }) {
  const steps = [
    { label: t("highlights.flow.mock.step1.label"), note: t("highlights.flow.mock.step1.note") },
    { label: t("highlights.flow.mock.step2.label"), note: t("highlights.flow.mock.step2.note") },
    { label: t("highlights.flow.mock.step3.label"), note: t("highlights.flow.mock.step3.note") },
  ];
  return (
    <div className="w-full rounded-[var(--radius-card)] border border-border bg-card p-5">
      <div className="space-y-3">
        {steps.map((step, i) => (
          <div key={step.label}>
            <div className="flex items-center justify-between rounded-[var(--radius)] border border-border bg-surface px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 font-mono text-xs text-primary">
                  {i + 1}
                </span>
                <span className="text-sm text-foreground">{step.label}</span>
              </div>
              <span className="text-xs text-muted-foreground">{step.note}</span>
            </div>
            {i < steps.length - 1 && (
              <div className="flex justify-center py-1">
                <ArrowLeft className="h-4 w-4 rotate-90 text-muted-foreground" aria-hidden="true" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Get-paid flow: a settlement document sent to the client, paid down to zero. */
function GetPaidMock({ t }: { t: ReturnType<typeof useTranslations> }) {
  return (
    <div className="w-full rounded-[var(--radius-card)] border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">{t("highlights.getPaid.mock.docLabel")}</span>
        <span className="rounded-full bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
          {t("highlights.getPaid.mock.sent")}
        </span>
      </div>
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{t("highlights.getPaid.mock.subtotal")}</span>
          <span className="font-mono text-sm tabular-nums text-foreground">₪1,820</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{t("highlights.getPaid.mock.discount")}</span>
          <span className="font-mono text-sm tabular-nums text-muted-foreground">−₪180</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{t("highlights.getPaid.mock.paid")}</span>
          <span className="font-mono text-sm tabular-nums text-foreground">₪1,640</span>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
        <span className="text-sm font-medium text-foreground">{t("highlights.getPaid.mock.balance")}</span>
        <span className="flex items-center gap-2">
          <span className="font-mono text-base font-bold tabular-nums text-foreground">₪0</span>
          <span className="rounded-full bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
            {t("highlights.getPaid.mock.settled")}
          </span>
        </span>
      </div>
    </div>
  );
}

const icons = [Clock, Boxes, LayoutGrid, Wallet];

export function Highlights() {
  const t = useTranslations("Landing");
  const highlights: Highlight[] = [
    {
      eyebrow: t("highlights.timers.eyebrow"),
      title: t("highlights.timers.title"),
      body: t("highlights.timers.body"),
      visual: <TimersMock t={t} />,
    },
    {
      eyebrow: t("highlights.items.eyebrow"),
      title: t("highlights.items.title"),
      body: t("highlights.items.body"),
      visual: <ItemsMock t={t} />,
    },
    {
      eyebrow: t("highlights.flow.eyebrow"),
      title: t("highlights.flow.title"),
      body: t("highlights.flow.body"),
      visual: <FlowMock t={t} />,
    },
    {
      eyebrow: t("highlights.getPaid.eyebrow"),
      title: t("highlights.getPaid.title"),
      body: t("highlights.getPaid.body"),
      visual: <GetPaidMock t={t} />,
    },
  ];
  return (
    <section className="py-20 sm:py-28 bg-background">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-display font-bold text-foreground">
            {t("highlights.heading")}
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            {t("highlights.subheading")}
          </p>
        </div>

        <div className="space-y-16 sm:space-y-24">
          {highlights.map((item, index) => {
            const Icon = icons[index];
            const reversed = index % 2 === 1;
            return (
              <div
                key={item.title}
                className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center"
              >
                {/* Text side */}
                <div className={reversed ? "lg:order-2" : "lg:order-1"}>
                  <div className="relative mb-4 inline-flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg">
                    <ClockFaceMarks size={48} className="absolute text-primary/10" />
                    <Icon className="relative h-6 w-6 text-primary" aria-hidden="true" />
                  </div>
                  <span className="block text-sm font-medium text-primary mb-2">
                    {item.eyebrow}
                  </span>
                  <h3 className="text-2xl sm:text-3xl font-display font-bold text-foreground">
                    {item.title}
                  </h3>
                  <p className="mt-4 text-lg text-muted-foreground leading-relaxed max-w-xl">
                    {item.body}
                  </p>
                </div>

                {/* Visual side */}
                <div className={reversed ? "lg:order-1" : "lg:order-2"}>
                  {item.visual}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
