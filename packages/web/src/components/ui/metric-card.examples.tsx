import { FileText } from "lucide-react";
import { MetricCard } from "./metric-card";

export function MetricCardExample() {
  return (
    <MetricCard
      label="Articles"
      value="128"
      delta={{ value: "+12%", trend: "up" }}
      icon={<FileText className="h-5 w-5" />}
    />
  );
}
