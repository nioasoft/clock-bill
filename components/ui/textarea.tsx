import * as React from "react"

import { fieldClass } from "@/lib/form-styles"
import { cn } from "@/lib/utils"

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  hasError?: boolean
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, hasError = false, "aria-invalid": ariaInvalid, ...props }, ref) => (
    <textarea
      ref={ref}
      aria-invalid={ariaInvalid ?? (hasError || undefined)}
      className={cn(fieldClass(hasError), "resize-y", className)}
      {...props}
    />
  )
)
Textarea.displayName = "Textarea"

export { Textarea }
