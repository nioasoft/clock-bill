"use client";

import { useEffect, useState } from "react";
import { HourglassSVG } from "@/components/ui/thematic-elements";

interface ProjectHours {
  projectId: string;
  projectName: string;
  totalMinutes: number;
  totalHours: number;
  formatted: string;
}

export function ProjectHoursChart() {
  const [projectHours, setProjectHours] = useState<ProjectHours[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProjectHours = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/dashboard/project-hours");
        const data = await response.json();

        if (data.success) {
          setProjectHours(data.projectHours || []);
        } else {
          setError(data.message || "שגיאה בטעינת הנתונים");
        }
      } catch (err) {
        console.error("Error fetching project hours data:", err);
        setError("שגיאה בטעינת הנתונים");
      } finally {
        setLoading(false);
      }
    };

    fetchProjectHours();
  }, []);

  if (loading) {
    return (
      <div className="rounded-[var(--radius-card)] bg-card border border-border/50 p-6 shadow-sm">
        <h3 className="font-display text-lg font-semibold text-foreground mb-4">שעות לפי פרויקט - החודש</h3>
        <div className="h-48 flex items-center justify-center">
          <div className="animate-pulse text-muted-foreground">טוען נתונים...</div>
        </div>
      </div>
    );
  }

  if (error || projectHours.length === 0) {
    return (
      <div className="rounded-[var(--radius-card)] bg-card border border-border/50 p-6 shadow-sm">
        <h3 className="font-display text-lg font-semibold text-foreground mb-4">שעות לפי פרויקט - החודש</h3>
        <div className="h-48 flex flex-col items-center justify-center gap-3">
          <HourglassSVG size={64} className="text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground text-center">
            {error || "אין נתוני שעות זמינים עדיין"}
          </p>
        </div>
      </div>
    );
  }

  const maxHours = Math.max(...projectHours.map((p) => p.totalHours));
  // Show the heaviest projects first so the chart reads top-to-bottom by size.
  const rows = [...projectHours].sort((a, b) => b.totalHours - a.totalHours);

  return (
    <div className="rounded-[var(--radius-card)] bg-card border border-border/50 p-6 shadow-sm">
      <h3 className="font-display text-lg font-semibold text-foreground">שעות לפי פרויקט</h3>
      <p className="mt-0.5 mb-5 text-xs text-muted-foreground">פילוח השעות שנרשמו החודש, לפי פרויקט</p>

      {/* RTL-native horizontal bars: each fills from the inline-start (right). */}
      <div className="space-y-4">
        {rows.map((project) => {
          const pct = maxHours > 0 ? (project.totalHours / maxHours) * 100 : 0;
          return (
            <div key={project.projectId}>
              <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate font-medium text-foreground">{project.projectName}</span>
                <span className="shrink-0 font-mono tabular-nums text-muted-foreground">
                  {project.formatted}
                </span>
              </div>
              <div
                className="h-2.5 w-full overflow-hidden rounded-full bg-muted/50"
                role="img"
                aria-label={`${project.projectName}: ${project.formatted}`}
              >
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
                  style={{ width: `${Math.max(pct, 2)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
