import { useLocale, useTranslations } from "next-intl";
import {
  CheckCircle2,
  ClipboardCheck,
  ReceiptText,
  Timer,
} from "lucide-react";
import { Link } from "@/src/i18n/navigation";
import { brandName } from "@/lib/brand";
import {
  ClockFaceMarks,
  GrainOverlay,
  HourglassSVG,
  RadialLines,
} from "@/components/ui/thematic-elements";

const TRAIL_STEPS = [
  { key: "work", icon: Timer },
  { key: "recorded", icon: ClipboardCheck },
  { key: "ready", icon: ReceiptText },
  { key: "paid", icon: CheckCircle2 },
] as const;

export function Hero() {
  const t = useTranslations("Landing");
  const locale = useLocale();

  return (
    <section
      aria-labelledby="landing-hero-heading"
      className="relative overflow-hidden pb-20 pt-32 sm:pb-28 sm:pt-36 lg:pb-32 lg:pt-40"
    >
      <GrainOverlay />
      <RadialLines className="pointer-events-none absolute inset-0 -z-10 text-primary opacity-[0.035]" />
      <div className="pointer-events-none absolute -top-12 end-[6%] -z-10 hidden text-primary opacity-10 lg:block">
        <HourglassSVG size={220} />
      </div>

      <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,0.9fr)] lg:gap-16 lg:px-8">
        <div className="text-start">
          <p className="mb-5 inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium text-muted-foreground">
            <ClockFaceMarks size={18} className="text-primary" aria-hidden="true" />
            {t("hero.eyebrow", { brand: brandName(locale) })}
          </p>

          <h1
            id="landing-hero-heading"
            className="max-w-3xl text-balance font-display text-4xl font-bold leading-[1.12] text-foreground sm:text-5xl lg:text-6xl"
          >
            {t("hero.headlinePrefix")}{" "}
            <span className="text-primary">{t("hero.headlineSuffix")}</span>
          </h1>

          <p className="mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground sm:text-xl">
            {t("hero.subhead", { brand: brandName(locale) })}
          </p>

          <ul className="mt-7 grid max-w-2xl gap-3 text-sm text-foreground sm:grid-cols-2 sm:text-base">
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden="true" />
              <span>{t("hero.benefitCapture")}</span>
            </li>
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden="true" />
              <span>{t("hero.benefitBalance")}</span>
            </li>
          </ul>

          <div className="mt-9 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            <Link
              href="/register"
              className="inline-flex min-h-12 items-center justify-center rounded-[var(--radius)] bg-primary px-7 py-3 text-base font-semibold text-primary-foreground transition-colors duration-150 hover:bg-primary-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {t("hero.ctaPrimary")}
            </Link>
            <a
              href="#how-it-works"
              className="inline-flex min-h-12 items-center justify-center rounded-[var(--radius)] border border-border bg-card px-7 py-3 text-base font-medium text-foreground transition-colors duration-150 hover:border-border-strong hover:bg-card-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {t("hero.ctaSecondary")}
            </a>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            {t("hero.ctaNote")}
          </p>
        </div>

        <figure className="relative rounded-[var(--radius-card)] border border-border bg-card p-5 sm:p-7">
          <figcaption className="flex items-center justify-between gap-4 border-b border-border pb-5">
            <div>
              <p className="text-sm font-medium text-foreground">{t("hero.trail.heading")}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t("hero.trail.description")}</p>
            </div>
            <span className="shrink-0 rounded-full bg-primary-light px-3 py-1.5 text-xs font-semibold text-primary">
              {t("hero.trail.live")}
            </span>
          </figcaption>

          <ol className="mt-2">
            {TRAIL_STEPS.map(({ key, icon: Icon }, index) => (
              <li
                key={key}
                className="relative grid grid-cols-[2.75rem_minmax(0,1fr)] gap-3 py-4"
              >
                {index < TRAIL_STEPS.length - 1 && (
                  <span
                    aria-hidden="true"
                    className="absolute start-[1.35rem] top-11 h-[calc(100%-1.5rem)] w-px bg-border"
                  />
                )}
                <span className="relative z-10 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface text-primary">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="flex min-w-0 items-center justify-between gap-4 border-b border-border pb-4 last:border-b-0">
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-foreground">
                      {t(`hero.trail.${key}.label`)}
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                      {t(`hero.trail.${key}.note`)}
                    </span>
                  </span>
                  <bdi className="shrink-0 font-mono text-sm font-semibold tabular-nums text-foreground">
                    {t(`hero.trail.${key}.value`)}
                  </bdi>
                </span>
              </li>
            ))}
          </ol>

          <p className="mt-2 rounded-[var(--radius)] bg-primary-light px-4 py-3 text-sm font-medium text-primary">
            {t("hero.trail.summary")}
          </p>
        </figure>
      </div>
    </section>
  );
}
