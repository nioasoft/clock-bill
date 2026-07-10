import { useTranslations } from "next-intl";
import { CheckCircle2 } from "lucide-react";
import { Link } from "@/src/i18n/navigation";
import { ClockFaceMarks, GrainOverlay } from "@/components/ui/thematic-elements";

export function CTASection() {
  const t = useTranslations("Landing");

  return (
    <section aria-labelledby="landing-cta-heading" className="relative overflow-hidden bg-primary py-20 sm:py-24">
      <GrainOverlay />
      <ClockFaceMarks
        size={280}
        className="pointer-events-none absolute -bottom-24 end-[5%] text-primary-foreground opacity-[0.06]"
      />

      <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-9 px-4 sm:px-6 md:grid-cols-[minmax(0,1fr)_auto] lg:px-8">
        <div className="max-w-3xl text-start">
          <h2
            id="landing-cta-heading"
            className="text-balance font-display text-3xl font-bold text-primary-foreground sm:text-4xl"
          >
            {t("cta.heading")}
          </h2>
          <p className="mt-4 max-w-2xl text-pretty text-lg leading-relaxed text-primary-foreground/80">
            {t("cta.subheading")}
          </p>
          <p className="mt-5 flex items-start gap-2 text-sm font-medium text-primary-foreground/80">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{t("cta.socialProof")}</span>
          </p>
        </div>

        <Link
          href="/register"
          className="inline-flex min-h-12 items-center justify-center rounded-[var(--radius)] bg-background px-7 py-3 text-base font-semibold text-foreground transition-colors duration-150 hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
        >
          {t("cta.button")}
        </Link>
      </div>
    </section>
  );
}
