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
    "block min-h-11 w-full rounded-[var(--radius)] border bg-background px-3 py-2 text-sm leading-5 text-foreground placeholder:text-muted-foreground/60 transition-[background-color,border-color,box-shadow,color] duration-[var(--transition-fast)] hover:border-border-strong focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60";
  const state = hasError
    ? "border-destructive/50 focus:border-destructive focus:ring-destructive/20"
    : "border-border focus:border-primary focus:ring-ring/30";
  return `${base} ${state}`;
}
