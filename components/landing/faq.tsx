import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";

const FAQ_KEYS = ["q1", "q2", "q3", "q4", "q5", "q6", "q7", "q9", "q10", "q11"] as const;

export function FAQ() {
  const t = useTranslations("Landing");

  return (
    <section
      id="faq"
      aria-labelledby="faq-heading"
      className="scroll-mt-28 bg-surface py-20 sm:py-28"
    >
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <p className="text-sm font-semibold text-primary">{t("faq.eyebrow")}</p>
        <h2
          id="faq-heading"
          className="mt-3 text-balance font-display text-3xl font-bold text-foreground sm:text-4xl"
        >
          {t("faq.heading")}
        </h2>

        <div className="mt-10 border-y border-border">
          {FAQ_KEYS.map((key) => (
            <details key={key} className="group border-b border-border last:border-b-0">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-5 rounded-[var(--radius)] px-1 py-4 text-start text-base font-medium text-foreground transition-colors duration-150 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                <span>{t(`faq.${key}.question`)}</span>
                <Plus
                  className="h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-45 group-open:text-primary"
                  aria-hidden="true"
                />
              </summary>
              <p className="max-w-2xl pb-5 pe-10 text-base leading-relaxed text-muted-foreground">
                {t(`faq.${key}.answer`)}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
