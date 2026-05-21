import type { ReactNode } from "react";
import { Label } from "@shared/ui/label";
import { cn } from "@/lib/utils";

export interface FormRowProps {
  label: ReactNode;
  htmlFor?: string;
  children: ReactNode;
  helperText?: ReactNode;
  required?: boolean;
  className?: string;
  labelClassName?: string;
  helperClassName?: string;
}

export function FormRow({
  label,
  htmlFor,
  children,
  helperText,
  required = false,
  className,
  labelClassName,
  helperClassName,
}: FormRowProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={htmlFor} className={labelClassName}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </Label>
      {children}
      {helperText && (
        <p className={cn("text-xs text-muted-foreground", helperClassName)}>
          {helperText}
        </p>
      )}
    </div>
  );
}
