"use client";

import { useEffect, useState } from "react";

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
      <div className="rounded-[14px] bg-card border border-border/50 p-6 shadow-sm">
        <h3 className="font-display text-lg font-semibold text-foreground mb-4">שעות לפי פרויקט - החודש</h3>
        <div className="h-48 flex items-center justify-center">
          <div className="animate-pulse text-muted-foreground">טוען נתונים...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-[14px] bg-card border border-border/50 p-6 shadow-sm">
        <h3 className="font-display text-lg font-semibold text-foreground mb-4">שעות לפי פרויקט - החודש</h3>
        <div className="h-48 flex items-center justify-center">
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (projectHours.length === 0) {
    return (
      <div className="rounded-[14px] bg-card border border-border/50 p-6 shadow-sm">
        <h3 className="font-display text-lg font-semibold text-foreground mb-4">שעות לפי פרויקט - החודש</h3>
        <div className="h-48 flex items-center justify-center">
          <p className="text-muted-foreground">אין נתוני שעות זמינים</p>
        </div>
      </div>
    );
  }

  // Calculate chart dimensions
  const maxHours = Math.max(...projectHours.map(p => p.totalHours));
  const chartHeight = 150;
  const barHeight = 40;
  const gap = 15;
  const chartWidth = 300; // Fixed width for horizontal bars

  // Generate colors for different projects - theme-based
  const getBarColor = (index: number) => {
    const colors = [
      'text-primary',
      'text-secondary',
      'text-accent',
      'text-success',
      'text-primary/70',
      'text-secondary/70',
      'text-accent/70',
      'text-success/70'
    ];
    return colors[index % colors.length];
  };

  return (
    <div className="rounded-[14px] bg-card border border-border/50 p-6 shadow-sm">
      <h3 className="font-display text-lg font-semibold text-foreground mb-4">שעות לפי פרויקט - החודש</h3>

      <div className="overflow-x-auto">
        <svg
          width={chartWidth + 150}
          height={projectHours.length * (barHeight + gap)}
          className="mx-auto"
        >
          {projectHours.map((project, index) => {
            const barWidth = (project.totalHours / maxHours) * chartWidth;
            const y = index * (barHeight + gap);

            return (
              <g key={project.projectId}>
                {/* Project name */}
                <text
                  x={0}
                  y={y + barHeight / 2 + 5}
                  className="fill-foreground text-xs font-medium"
                  textAnchor="start"
                >
                  {project.projectName.length > 20
                    ? project.projectName.substring(0, 20) + '...'
                    : project.projectName}
                </text>

                {/* Bar background */}
                <rect
                  x={120}
                  y={y}
                  width={chartWidth}
                  height={barHeight}
                  className="fill-muted"
                  rx={4}
                />

                {/* Bar */}
                <rect
                  x={120}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  fill="currentColor"
                  className={`${getBarColor(index)} hover:opacity-80 transition-opacity`}
                  rx={4}
                />

                {/* Hours label */}
                <text
                  x={120 + barWidth + 10}
                  y={y + barHeight / 2 + 5}
                  className="fill-foreground text-xs font-medium"
                  textAnchor="start"
                >
                  {project.formatted}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-primary rounded"></div>
          <span>פרויקט 1</span>
        </div>
        {projectHours.length > 1 && (
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-secondary rounded"></div>
            <span>פרויקט 2</span>
          </div>
        )}
      </div>
    </div>
  );
}
