"use client";

import { useState } from "react";
import { Plus, Minus } from "lucide-react";
import { GrainOverlay } from "@/components/ui/thematic-elements";

const faqItems = [
  {
    question: "מי יכול להשתמש במוניט?",
    answer:
      "מוניט מיועד לפרילנסרים, ליועצים עצמאיים ולבעלי עסקים קטנים שצריכים לעקוב אחרי שעות עבודה, לנהל לקוחות, ולהוציא חיוב מסודר.",
  },
  {
    question: "זה באמת בחינם?",
    answer:
      "כן, היום זה חינם. מוניט בתקופת בטא, והשימוש כרגע לא עולה כלום, בלי כרטיס אשראי. גם בהמשך, ניהול של עד שלושה לקוחות יישאר חינם. אם נוסיף תוכניות בתשלום לשימוש מורחב, נודיע על כך מראש ולא נחייב אף אחד בלי שיבחר בזה.",
  },
  {
    question: "אפשר להפעיל כמה טיימרים במקביל?",
    answer:
      "בהחלט. אם אתה עובד על כמה לקוחות באותו זמן, פתח טיימר לכל אחד. כל טיימר רץ ונעצר בנפרד, וכל רשומה נכנסת ללקוח ולפרויקט הנכונים.",
  },
  {
    question: "מה זה חיוב לפי פריטים?",
    answer:
      "מעבר לחיוב שעתי, אפשר לחייב לפי פריטים: כמות כפול מחיר ליחידה. שומרים פריטים קבועים בקטלוג של כל לקוח, או מוסיפים פריט חד-פעמי תוך כדי. מתאים לתיקונים, רישיונות או כל עבודה שלא נמדדת בשעות.",
  },
  {
    question: "תעודת ההתחשבנות היא חשבונית מס?",
    answer:
      "לא. תעודת ההתחשבנות היא סיכום פנימי שמרכז את השעות והפריטים לחיוב, לנוחות שלך ושל הלקוח. היא לא מהווה חשבונית מס או קבלה. את מסמכי המס הרשמיים אתה ממשיך להפיק כרגיל דרך מערכת החשבוניות שלך.",
  },
  {
    question: "האם הנתונים שלי מאובטחים?",
    answer:
      "בהחלט. הנתונים מאוחסנים בשרתים מוצפנים באיחוד האירופי, וכל משתמש רואה אך ורק את המידע שלו, גם ברמת מסד הנתונים. איננו מוכרים מידע ולא משתפים אותו עם מפרסמים.",
  },
  {
    question: "האם אפשר לייצא דוחות בעברית?",
    answer:
      "כן. מוניט מייצא דוחות ותעודות PDF בעברית מלאה עם תמיכת RTL. יש כמה עיצובים לבחירה, ואפשר להעלות לוגו אישי.",
  },
  {
    question: "האם יש אפליקציה לנייד?",
    answer:
      "מוניט עובד מעולה בדפדפן הנייד ותומך בהתקנה כאפליקציה (PWA). אפשר להוסיף אותו למסך הבית ולהשתמש בו כמו אפליקציה רגילה.",
  },
  {
    question: "איך מגדירים מודלי תמחור?",
    answer:
      "כל לקוח מקבל תעריף משלו: שעתי, ריטיינר חודשי, חיוב חודשי קבוע או חיוב לפי פריטים. אפשר גם לקבוע עיגול זמן לכל לקוח או פרויקט.",
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
