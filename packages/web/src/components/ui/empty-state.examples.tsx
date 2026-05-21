import { FileText } from "lucide-react";
import { EmptyState } from "./empty-state";

export function EmptyStateExample() {
  return (
    <EmptyState
      icon={<FileText className="h-5 w-5" />}
      title="No articles yet"
      description="Generate your first SEO article."
      action={{ label: "Create article", onClick: () => undefined }}
    />
  );
}
