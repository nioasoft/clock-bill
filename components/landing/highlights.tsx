import { ReactNode } from "react";
import { Clock, Boxes, LayoutGrid, ArrowLeft } from "lucide-react";
import { ClockFaceMarks } from "@/components/ui/thematic-elements";

/**
 * Dedicated highlight section: three standout flows shown in more depth than a
 * feature-card allows. Each row alternates the text/visual sides on desktop and
 * stacks (text first) on mobile. Visuals are lightweight faux-UI mocks built
 * from design tokens, matching the hero mock language. Server component (no
 * client hooks) — animations are CSS-only.
 */

interface Highlight {
  eyebrow: string;
  title: string;
  body: string;
  visual: ReactNode;
}

/** Parallel timers running for several clients at once. */
function TimersMock() {
  const rows = [
    { client: "סטודיו אורן", time: "01:24", live: true },
    { client: 'עו"ד לוי', time: "00:47", live: true },
    { client: "חברת נוֹבָה", time: "02:08", live: false },
  ];
  return (
    <div className="w-full rounded-[var(--radius-card)] border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">טיימרים פעילים</span>
        <span className="text-xs font-medium text-primary">3 רצים</span>
      </div>
      <div className="space-y-3">
        {rows.map((row) => (
          <div
            key={row.client}
            className="flex items-center justify-between rounded-[var(--radius)] border border-border bg-surface px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <span
                className={`h-2 w-2 rounded-full ${
                  row.live ? "bg-success" : "bg-muted"
                }`}
              />
              <span className="text-sm text-foreground">{row.client}</span>
            </div>
            <span className="font-mono text-sm tabular-nums text-foreground">
              {row.time}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Item-based billing: quantity × unit price → line total. */
function ItemsMock() {
  const items = [
    { name: "רישיון שימוש", qty: "2", unit: "₪450", total: "₪900" },
    { name: "תיקון תקלה", qty: "1", unit: "₪320", total: "₪320" },
    { name: "ייעוץ נקודתי", qty: "3", unit: "₪200", total: "₪600" },
  ];
  return (
    <div className="w-full rounded-[var(--radius-card)] border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between text-xs text-muted-foreground">
        <span>פריט</span>
        <span>כמות × יחידה</span>
      </div>
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.name} className="flex items-center justify-between">
            <span className="text-sm text-foreground">{item.name}</span>
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs tabular-nums text-muted-foreground">
                {item.qty} × {item.unit}
              </span>
              <span className="font-mono text-sm tabular-nums text-foreground">
                {item.total}
              </span>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
        <span className="text-sm font-medium text-foreground">סך הכל</span>
        <span className="font-mono text-base font-bold tabular-nums text-primary">
          ₪1,820
        </span>
      </div>
    </div>
  );
}

/** Task → timer → settlement document → PDF flow. */
function FlowMock() {
  const steps = [
    { label: "משימה ל'בעבודה'", note: "הטיימר נדלק לבד" },
    { label: "רשומת זמן נשמרת", note: "ללקוח הנכון" },
    { label: "תעודת התחשבנות", note: "ייצוא PDF בעברית" },
  ];
  return (
    <div className="w-full rounded-[var(--radius-card)] border border-border bg-card p-5">
      <div className="space-y-3">
        {steps.map((step, i) => (
          <div key={step.label}>
            <div className="flex items-center justify-between rounded-[var(--radius)] border border-border bg-surface px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 font-mono text-xs text-primary">
                  {i + 1}
                </span>
                <span className="text-sm text-foreground">{step.label}</span>
              </div>
              <span className="text-xs text-muted-foreground">{step.note}</span>
            </div>
            {i < steps.length - 1 && (
              <div className="flex justify-center py-1">
                <ArrowLeft className="h-4 w-4 rotate-90 text-muted-foreground" aria-hidden="true" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const highlights: Highlight[] = [
  {
    eyebrow: "טיימרים מקבילים",
    title: "כמה טיימרים, בו-זמנית",
    body: "עובד על שלושה לקוחות באותו בוקר? הפעל טיימר לכל אחד. כל אחד רץ בנפרד, נעצר בנפרד, ונכנס לרשומות הנכונות. בלי לחשב הכל בראש בסוף היום.",
    visual: <TimersMock />,
  },
  {
    eyebrow: "חיוב לפי פריטים",
    title: "לא הכל נמדד בשעות",
    body: "יש עבודות שמחויבות לפי פריט: רישיון, תיקון, ייעוץ נקודתי. מוסיפים כמות ומחיר ליחידה, שומרים בקטלוג של הלקוח, ומוציאים לחיוב בדיוק כמו שעה.",
    visual: <ItemsMock />,
  },
  {
    eyebrow: "ממשימה לחיוב",
    title: "בלי להעתיק כלום ביד",
    body: "גרור משימה בלוח הקנבן ל'בעבודה', והטיימר נדלק לבד. סיימת? הרשומה כבר מחכה. בסוף החודש מרכזים הכל לתעודת התחשבנות ומוציאים PDF בעברית.",
    visual: <FlowMock />,
  },
];

const icons = [Clock, Boxes, LayoutGrid];

export function Highlights() {
  return (
    <section className="py-20 sm:py-28 bg-background">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-display font-bold text-foreground">
            לא עוד טיימר. כלי חיוב שלם.
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            מהרגע שהתחלת לעבוד ועד שהחיוב מוכן
          </p>
        </div>

        <div className="space-y-16 sm:space-y-24">
          {highlights.map((item, index) => {
            const Icon = icons[index];
            const reversed = index % 2 === 1;
            return (
              <div
                key={item.title}
                className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center"
              >
                {/* Text side */}
                <div className={reversed ? "lg:order-2" : "lg:order-1"}>
                  <div className="relative mb-4 inline-flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg">
                    <ClockFaceMarks size={48} className="absolute text-primary/10" />
                    <Icon className="relative h-6 w-6 text-primary" aria-hidden="true" />
                  </div>
                  <span className="block text-sm font-medium text-primary mb-2">
                    {item.eyebrow}
                  </span>
                  <h3 className="text-2xl sm:text-3xl font-display font-bold text-foreground">
                    {item.title}
                  </h3>
                  <p className="mt-4 text-lg text-muted-foreground leading-relaxed max-w-xl">
                    {item.body}
                  </p>
                </div>

                {/* Visual side */}
                <div className={reversed ? "lg:order-1" : "lg:order-2"}>
                  {item.visual}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
