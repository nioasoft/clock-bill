import { Link } from "@/src/i18n/navigation";
import { useTranslations } from "next-intl";
import { GrainOverlay, RadialLines, HourglassSVG } from "@/components/ui/thematic-elements";

export function CTASection() {
  const t = useTranslations("Landing");
  return (
    <section className="relative py-20 sm:py-28 overflow-hidden bg-gradient-to-br from-primary to-primary/85">
      <GrainOverlay />
      <RadialLines className="absolute inset-0 text-primary-foreground opacity-[0.05]" />

      {/* Decorative hourglass watermark */}
      <div className="absolute bottom-0 end-0 hidden sm:block">
        <HourglassSVG size={200} className="text-primary-foreground opacity-[0.06]" />
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
        <h2 className="text-3xl sm:text-4xl font-display font-bold text-primary-foreground">
          {t("cta.heading")}
        </h2>
        <p className="mt-4 text-lg text-primary-foreground/80 max-w-xl mx-auto">
          {t("cta.subheading")}
        </p>

        {/* Honest trust line (replaces a fabricated user count). */}
        <p className="mt-6 text-sm text-primary-foreground/80">{t("cta.socialProof")}</p>

        <div className="mt-10">
          <Link
            href="/register"
            className="inline-flex items-center justify-center rounded-full bg-background text-foreground px-10 py-4 text-base font-bold hover:bg-background/90 hover:scale-105 transition-all"
          >
            {t("cta.button")}
          </Link>
        </div>
      </div>
    </section>
  );
}
