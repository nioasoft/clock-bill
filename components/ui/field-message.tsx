import * as React from "react"

import { cn } from "@/lib/utils"

interface FieldMessageProps extends React.HTMLAttributes<HTMLParagraphElement> {
  variant?: "hint" | "error"
}

function FieldMessage({
  className,
  variant = "hint",
  role,
  ...props
}: FieldMessageProps) {
  return (
    <p
      role={role ?? (variant === "error" ? "alert" : undefined)}
      className={cn(
        "mt-1.5 text-sm leading-relaxed",
        variant === "error" ? "text-destructive" : "text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}

export { FieldMessage }
