import { notFound } from "next/navigation";

/**
 * Catch-all for unmatched paths inside the locale tree. Calling `notFound()`
 * here renders `app/[locale]/not-found.tsx` INSIDE the locale layout, so the
 * 404 page gets globals.css / fonts / theme — the root `app/not-found.tsx`
 * renders without any layout and shows up unstyled.
 */
export default function CatchAllNotFound(): never {
  notFound();
}
