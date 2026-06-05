import { Link } from "@/src/i18n/navigation";
import { GrainOverlay, RadialLines, HourglassSVG } from "@/components/ui/thematic-elements";

export function CTASection() {
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
          מוכן לנהל את הזמן שלך בצורה חכמה?
        </h2>
        <p className="mt-4 text-lg text-primary-foreground/80 max-w-xl mx-auto">
          הצטרפו ל-500+ פרילנסרים שכבר משתמשים במוניט
        </p>

        {/* Social proof avatars */}
        <div className="mt-6 flex items-center justify-center gap-2">
          <div className="flex -space-s-2" dir="ltr">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="w-10 h-10 rounded-full bg-primary-foreground/10 border-2 border-primary-foreground/25 flex items-center justify-center text-xs font-bold text-primary-foreground"
              >
                {String.fromCharCode(64 + i)}
              </div>
            ))}
          </div>
          <span className="text-sm text-primary-foreground/70 ms-3">הצטרפו ל-500+ פרילנסרים</span>
        </div>

        <div className="mt-10">
          <Link
            href="/register"
            className="inline-flex items-center justify-center rounded-full bg-background text-foreground px-10 py-4 text-base font-bold hover:bg-background/90 hover:scale-105 transition-all"
          >
            צור חשבון בחינם
          </Link>
        </div>
      </div>
    </section>
  );
}
