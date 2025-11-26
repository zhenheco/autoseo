"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const filters = [
  { value: "all", label: "全部" },
  { value: "unpublished", label: "待發布" },
  { value: "published", label: "已發布" },
];

export function ArticleFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentFilter = searchParams.get("filter") || "all";

  const handleFilterChange = (filter: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (filter === "all") {
      params.delete("filter");
    } else {
      params.set("filter", filter);
    }
    router.push(`/dashboard/articles/manage?${params.toString()}`);
  };

  return (
    <div className="flex gap-2">
      {filters.map((filter) => (
        <Button
          key={filter.value}
          variant={currentFilter === filter.value ? "default" : "outline"}
          size="sm"
          onClick={() => handleFilterChange(filter.value)}
          className={cn(
            currentFilter === filter.value &&
              "bg-primary text-primary-foreground",
          )}
        >
          {filter.label}
        </Button>
      ))}
    </div>
  );
}
