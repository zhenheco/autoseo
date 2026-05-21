import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "./card";

export interface MetricCardProps {
  label: string;
  value: ReactNode;
  delta?: {
    value: string;
    trend: "up" | "down" | "flat";
  };
  icon?: ReactNode;
}

const deltaStyles: Record<
  NonNullable<MetricCardProps["delta"]>["trend"],
  string
> = {
  up: "bg-success-50 text-success-700",
  down: "bg-destructive-50 text-destructive-700",
  flat: "bg-muted text-muted-foreground",
};

export function MetricCard({ label, value, delta, icon }: MetricCardProps) {
  return (
    <Card className="border-border-subtle bg-bg-surface shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-small font-medium text-text-muted">{label}</p>
            <div className="mt-2 text-h2 font-semibold text-text-primary">
              {value}
            </div>
          </div>
          {icon && (
            <div className="rounded-md bg-bg-elevated p-2 text-text-muted">
              {icon}
            </div>
          )}
        </div>
        {delta && (
          <span
            className={cn(
              "mt-4 inline-flex rounded-full px-2.5 py-1 text-tiny font-semibold",
              deltaStyles[delta.trend],
            )}
          >
            {delta.value}
          </span>
        )}
      </CardContent>
    </Card>
  );
}
