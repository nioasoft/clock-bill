interface BrandMarkProps {
  className?: string;
  /** Pixel size; omit to size via className (w-/h-). */
  size?: number;
}

/**
 * ClockBill logo mark — a stopwatch (with crown) wrapping a play button
 * ("start tracking"). Monochrome via `currentColor`, so it inherits the parent's
 * text color and works on any of the app's themes. Inside the yellow brand
 * square use `text-primary-foreground` (black on yellow).
 */
export function BrandMark({ className, size }: BrandMarkProps) {
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M24 13 V8" strokeWidth={3} />
      <path d="M20.5 8 H27.5" strokeWidth={3} />
      <path d="M34 16.5 l2 -2" strokeWidth={3} />
      <circle cx="24" cy="26" r="13" strokeWidth={2.8} />
      <path d="M20 19.5 L30.5 26 L20 32.5 Z" fill="currentColor" stroke="none" />
    </svg>
  );
}
