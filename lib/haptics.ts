/**
 * Lightweight haptic feedback (Vibration API). No-op on unsupported devices
 * (notably iOS Safari, which doesn't expose navigator.vibrate) and on the server.
 */
type HapticPattern = "light" | "success" | "warning";

const PATTERNS: Record<HapticPattern, number | number[]> = {
  light: 15,
  success: [15, 40, 15],
  warning: [30, 50, 30],
};

export function haptic(pattern: HapticPattern = "light"): void {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  try {
    navigator.vibrate(PATTERNS[pattern]);
  } catch {
    // ignore — vibration is best-effort
  }
}
