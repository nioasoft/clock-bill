"use client";

import { useState } from "react";
import { Plus, Minus } from "lucide-react";
import { GrainOverlay } from "@/components/ui/thematic-elements";

const faqItems = [
  {
    question: "מי יכול להשתמש במוניט?",
    answer:
      "מוניט מיועד לפרילנסרים, יועצים עצמאיים, ובעלי עסקים קטנים שצריכים לעקוב אחרי שעות עבודה, לנהל לקוחות, ולייצר דוחות מקצועיים.",
  },
  {
    question: "זה באמת בחינם?",
    answer:
      "כן! מוניט חינמי לשימוש. אין תקופת ניסיון, אין כרטיס אשראי, ואין מגבלות נסתרות.",
  },
  {
    question: "האם הנתונים שלי מאובטחים?",
    answer:
      "בהחלט. הנתונים מאוחסנים בצורה מאובטחת עם הצפנה, וכל משתמש רואה רק את הנתונים שלו. אנחנו לא משתפים מידע עם צדדים שלישיים.",
  },
  {
    question: "האם אפשר לייצא דוחות בעברית?",
    answer:
      "כמובן! מוניט תומך בייצוא דוחות PDF מקצועיים בעברית מלאה עם תמיכה ב-RTL. יש 6 עיצובים לבחירה, ואפשר להעלות לוגו אישי.",
  },
  {
    question: "האם יש אפליקציה לנייד?",
    answer:
      "מוניט עובד מעולה בדפדפן הנייד ותומך בהתקנה כאפליקציה (PWA). אפשר להוסיף אותו למסך הבית ולהשתמש בו כמו אפליקציה רגילה.",
  },
  {
    question: "איך מגדירים מודלי תמחור?",
    answer:
      "בעת יצירת פרויקט, תוכל לבחור בין תמחור שעתי, חבילת שעות קבועה, או מודל משולב. כל פרויקט יכול להיות עם מודל תמחור שונה.",
  },
];

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq" className="relative py-20 sm:py-28 bg-surface">
      <GrainOverlay />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-display font-bold text-foreground">
            שאלות נפוצות
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
