/**
 * Shared form-control styling for the dark ClickHouse theme.
 *
 * One source of truth for input / select / textarea base classes so every form
 * looks identical: darker `bg-background` field on the `bg-card` surface, a
 * hairline border, and a yellow focus ring — no drop shadows (depth comes from
 * canvas/surface contrast, per the design system).
 */
export function fieldClass(hasError = false): string {
  const base =
    "block w-full rounded-[var(--radius)] border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 transition-colors focus:outline-none focus:ring-2 disabled:opacity-50";
  const state = hasError
    ? "border-destructive/50 focus:border-destructive focus:ring-destructive/20"
    : "border-border focus:border-primary focus:ring-ring/30";
  return `${base} ${state}`;
}
