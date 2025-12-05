"use client";

import { useOptimistic, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const filters = [
  { value: "all", label: "全部" },
  { value: "unpublished", label: "待發布" },
  { value: "scheduled", label: "已排程" },
  { value: "published", label: "已發布" },
];

export function ArticleFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentFilter = searchParams.get("filter") || "all";

  // 樂觀更新：按鈕顏色立即切換，不等待數據加載
  const [optimisticFilter, setOptimisticFilter] = useOptimistic(currentFilter);
  const [isPending, startTransition] = useTransition();

  const handleFilterChange = (filter: string) => {
    // 立即更新按鈕顏色
    setOptimisticFilter(filter);

    // 在 transition 中進行導航（數據加載在後台）
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (filter === "all") {
        params.delete("filter");
      } else {
        params.set("filter", filter);
      }
      router.push(`/dashboard/articles/manage?${params.toString()}`);
    });
  };

  return (
    <div className="flex gap-2">
      {filters.map((filter) => (
        <Button
          key={filter.value}
          variant={optimisticFilter === filter.value ? "default" : "outline"}
          size="sm"
          onClick={() => handleFilterChange(filter.value)}
          disabled={isPending && optimisticFilter !== filter.value}
          className={cn(
            optimisticFilter === filter.value &&
              "bg-primary text-primary-foreground",
          )}
        >
          {filter.label}
        </Button>
      ))}
    </div>
  );
}
