interface SettingsSectionNavItem {
  id: string;
  label: string;
}

interface SettingsSectionNavProps {
  ariaLabel: string;
  items: SettingsSectionNavItem[];
}

export function SettingsSectionNav({ ariaLabel, items }: SettingsSectionNavProps) {
  return (
    <nav
      aria-label={ariaLabel}
      className="sticky top-16 z-20 -mx-4 mb-6 border-y border-border bg-background/95 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/85 sm:mx-0 sm:rounded-[var(--radius)] sm:border lg:top-2"
    >
      <div className="flex max-w-full gap-1 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item) => (
          <a
            key={item.id}
            href={`#${item.id}`}
            className="inline-flex min-h-11 shrink-0 touch-manipulation items-center rounded-[calc(var(--radius)-2px)] px-3 py-2 text-sm font-medium text-muted-foreground transition-[background-color,color] hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {item.label}
          </a>
        ))}
      </div>
    </nav>
  );
}

export type { SettingsSectionNavItem };
