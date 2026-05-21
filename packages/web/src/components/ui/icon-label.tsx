import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type IconLabelElement = "div" | "span" | "p" | "h1" | "h2" | "h3" | "label";

export interface IconLabelProps extends HTMLAttributes<HTMLElement> {
  as?: IconLabelElement;
  icon: ReactNode;
  children: ReactNode;
  htmlFor?: string;
}

export function IconLabel({
  as = "span",
  icon,
  children,
  className,
  ...props
}: IconLabelProps) {
  const Component = as;

  return (
    <Component
      className={cn("inline-flex items-center gap-2", className)}
      {...props}
    >
      {icon}
      {children}
    </Component>
  );
}
