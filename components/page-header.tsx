interface PageHeaderProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}

export function PageHeader({ title, subtitle, children }: PageHeaderProps) {
  return (
    // Stacked on mobile so action buttons get a full row instead of being
    // squeezed next to the title and wrapping their own label text.
    <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-balance font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1.5 max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {children && (
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end [&>a]:min-h-11 [&>a]:whitespace-nowrap [&>button]:min-h-11 [&>button]:whitespace-nowrap">
          {children}
        </div>
      )}
    </div>
  );
}
