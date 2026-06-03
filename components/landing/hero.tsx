"use client";

import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { GrainOverlay, RadialLines, HourglassSVG, ClockFaceMarks } from "@/components/ui/thematic-elements";
import { Clock, DollarSign } from "lucide-react";

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-24 py-20 sm:py-28 lg:py-36">
      {/* Background */}
      <GrainOverlay />
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(168,98,45,0.08),transparent_60%)]" />
        <RadialLines className="absolute inset-0 opacity-[0.03]" />
      </div>

      {/* Decorative Hourglass */}
      <div className="absolute top-32 start-10 hidden sm:block">
        <HourglassSVG size={120} animated className="opacity-15" />
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative">
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display font-bold text-foreground leading-tight motion-safe:animate-fade-up">
          {BRAND.tagline}
          <br />
          <span className="bg-gradient-to-l from-primary via-accent to-primary bg-[length:200%_100%] bg-clip-text text-transparent motion-safe:animate-shimmer">
            {BRAND.name}
          </span>{" "}
          עוזר לך לגבות אותו.
        </h1>

        <p className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto motion-safe:animate-fade-up stagger-1">
          מעקב שעות, ניהול לקוחות ודוחות מקצועיים בעברית &mdash; הכל במקום אחד, בחינם.
        </p>

        <div className="mt-10 flex flex-col items-center gap-4 motion-safe:animate-fade-up stagger-2">
          <Link
            href="/register"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-l from-primary to-primary/90 px-10 py-4 text-lg font-medium text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all"
          >
            <Clock className="h-5 w-5" aria-hidden="true" />
            <span>התחל לעקוב &mdash; בחינם</span>
          </Link>
          <p className="text-sm text-muted-foreground">
            חינם בתקופת הבטא. ללא כרטיס אשראי, ללא התחייבות.
          </p>
        </div>

        {/* Dashboard mockup */}
        <div
          aria-hidden="true"
          className="mt-16 mx-auto max-w-4xl rounded-[var(--radius-card)] border border-border bg-card shadow-2xl shadow-foreground/5 overflow-hidden motion-safe:animate-scale-in stagger-2 [transform:perspective(1200px)_rotateX(2deg)]"
        >
          {/* Browser chrome */}
          <div className="bg-muted/50 px-4 py-3 flex items-center gap-2 border-b border-border">
            <div className="w-3 h-3 rounded-full bg-destructive/40" />
            <div className="w-3 h-3 rounded-full bg-accent/40" />
            <div className="w-3 h-3 rounded-full bg-success/40" />
          </div>

          {/* Timer bar */}
          <div className="bg-surface border-b border-border px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Clock className="h-4 w-4 text-primary" />
              </div>
              <div className="text-start">
                <div className="text-xs text-muted-foreground">פרויקט נוכחי</div>
                <div className="text-sm font-medium">00:00:00</div>
              </div>
            </div>
            <div className="h-8 px-4 rounded-full bg-primary/10 text-primary text-sm font-medium flex items-center">
              הפעל
            </div>
          </div>

          {/* Dashboard content */}
          <div className="p-8 bg-background">
            {/* Stat cards */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              {/* Card 1 - with clock face */}
              <div className="relative bg-card rounded-lg border border-border p-4 overflow-hidden">
                <ClockFaceMarks size={80} className="absolute -top-4 -end-4 text-primary/5" />
                <div className="relative">
                  <div className="text-xs text-muted-foreground mb-1">שעות החודש</div>
                  <div className="text-2xl font-display font-bold text-foreground">142.5</div>
                </div>
              </div>

              {/* Card 2 */}
              <div className="bg-card rounded-lg border border-border p-4">
                <div className="text-xs text-muted-foreground mb-1">הכנסות החודש</div>
                <div className="text-2xl font-display font-bold text-foreground flex items-center gap-1">
                  <DollarSign className="h-5 w-5" />
                  <span>12,500</span>
                </div>
              </div>

              {/* Card 3 */}
              <div className="bg-card rounded-lg border border-border p-4">
                <div className="text-xs text-muted-foreground mb-1">פרויקטים פעילים</div>
                <div className="text-2xl font-display font-bold text-foreground">8</div>
              </div>
            </div>

            {/* Chart placeholder */}
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 bg-card rounded-lg border border-border p-6">
                <div className="text-sm font-medium text-foreground mb-4">הכנסות לפי פרויקט</div>
                <div className="flex items-end justify-between gap-2 h-32">
                  {[65, 85, 45, 95, 70, 55, 75].map((height, i) => (
                    <div key={i} className="flex-1 bg-primary/20 rounded-t" style={{ height: `${height}%` }} />
                  ))}
                </div>
              </div>
              <div className="bg-card rounded-lg border border-border p-6">
                <div className="text-sm font-medium text-foreground mb-4">סטטוס</div>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-success" />
                    <div className="text-xs text-muted-foreground">5 פרויקטים</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-accent" />
                    <div className="text-xs text-muted-foreground">2 בהמתנה</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-muted" />
                    <div className="text-xs text-muted-foreground">1 הושלם</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
