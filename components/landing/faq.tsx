"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Minus } from "lucide-react";
import { GrainOverlay } from "@/components/ui/thematic-elements";

export function FAQ() {
  const t = useTranslations("Landing");
  const faqItems = [
    {
      question: t("faq.q1.question"),
      answer: t("faq.q1.answer"),
    },
    {
      question: t("faq.q2.question"),
      answer: t("faq.q2.answer"),
    },
    {
      question: t("faq.q3.question"),
      answer: t("faq.q3.answer"),
    },
    {
      question: t("faq.q4.question"),
      answer: t("faq.q4.answer"),
    },
    {
      question: t("faq.q5.question"),
      answer: t("faq.q5.answer"),
    },
    {
      question: t("faq.q6.question"),
      answer: t("faq.q6.answer"),
    },
    {
      question: t("faq.q7.question"),
      answer: t("faq.q7.answer"),
    },
    {
      question: t("faq.q8.question"),
      answer: t("faq.q8.answer"),
    },
    {
      question: t("faq.q9.question"),
      answer: t("faq.q9.answer"),
    },
    {
      question: t("faq.q10.question"),
      answer: t("faq.q10.answer"),
    },
    {
      question: t("faq.q11.question"),
      answer: t("faq.q11.answer"),
    },
    {
      question: t("faq.q12.question"),
      answer: t("faq.q12.answer"),
    },
  ];
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq" className="relative py-20 sm:py-28 bg-surface">
      <GrainOverlay />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-display font-bold text-foreground">
            {t("faq.heading")}
          </h2>
        </div>

        <div className="space-y-0">
          {faqItems.map((item, index) => {
            const isOpen = openIndex === index;
            return (
              <div
                key={index}
                className={`overflow-hidden transition-all ${
                  isOpen
                    ? "bg-card rounded-[var(--radius-card)] border border-border shadow-sm mb-3"
                    : "border-b border-border last:border-b-0"
                }`}
              >
                <button
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  className="group flex items-start justify-between w-full p-5 text-start hover:bg-muted/30 transition-colors"
                  aria-expanded={isOpen}
                  aria-controls={`faq-answer-${index}`}
                  id={`faq-question-${index}`}
                >
                  <div className="flex items-start gap-3 flex-1">
                    <div
                      className={`w-2 h-2 rounded-full mt-2 shrink-0 transition-colors ${
                        isOpen
                          ? "bg-primary"
                          : "bg-primary/40 group-hover:bg-primary"
                      }`}
                    />
                    <span className="font-medium text-foreground pe-4">
                      {item.question}
                    </span>
                  </div>
                  <div className="shrink-0 w-5 h-5 text-muted-foreground">
                    {isOpen ? (
                      <Minus className="w-5 h-5" aria-hidden="true" />
                    ) : (
                      <Plus className="w-5 h-5" aria-hidden="true" />
                    )}
                  </div>
                </button>
                <div
                  className={`grid transition-all duration-200 ease-in-out ${
                    isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                  }`}
                  id={`faq-answer-${index}`}
                  role="region"
                  aria-labelledby={`faq-question-${index}`}
                  aria-hidden={!isOpen}
                >
                  <div className="overflow-hidden">
                    <p className="px-5 pb-5 ps-10 text-muted-foreground leading-relaxed">
                      {item.answer}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
