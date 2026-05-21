"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick(): void;
  };
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <section
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed",
        "border-border-subtle bg-bg-surface px-6 py-12 text-center shadow-sm",
      )}
    >
      {icon && (
        <div className="mb-4 rounded-full bg-bg-elevated p-3 text-text-muted">
          {icon}
        </div>
      )}
      <h2 className="text-h3 font-semibold text-text-primary">{title}</h2>
      {description && (
        <p className="mt-2 max-w-md text-small text-text-muted">
          {description}
        </p>
      )}
      {action && (
        <Button className="mt-6" type="button" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </section>
  );
}
