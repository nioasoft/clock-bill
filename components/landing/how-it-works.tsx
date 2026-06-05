"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ClockFaceMarks } from "@/components/ui/thematic-elements";

export function HowItWorks() {
  const t = useTranslations("Landing");
  const steps = [
    {
      number: "1",
      title: t("howItWorks.step1.title"),
      description: t("howItWorks.step1.description"),
    },
    {
      number: "2",
      title: t("howItWorks.step2.title"),
      description: t("howItWorks.step2.description"),
    },
    {
      number: "3",
      title: t("howItWorks.step3.title"),
      description: t("howItWorks.step3.description"),
    },
  ];
  const [, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <section id="how-it-works" ref={sectionRef} className="py-20 sm:py-28">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-display font-bold text-foreground">
            {t("howItWorks.heading")}
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            {t("howItWorks.subheading")}
          </p>
        </div>

        {/* Desktop: Horizontal timeline */}
        <div className="hidden md:block">
          <ol className="relative flex items-center justify-between list-none p-0 m-0">
            {steps.map((step, index) => (
              <li
                key={step.number}
                className="flex-1 flex flex-col items-center motion-safe:animate-fade-up"
                style={{ animationDelay: `${index * 150}ms` }}
              >
                {/* Step circle with clock marks */}
                <div className="relative w-16 h-16 mb-6">
                  <ClockFaceMarks
                    size={64}
                    className="absolute inset-0 text-primary"
                  />
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center text-xl font-display font-bold text-primary-foreground">
                      {step.number}
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="text-center max-w-[200px]">
                  <h3 className="text-xl font-display font-semibold text-foreground mb-3">
                    {step.title}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed text-sm">
                    {step.description}
                  </p>
                </div>
              </li>
            ))}

            {/* Connecting dashed lines */}
            <div className="absolute top-8 right-[16.666%] left-[16.666%] h-0 border-t-2 border-dashed border-primary/20 -z-10" />
          </ol>
        </div>

        {/* Mobile: Vertical timeline */}
        <div className="md:hidden space-y-8">
          {steps.map((step, index) => (
            <div
              key={step.number}
              className="relative flex gap-6 motion-safe:animate-fade-up"
              style={{ animationDelay: `${index * 150}ms` }}
            >
              {/* Vertical line */}
              {index < steps.length - 1 && (
                <div className="absolute top-16 start-8 w-0 h-full border-s-2 border-dashed border-primary/20" />
              )}

              {/* Step circle with clock marks */}
              <div className="relative w-16 h-16 shrink-0">
                <ClockFaceMarks
                  size={64}
                  className="absolute inset-0 text-primary"
                />
                <div
                  aria-hidden="true"
                  className="absolute inset-0 flex items-center justify-center"
                >
                  <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center text-xl font-display font-bold text-primary-foreground">
                    {step.number}
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 pt-2">
                <h3 className="text-xl font-display font-semibold text-foreground mb-2">
                  {step.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
