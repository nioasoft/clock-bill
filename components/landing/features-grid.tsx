"use client";

import { useState, useEffect, useRef, MouseEvent } from "react";
import { Timer, Boxes, LayoutGrid, Layers, Users, FileText, Calculator, CircleDollarSign, TrendingUp } from "lucide-react";
import { ClockFaceMarks } from "@/components/ui/thematic-elements";

const features = [
  {
    icon: Timer,
    title: "כמה טיימרים במקביל",
    description: "עובד על כמה לקוחות באותו זמן? פתח טיימר לכל אחד. כל אחד רץ ונעצר בנפרד.",
  },
  {
    icon: Boxes,
    title: "חיוב לפי פריטים",
    description: "לא רק שעות. כמות כפול מחיר ליחידה, מקטלוג הלקוח או פריט חד-פעמי.",
  },
  {
    icon: LayoutGrid,
    title: "לוח משימות (קנבן)",
    description: "גרור משימה ל'בעבודה' והטיימר נדלק לבד. גרור החוצה, ונשמרת רשומה.",
  },
  {
    icon: Layers,
    title: "תמחור גמיש",
    description: "שעתי, ריטיינר, חודשי קבוע או לפי פריטים. תעריף לכל לקוח בנפרד.",
  },
  {
    icon: Users,
    title: "לקוחות ופרויקטים",
    description: "כל הלקוחות במקום אחד: פרטי קשר, תעריפים והיסטוריית חיוב.",
  },
  {
    icon: FileText,
    title: "תעודות התחשבנות",
    description: "רכז שעות ופריטים לתעודה אחת, וייצא PDF בעברית מלאה עם הלוגו שלך.",
  },
  {
    icon: Calculator,
    title: "עיגול וכללי חיוב",
    description: "עגל זמן לשעה או לחצי שעה, לכל לקוח או פרויקט. החישוב מדויק, בלי לאבד דקות.",
  },
  {
    icon: CircleDollarSign,
    title: "מטבעות מרובים",
    description: "שקל, דולר, USDT, ביטקוין ואת'ריום. תעריף נפרד לכל לקוח.",
  },
  {
    icon: TrendingUp,
    title: "דשבורד ותובנות",
    description: "כמה נכנס החודש, לפי שעות, לפי פריטים ולפי פרויקט.",
  },
];

function FeatureCard({ feature, index }: { feature: typeof features[0]; index: number }) {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const cardRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setMousePosition({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="relative bg-card rounded-[var(--radius-card)] border border-border p-6 hover:shadow-lg hover:shadow-foreground/5 transition-shadow motion-safe:animate-fade-up"
      style={{
        animationDelay: `${index * 100}ms`,
      }}
    >
      {/* Spotlight effect */}
      <div
        className="absolute inset-0 rounded-[var(--radius-card)] opacity-0 hover:opacity-100 transition-opacity pointer-events-none"
        style={{
          background: isHovered
            ? `radial-gradient(300px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(168,98,45,0.06), transparent 60%)`
            : undefined,
        }}
      />

      {/* Content */}
      <div className="relative">
        <div className="w-12 h-12 rounded-lg flex items-center justify-center mb-4 overflow-hidden group">
          <ClockFaceMarks
            size={48}
            className="absolute text-primary/10 transition-transform group-hover:rotate-[15deg]"
          />
          <feature.icon className="relative h-6 w-6 text-primary" aria-hidden="true" />
        </div>
        <h3 className="text-lg font-display font-semibold text-foreground mb-2">
          {feature.title}
        </h3>
        <p className="text-muted-foreground text-sm leading-relaxed">
          {feature.description}
        </p>
      </div>
    </div>
  );
}

export function FeaturesGrid() {
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
    <section id="features" ref={sectionRef} className="py-20 sm:py-28 bg-surface">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-display font-bold text-foreground">
            כל מה שצריך כדי לנהל זמן וחיוב
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            כלים מקצועיים לפרילנסרים ולעצמאים, בעברית מלאה
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <FeatureCard key={feature.title} feature={feature} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
