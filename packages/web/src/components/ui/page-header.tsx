import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <header
      className={cn(
        "grid gap-3 border-b border-border-subtle pb-6",
        "md:grid-cols-[minmax(0,1fr)_minmax(16rem,24rem)_auto]",
        "md:items-start",
      )}
    >
      <div className="min-w-0">
        <h1 className="text-h1 font-semibold text-text-primary">{title}</h1>
      </div>
      {description ? (
        <p className="text-small leading-6 text-text-muted md:pt-2">
          {description}
        </p>
      ) : (
        <span aria-hidden="true" className="hidden md:block" />
      )}
      {actions && (
        <div className="flex flex-wrap items-center gap-2 md:justify-end">
          {actions}
        </div>
      )}
    </header>
  );
}
