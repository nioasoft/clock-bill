import * as React from "react"

import { fieldClass } from "@/lib/form-styles"
import { cn } from "@/lib/utils"

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, hasError = false, "aria-invalid": ariaInvalid, ...props }, ref) => (
    <input
      ref={ref}
      aria-invalid={ariaInvalid ?? (hasError || undefined)}
      className={cn(fieldClass(hasError), className)}
      {...props}
    />
  )
)
Input.displayName = "Input"

export { Input }
