import * as React from "react"
import { cn } from "@/lib/utils"

export interface ToastProps {
  title?: string
  description?: string
  variant?: "default" | "success" | "warning" | "danger"
  duration?: number
  onClose?: () => void
}

const variantStyles = {
  default: "bg-card border-border",
  success: "bg-success/10 border-success text-success",
  warning: "bg-warning/10 border-warning text-warning",
  danger: "bg-danger/10 border-danger text-danger",
}

export const Toast = React.forwardRef<HTMLDivElement, ToastProps>(
  ({ title, description, variant = "default", duration = 5000, onClose, ...props }, ref) => {
    React.useEffect(() => {
      if (duration > 0) {
        const timer = setTimeout(() => {
          onClose?.()
        }, duration)
        return () => clearTimeout(timer)
      }
    }, [duration, onClose])

    return (
      <div
        ref={ref}
        className={cn(
          "pointer-events-auto relative flex w-full max-w-md gap-3 rounded-lg border p-4 shadow-lg animate-slide-in",
          variantStyles[variant]
        )}
        {...props}
      >
        <div className="flex-1 space-y-1">
          {title && <div className="font-semibold">{title}</div>}
          {description && <div className="text-sm opacity-90">{description}</div>}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-3 right-3 opacity-70 hover:opacity-100 transition-opacity"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        )}
      </div>
    )
  }
)
Toast.displayName = "Toast"

export interface ToastContainerProps {
  children?: React.ReactNode
  position?: "top-right" | "top-left" | "bottom-right" | "bottom-left" | "top-center" | "bottom-center"
}

const positionStyles = {
  "top-right": "top-4 right-4",
  "top-left": "top-4 left-4",
  "bottom-right": "bottom-4 right-4",
  "bottom-left": "bottom-4 left-4",
  "top-center": "top-4 left-1/2 -translate-x-1/2",
  "bottom-center": "bottom-4 left-1/2 -translate-x-1/2",
}

export function ToastContainer({ children, position = "top-right" }: ToastContainerProps) {
  return (
    <div className={cn("fixed z-50 flex flex-col gap-2", positionStyles[position])}>
      {children}
    </div>
  )
}
