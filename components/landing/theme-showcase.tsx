"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check, Palette } from "lucide-react";
import { THEMES, isThemeId, DEFAULT_THEME, type ThemeMeta } from "@/lib/themes";
import { ClockFaceMarks } from "@/components/ui/thematic-elements";

/**
 * Interactive color-theme showcase for the marketing page. Clicking a swatch
 * live-recolors the ENTIRE landing page by setting `data-theme` on <html>
 * directly — no cookie, no profile PATCH (the visitor is logged out, so the
 * authenticated theme path would 401). Safe from the global ThemeProvider,
 * whose effect only re-asserts `data-theme` when `profile?.theme` changes,
 * which never fires for a logged-out user. The choice is intentionally NOT
 * persisted: a reload returns to the default theme.
 */
function ThemeButton({
  theme,
  label,
  selected,
  onSelect,
}: {
  theme: ThemeMeta;
  label: string;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(theme.id)}
      aria-pressed={selected}
      aria-label={label}
      className={`flex min-h-[44px] items-center gap-3 rounded-[var(--radius-card)] border p-3 text-start transition-colors ${
        selected
          ? "border-foreground/50 ring-2 ring-ring"
          : "border-foreground/50 hover:bg-card-elevated"
      }`}
    >
      <span className="relative flex shrink-0 gap-1">
        {theme.swatch.map((c, i) => (
          <span
            key={i}
            style={{ background: c }}
            className="size-5 rounded-full border border-foreground/50"
          />
        ))}
      </span>
      <span className="flex-1 text-sm font-medium text-foreground">{label}</span>
      {selected && <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />}
    </button>
  );
}

export function ThemeShowcase() {
  const t = useTranslations("Landing");
  const locale = useLocale();
  const isHebrew = locale === "he";
  // Seed from whatever the no-flash script / ThemeProvider already applied.
  const [selected, setSelected] = useState(DEFAULT_THEME);

  useEffect(() => {
    // Sync the highlighted swatch with whatever theme is already on <html>
    // (set by the no-flash script). Deferred to a microtask to keep setState
    // out of the synchronous effect body (react-hooks/set-state-in-effect).
    const current = document.documentElement.dataset.theme;
    if (isThemeId(current)) queueMicrotask(() => setSelected(current));
  }, []);

  const apply = (id: string) => {
    if (!isThemeId(id)) return;
    document.documentElement.dataset.theme = id; // live preview only, not persisted
    setSelected(id);
  };

  const label = (th: ThemeMeta) => (isHebrew ? th.labelHe : th.labelEn);
  const dark = THEMES.filter((th) => th.base === "dark");
  const light = THEMES.filter((th) => th.base === "light");

  return (
    <section id="themes" aria-labelledby="themes-heading" className="scroll-mt-28 bg-surface py-20 sm:py-28">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <div className="relative mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg">
            <ClockFaceMarks size={48} className="absolute text-primary/10" />
            <Palette className="relative h-6 w-6 text-primary" aria-hidden="true" />
          </div>
          <h2 id="themes-heading" className="font-display text-3xl font-bold text-foreground sm:text-4xl">
            {t("themes.heading")}
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            {t("themes.subheading")}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          {[
            { key: "dark", items: dark, title: t("themes.darkLabel") },
            { key: "light", items: light, title: t("themes.lightLabel") },
          ].map((group) => (
            <div key={group.key}>
              <h3 className="mb-3 text-sm font-medium text-muted-foreground">{group.title}</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {group.items.map((th) => (
                  <ThemeButton
                    key={th.id}
                    theme={th}
                    label={label(th)}
                    selected={selected === th.id}
                    onSelect={apply}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="mt-8 text-center text-sm text-muted-foreground">
          {t("themes.previewNote")}
        </p>
      </div>
    </section>
  );
}
