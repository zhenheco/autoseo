import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@shared/ui/card";
import type { Json } from "@/types/database.types";

export interface BrandPerformanceMemoryItem {
  metricKey: string;
  metricValue: Json;
  updatedAt: string;
}

interface BrandPerformanceMemoryProps {
  items: BrandPerformanceMemoryItem[];
}

export function BrandPerformanceMemory({ items }: BrandPerformanceMemoryProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Performance memory</CardTitle>
        <CardDescription>
          Read-only signals learned from publishing and analytics outcomes.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
            No performance memory yet. This brand will start cold until enough
            publishing data is collected.
          </p>
        ) : (
          <dl className="divide-y divide-border rounded-md border border-border">
            {items.map((item) => (
              <div
                key={item.metricKey}
                className="grid gap-2 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]"
              >
                <dt className="font-mono text-sm font-medium">
                  {item.metricKey}
                </dt>
                <dd className="break-words font-mono text-sm text-muted-foreground">
                  {formatMetricValue(item.metricValue)}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </CardContent>
    </Card>
  );
}

function formatMetricValue(value: Json): string {
  if (typeof value === "string") return value;
  if (value === null) return "null";
  return JSON.stringify(value);
}
