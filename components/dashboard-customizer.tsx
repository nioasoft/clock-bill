"use client";

/**
 * Dashboard layout editor (Settings → Dashboard tab). Lets the user pick a
 * quick preset or fine-tune which stat cards / sections show and in what order
 * (drag, or up/down arrows for mobile/RTL/a11y), with a live preview of the
 * card row. Self-contained: loads its config from /api/profile and saves
 * optimistically (rollback on failure), mirroring the theme save pattern.
 */
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, ChevronUp, ChevronDown, Eye, EyeOff, RotateCcw, Check } from "lucide-react";
import {
  DASHBOARD_PRESETS,
  DEFAULT_DASHBOARD_CONFIG,
  getWidgetMeta,
  normalizeDashboardConfig,
  cloneConfig,
  type DashboardConfig,
  type DashboardWidgetState,
} from "@/lib/dashboard-widgets";

type Zone = "cards" | "sections";

// Illustrative values for the live preview (settings has no real stats loaded).
const SAMPLE_VALUES: Record<string, string> = {
  hoursToday: "3:45",
  revenueToday: "₪620",
  revenueTodayByHours: "₪480",
  revenueTodayByItems: "₪140",
  hoursWeek: "18:30",
  revenueWeek: "₪3,100",
  revenueWeekByHours: "₪2,400",
  revenueWeekByItems: "₪700",
  hoursMonth: "82:15",
  revenueByHours: "₪12,400",
  revenueByItems: "₪2,800",
  revenueMonth: "₪15,200",
  clientsCount: "6",
  projectsCount: "11",
};

const PREVIEW_GRID_BY_COUNT: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-2 sm:grid-cols-3",
  4: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
  5: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5",
};

export function DashboardCustomizer() {
  const t = useTranslations("Settings.dashboard");
  const tDash = useTranslations("Dashboard");

  const [config, setConfig] = useState<DashboardConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  useEffect(() => {
    let active = true;
    fetch("/api/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!active) return;
        if (data?.success) {
          setConfig(normalizeDashboardConfig(data.profile?.dashboardConfig));
        } else {
          setLoadError(true);
        }
      })
      .catch(() => active && setLoadError(true))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  // Optimistic save with rollback (fire-and-forget, like setTheme).
  const persist = useCallback((next: DashboardConfig, prev: DashboardConfig) => {
    setConfig(next);
    setSaveError("");
    setSaved(false);
    fetch("/api/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ dashboardConfig: next }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (!d?.success) throw new Error("save failed");
        setSaved(true);
      })
      .catch(() => {
        setConfig(prev);
        setSaveError(t("saveError"));
      });
  }, [t]);

  const applyPreset = (preset: DashboardConfig) => {
    if (!config) return;
    persist(cloneConfig(preset), config);
  };

  const reset = () => {
    if (!config) return;
    persist(cloneConfig(DEFAULT_DASHBOARD_CONFIG), config);
  };

  const reorder = (zone: Zone, fromId: string, toId: string) => {
    if (!config || fromId === toId) return;
    const list = config[zone];
    const from = list.findIndex((w) => w.id === fromId);
    const to = list.findIndex((w) => w.id === toId);
    if (from < 0 || to < 0) return;
    persist({ ...config, [zone]: arrayMove(list, from, to) }, config);
  };

  const moveBy = (zone: Zone, id: string, delta: number) => {
    if (!config) return;
    const list = config[zone];
    const from = list.findIndex((w) => w.id === id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= list.length) return;
    persist({ ...config, [zone]: arrayMove(list, from, to) }, config);
  };

  const toggle = (zone: Zone, id: string) => {
    if (!config) return;
    const list = config[zone];
    const target = list.find((w) => w.id === id);
    // Keep at least one card visible — a card-less dashboard reads as broken.
    if (zone === "cards" && target?.visible && list.filter((w) => w.visible).length <= 1) {
      setSaveError(t("minWarning"));
      return;
    }
    const next = list.map((w) => (w.id === id ? { ...w, visible: !w.visible } : w));
    persist({ ...config, [zone]: next }, config);
  };

  if (loading) {
    return (
      <div className="bg-card rounded-[var(--radius-card)] border border-border p-6 text-sm text-muted-foreground">
        {t("loading")}
      </div>
    );
  }
  if (loadError || !config) {
    return (
      <div className="rounded-[var(--radius-card)] bg-destructive/10 border border-destructive/20 p-6 text-sm text-destructive">
        {t("loadError")}
      </div>
    );
  }

  const visibleCards = config.cards.filter((w) => w.visible);
  const previewGrid = PREVIEW_GRID_BY_COUNT[Math.min(visibleCards.length, 5)] ?? PREVIEW_GRID_BY_COUNT[5];
  const visibleSections = config.sections.filter((w) => w.visible);

  return (
    <div className="space-y-6">
      {/* Intro + presets */}
      <div className="bg-card rounded-[var(--radius-card)] border border-border p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold text-foreground mb-1">{t("title")}</h2>
            <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
          </div>
          {saved && (
            <span className="inline-flex items-center gap-1 text-xs text-success whitespace-nowrap">
              <Check className="h-3.5 w-3.5" />
              {t("saved")}
            </span>
          )}
        </div>

        {saveError && (
          <div className="mt-4 rounded-[var(--radius)] bg-destructive/10 border border-destructive/20 p-3">
            <p className="text-sm text-destructive">{saveError}</p>
          </div>
        )}

        <p className="mt-5 text-sm font-medium text-muted-foreground mb-2">{t("presets.label")}</p>
        <div className="flex flex-wrap gap-2">
          {DASHBOARD_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyPreset(preset.config)}
              className="rounded-[var(--radius)] border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:border-border-strong transition-colors min-h-[44px]"
            >
              {t(`presets.${preset.labelKey}`)}
            </button>
          ))}
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-[var(--radius)] border border-border bg-background px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:border-border-strong transition-colors min-h-[44px]"
          >
            <RotateCcw className="h-4 w-4" />
            {t("reset")}
          </button>
        </div>
      </div>

      {/* Live preview */}
      <div className="bg-card rounded-[var(--radius-card)] border border-border p-6">
        <p className="text-sm font-medium text-muted-foreground mb-3">{t("preview")}</p>
        <div className={`grid gap-2 ${previewGrid}`}>
          {visibleCards.map((card) => {
            const meta = getWidgetMeta(card.id);
            const accent = Boolean(meta?.accent);
            return (
              <div
                key={card.id}
                className={`rounded-[var(--radius-card)] border p-2.5 ${
                  accent
                    ? "col-span-2 sm:col-span-1 bg-primary/[0.06] border-primary/25"
                    : "bg-background border-border"
                }`}
              >
                <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground truncate">
                  {meta ? tDash(meta.labelKey) : card.id}
                </p>
                <p className={`mt-1 font-mono font-bold tabular-nums text-base ${accent ? "text-primary" : "text-foreground"}`}>
                  {SAMPLE_VALUES[card.id] ?? "—"}
                </p>
              </div>
            );
          })}
        </div>
        {visibleSections.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {visibleSections.map((s) => {
              const meta = getWidgetMeta(s.id);
              return (
                <span key={s.id} className="rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground">
                  {meta ? tDash(meta.labelKey) : s.id}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Editors */}
      <div className="bg-card rounded-[var(--radius-card)] border border-border p-6 space-y-6">
        <WidgetZone
          zone="cards"
          label={t("cardsLabel")}
          items={config.cards}
          sensors={sensors}
          labelFor={(id) => {
            const meta = getWidgetMeta(id);
            return meta ? tDash(meta.labelKey) : id;
          }}
          uiText={{ show: t("show"), hide: t("hide"), moveUp: t("moveUp"), moveDown: t("moveDown"), dragHandle: t("dragHandle") }}
          onReorder={(from, to) => reorder("cards", from, to)}
          onMove={(id, delta) => moveBy("cards", id, delta)}
          onToggle={(id) => toggle("cards", id)}
        />
        <WidgetZone
          zone="sections"
          label={t("sectionsLabel")}
          items={config.sections}
          sensors={sensors}
          labelFor={(id) => {
            const meta = getWidgetMeta(id);
            return meta ? tDash(meta.labelKey) : id;
          }}
          uiText={{ show: t("show"), hide: t("hide"), moveUp: t("moveUp"), moveDown: t("moveDown"), dragHandle: t("dragHandle") }}
          onReorder={(from, to) => reorder("sections", from, to)}
          onMove={(id, delta) => moveBy("sections", id, delta)}
          onToggle={(id) => toggle("sections", id)}
        />
      </div>
    </div>
  );
}

interface ZoneUiText {
  show: string;
  hide: string;
  moveUp: string;
  moveDown: string;
  dragHandle: string;
}

interface WidgetZoneProps {
  zone: Zone;
  label: string;
  items: DashboardWidgetState[];
  sensors: ReturnType<typeof useSensors>;
  labelFor: (id: string) => string;
  uiText: ZoneUiText;
  onReorder: (fromId: string, toId: string) => void;
  onMove: (id: string, delta: number) => void;
  onToggle: (id: string) => void;
}

function WidgetZone({ zone, label, items, sensors, labelFor, uiText, onReorder, onMove, onToggle }: WidgetZoneProps) {
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) onReorder(String(active.id), String(over.id));
  };

  return (
    <div>
      <p className="text-sm font-semibold text-foreground mb-2">{label}</p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map((w) => w.id)} strategy={verticalListSortingStrategy}>
          <ul className="space-y-2">
            {items.map((w, index) => (
              <WidgetRow
                key={w.id}
                state={w}
                label={labelFor(w.id)}
                uiText={uiText}
                isFirst={index === 0}
                isLast={index === items.length - 1}
                onMove={(delta) => onMove(w.id, delta)}
                onToggle={() => onToggle(w.id)}
                zone={zone}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </div>
  );
}

interface WidgetRowProps {
  state: DashboardWidgetState;
  label: string;
  uiText: ZoneUiText;
  isFirst: boolean;
  isLast: boolean;
  onMove: (delta: number) => void;
  onToggle: () => void;
  zone: Zone;
}

function WidgetRow({ state, label, uiText, isFirst, isLast, onMove, onToggle }: WidgetRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: state.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 rounded-[var(--radius)] border bg-background p-2 ${
        isDragging ? "border-border-strong opacity-80" : "border-border"
      } ${state.visible ? "" : "opacity-60"}`}
    >
      <button
        type="button"
        className="flex h-9 w-9 shrink-0 cursor-grab touch-none items-center justify-center rounded-[var(--radius)] text-muted-foreground hover:text-foreground"
        aria-label={uiText.dragHandle}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <span className="flex-1 text-sm font-medium text-foreground truncate">{label}</span>

      <button
        type="button"
        onClick={() => onMove(-1)}
        disabled={isFirst}
        aria-label={uiText.moveUp}
        className="flex h-9 w-9 items-center justify-center rounded-[var(--radius)] text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <ChevronUp className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => onMove(1)}
        disabled={isLast}
        aria-label={uiText.moveDown}
        className="flex h-9 w-9 items-center justify-center rounded-[var(--radius)] text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <ChevronDown className="h-4 w-4" />
      </button>

      <button
        type="button"
        onClick={onToggle}
        aria-pressed={state.visible}
        aria-label={state.visible ? uiText.hide : uiText.show}
        className={`flex h-9 w-9 items-center justify-center rounded-[var(--radius)] transition-colors ${
          state.visible ? "text-primary" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        {state.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
      </button>
    </li>
  );
}
