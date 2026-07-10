interface ThematicProps {
  size?: number;
  className?: string;
}

/**
 * Round to 3 decimals. Trig results can differ in their last float digit between
 * the Node server and the browser, which trips React's hydration check on SVG
 * coordinate attributes. Rounding makes both sides serialize identically.
 */
const round3 = (n: number): number => Math.round(n * 1000) / 1000;

export function ClockFaceMarks({
  size = 48,
  className = "",
  color = "currentColor",
}: ThematicProps & { color?: string }) {
  const marks = Array.from({ length: 12 }, (_, i) => {
    const angle = (i * 30 * Math.PI) / 180;
    const outer = size / 2 - 2;
    const inner = outer - (i % 3 === 0 ? size * 0.15 : size * 0.08);
    return {
      x1: round3(size / 2 + Math.sin(angle) * inner),
      y1: round3(size / 2 - Math.cos(angle) * inner),
      x2: round3(size / 2 + Math.sin(angle) * outer),
      y2: round3(size / 2 - Math.cos(angle) * outer),
      isHour: i % 3 === 0,
    };
  });

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
      className={className}
    >
      {marks.map((m, i) => (
        <line
          key={i}
          x1={m.x1}
          y1={m.y1}
          x2={m.x2}
          y2={m.y2}
          stroke={color}
          strokeWidth={m.isHour ? 2 : 1}
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}

export function HourglassSVG({
  size = 48,
  className = "",
}: ThematicProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      {/* Top triangle */}
      <path
        d="M12 8h24v2c0 6-5 11-12 14C17 21 12 16 12 10V8z"
        fill="currentColor"
        opacity={0.15}
      />
      {/* Bottom triangle */}
      <path
        d="M12 40h24v-2c0-6-5-11-12-14C17 27 12 32 12 38v2z"
        fill="currentColor"
        opacity={0.25}
      />
      {/* Frame */}
      <path
        d="M10 6h28M10 42h28M12 6v4c0 6.5 5 12 12 15-7 3-12 8.5-12 15v4M36 6v4c0 6.5-5 12-12 15 7 3 12 8.5 12 15v4"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.4}
      />
    </svg>
  );
}

export function CircularProgress({
  value = 0,
  size = 48,
  strokeWidth = 3,
  className = "",
}: ThematicProps & { value?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
      className={className}
    >
      {/* Background track */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        opacity={0.1}
      />
      {/* Progress arc */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        className="transition-[stroke-dashoffset] duration-700 ease-out"
      />
    </svg>
  );
}

export function RadialLines({
  count = 24,
  size = 200,
  className = "",
}: ThematicProps & { count?: number }) {
  const lines = Array.from({ length: count }, (_, i) => {
    const angle = (i * (360 / count) * Math.PI) / 180;
    const center = size / 2;
    const inner = size * 0.2;
    const outer = size * 0.48;
    return {
      x1: round3(center + Math.sin(angle) * inner),
      y1: round3(center - Math.cos(angle) * inner),
      x2: round3(center + Math.sin(angle) * outer),
      y2: round3(center - Math.cos(angle) * outer),
    };
  });

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
      className={className}
    >
      {lines.map((l, i) => (
        <line
          key={i}
          x1={l.x1}
          y1={l.y1}
          x2={l.x2}
          y2={l.y2}
          stroke="currentColor"
          strokeWidth={1}
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}

export function GrainOverlay({
  className = "",
  opacity = 0.03,
}: { className?: string; opacity?: number }) {
  return (
    <div
      aria-hidden="true"
      className={`absolute inset-0 pointer-events-none ${className}`}
      style={{ opacity }}
    >
      <svg width="100%" height="100%" className="w-full h-full">
        <filter id="grain">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.9"
            numOctaves="4"
            stitchTiles="stitch"
          />
        </filter>
        <rect width="100%" height="100%" filter="url(#grain)" />
      </svg>
    </div>
  );
}
