import { useTranslations } from "next-intl";
import { CheckCircle2, ClipboardCheck, ReceiptText, Timer } from "lucide-react";

const STEPS = [
  { key: "step1", icon: Timer },
  { key: "step2", icon: ClipboardCheck },
  { key: "step3", icon: ReceiptText },
  { key: "step4", icon: CheckCircle2 },
] as const;

export function HowItWorks() {
  const t = useTranslations("Landing");

  return (
    <section
      id="how-it-works"
      aria-labelledby="how-it-works-heading"
      className="scroll-mt-28 py-20 sm:py-28"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-5 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] md:items-end">
          <div>
            <p className="text-sm font-semibold text-primary">{t("howItWorks.eyebrow")}</p>
            <h2
              id="how-it-works-heading"
              className="mt-3 max-w-xl text-balance font-display text-3xl font-bold text-foreground sm:text-4xl"
            >
              {t("howItWorks.heading")}
            </h2>
          </div>
          <p className="max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground md:justify-self-end">
            {t("howItWorks.subheading")}
          </p>
        </div>

        <ol className="mt-14 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(({ key, icon: Icon }, index) => (
            <li key={key} className="border-t border-border pt-5">
              <div className="flex items-center justify-between gap-4">
                <span className="font-mono text-sm font-semibold tabular-nums text-muted-foreground">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-light text-primary">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
              </div>
              <h3 className="mt-6 text-xl font-semibold text-foreground">
                {t(`howItWorks.${key}.title`)}
              </h3>
              <p className="mt-2 text-base leading-relaxed text-muted-foreground">
                {t(`howItWorks.${key}.description`)}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
