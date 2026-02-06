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
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={cn("flex flex-col items-center justify-center p-8 text-center", className)}
        dir="rtl"
        {...props}
      >
        {Icon && (
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-orange-100">
            <Icon className="h-8 w-8 text-orange-600" />
          </div>
        )}
        <p className="text-lg font-medium text-gray-900 mb-2">{message}</p>
        {description && (
          <p className="text-sm text-gray-500 mb-4 max-w-md">{description}</p>
        )}
        {actionLabel && (onAction || actionHref) && (
          <div className="mt-2">
            {actionHref ? (
              <a
                href={actionHref}
                className="rounded-lg bg-orange-600 px-4 py-2 text-white hover:bg-orange-700 inline-block"
              >
                {actionLabel}
              </a>
            ) : (
              <Button onClick={onAction} className="bg-orange-600 hover:bg-orange-700">
                {actionLabel}
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
