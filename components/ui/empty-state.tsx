import * as React from "react"
import { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Icon component to display above the message
   */
  icon?: LucideIcon
  /**
   * Main message to display
   */
  message: string
  /**
   * Optional description text
   */
  description?: string
  /**
   * Optional action button label
   */
  actionLabel?: string
  /**
   * Optional action button click handler
   */
  onAction?: () => void
  /**
   * Optional action button href (renders as Link instead of button)
   */
  actionHref?: string
  /**
   * Optional secondary action label
   */
  secondaryActionLabel?: string
  /**
   * Optional secondary action href
   */
  secondaryActionHref?: string
  /**
   * Optional secondary action click handler
   */
  onSecondaryAction?: () => void
}

const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  (
    {
      className,
      icon: Icon,
      message,
      description,
      actionLabel,
      onAction,
      actionHref,
      secondaryActionLabel,
      secondaryActionHref,
      onSecondaryAction,
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={cn("flex flex-col items-center justify-center p-8 text-center", className)}
        {...props}
      >
        {Icon && (
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary-light">
            <Icon className="h-8 w-8 text-primary" aria-hidden="true" />
          </div>
        )}
        <p className="text-lg font-medium text-foreground mb-2">{message}</p>
        {description && (
          <p className="text-sm text-muted-foreground mb-4 max-w-md">{description}</p>
        )}
        {actionLabel && (onAction || actionHref) && (
          <div className="mt-2">
            {actionHref ? (
              <a
                href={actionHref}
                className="inline-flex min-h-11 touch-manipulation items-center justify-center rounded-[var(--radius)] border border-primary/80 bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-[background-color,border-color] hover:border-primary-active hover:bg-primary-active"
              >
                {actionLabel}
              </a>
            ) : (
              <Button onClick={onAction}>
                {actionLabel}
              </Button>
            )}
          </div>
        )}
        {secondaryActionLabel && (onSecondaryAction || secondaryActionHref) && (
          <div className="mt-2">
            {secondaryActionHref ? (
              <a
                href={secondaryActionHref}
                className="inline-flex min-h-11 touch-manipulation items-center justify-center rounded-[var(--radius)] border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-[background-color,border-color] hover:border-border-strong hover:bg-card-elevated"
              >
                {secondaryActionLabel}
              </a>
            ) : (
              <Button variant="outline" onClick={onSecondaryAction}>
                {secondaryActionLabel}
              </Button>
            )}
          </div>
        )}
      </div>
    )
  }
)
EmptyState.displayName = "EmptyState"

export { EmptyState }
