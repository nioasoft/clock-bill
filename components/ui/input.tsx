import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          // Base input styles matching the existing design system
          "mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm",
          "focus:border-orange-500 focus:outline-none focus:ring-orange-500",
          "placeholder:text-gray-400",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
