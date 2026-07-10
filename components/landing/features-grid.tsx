import { useTranslations } from "next-intl";
import {
  Boxes,
  Calculator,
  CircleDollarSign,
  FileText,
  LayoutDashboard,
  LayoutGrid,
  Layers,
  Smartphone,
  Timer,
  TrendingUp,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

type FeatureKey =
  | "parallelTimers"
  | "itemBilling"
  | "kanban"
  | "flexiblePricing"
  | "clientsProjects"
  | "settlementDocs"
  | "rounding"
  | "multiCurrency"
  | "dashboard"
  | "getPaid"
  | "customDashboard"
  | "mobile";

interface FeatureDefinition {
  key: FeatureKey;
  icon: LucideIcon;
}

interface FeatureGroup {
  key: "capture" | "price" | "collect" | "workflow";
  features: FeatureDefinition[];
}

const GROUPS: FeatureGroup[] = [
  {
    key: "capture",
    features: [
      { key: "parallelTimers", icon: Timer },
      { key: "kanban", icon: LayoutGrid },
      { key: "itemBilling", icon: Boxes },
    ],
  },
  {
    key: "price",
    features: [
      { key: "flexiblePricing", icon: Layers },
      { key: "rounding", icon: Calculator },
      { key: "multiCurrency", icon: CircleDollarSign },
    ],
  },
  {
    key: "collect",
    features: [
      { key: "settlementDocs", icon: FileText },
      { key: "getPaid", icon: Wallet },
      { key: "dashboard", icon: TrendingUp },
    ],
  },
  {
    key: "workflow",
    features: [
      { key: "clientsProjects", icon: Users },
      { key: "customDashboard", icon: LayoutDashboard },
      { key: "mobile", icon: Smartphone },
    ],
  },
];

export function FeaturesGrid() {
  const t = useTranslations("Landing");

  return (
    <section
      id="features"
      aria-labelledby="features-heading"
      className="scroll-mt-28 bg-surface py-20 sm:py-28"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold text-primary">{t("features.eyebrow")}</p>
          <h2
            id="features-heading"
            className="mt-3 text-balance font-display text-3xl font-bold text-foreground sm:text-4xl"
          >
            {t("features.heading")}
          </h2>
          <p className="mt-4 text-pretty text-lg leading-relaxed text-muted-foreground">
            {t("features.subheading")}
          </p>
        </div>

        <div className="mt-14 border-y border-border">
          {GROUPS.map((group, groupIndex) => (
            <section
              key={group.key}
              aria-labelledby={`feature-group-${group.key}`}
              className={`grid gap-8 py-9 md:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)] md:gap-12 ${
                groupIndex < GROUPS.length - 1 ? "border-b border-border" : ""
              }`}
            >
              <div>
                <span className="font-mono text-xs font-semibold tabular-nums text-muted-foreground">
                  {String(groupIndex + 1).padStart(2, "0")}
                </span>
                <h3
                  id={`feature-group-${group.key}`}
                  className="mt-3 text-2xl font-semibold text-foreground"
                >
                  {t(`features.groups.${group.key}.title`)}
                </h3>
                <p className="mt-3 max-w-md text-base leading-relaxed text-muted-foreground">
                  {t(`features.groups.${group.key}.description`)}
                </p>
              </div>

              <ul className="grid gap-6 sm:grid-cols-3">
                {group.features.map(({ key, icon: Icon }) => (
                  <li key={key} className="min-w-0 border-t border-border pt-4">
                    <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
                    <h4 className="mt-4 text-base font-semibold text-foreground">
                      {t(`features.${key}.title`)}
                    </h4>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {t(`features.${key}.description`)}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </section>
  );
}
