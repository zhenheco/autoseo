"use client";

import { useOptimistic, useTransition, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { getUserWebsites } from "@/app/(dashboard)/dashboard/websites/actions";

interface Website {
  id: string;
  website_name: string;
}

const FILTER_KEYS = ["all", "unpublished", "scheduled", "published"] as const;

export function ArticleFilters() {
  const t = useTranslations("articles");
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentFilter = searchParams.get("filter") || "all";
  const currentWebsite = searchParams.get("website") || "";

  const [websites, setWebsites] = useState<Website[]>([]);
  const [loadingWebsites, setLoadingWebsites] = useState(true);

  // 樂觀更新：按鈕顏色立即切換，不等待數據加載
  const [optimisticFilter, setOptimisticFilter] = useOptimistic(currentFilter);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    async function fetchWebsites() {
      try {
        const result = await getUserWebsites();
        setWebsites(result.websites);
      } catch (error) {
        console.error("Failed to fetch websites:", error);
      } finally {
        setLoadingWebsites(false);
      }
    }
    fetchWebsites();
  }, []);

  const handleFilterChange = (filter: string) => {
    setOptimisticFilter(filter);
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

  const handleWebsiteChange = (websiteId: string) => {
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (websiteId === "all") {
        params.delete("website");
      } else {
        params.set("website", websiteId);
      }
      router.push(`/dashboard/articles/manage?${params.toString()}`);
    });
  };

  const selectedWebsite = websites.find((w) => w.id === currentWebsite);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* 網站篩選 */}
      <Select
        value={currentWebsite || "all"}
        onValueChange={handleWebsiteChange}
        disabled={loadingWebsites || isPending}
      >
        <SelectTrigger className="w-[140px] h-8">
          <SelectValue placeholder={t("filters.filterWebsite")}>
            {currentWebsite && selectedWebsite ? (
              <div className="flex items-center gap-1.5">
                <Globe className="h-3 w-3" />
                <span className="truncate">{selectedWebsite.website_name}</span>
              </div>
            ) : (
              <span className="text-muted-foreground">
                {t("filters.allWebsites")}
              </span>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t("filters.allWebsites")}</SelectItem>
          {websites.map((website) => (
            <SelectItem key={website.id} value={website.id}>
              <div className="flex items-center gap-1.5">
                <Globe className="h-3 w-3" />
                <span>{website.website_name}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* 狀態篩選 */}
      {FILTER_KEYS.map((filterKey) => (
        <Button
          key={filterKey}
          variant={optimisticFilter === filterKey ? "default" : "outline"}
          size="sm"
          onClick={() => handleFilterChange(filterKey)}
          disabled={isPending && optimisticFilter !== filterKey}
          className={cn(
            "h-8",
            optimisticFilter === filterKey &&
              "bg-primary text-primary-foreground",
          )}
        >
          {t(`filters.${filterKey}`)}
        </Button>
      ))}
    </div>
  );
}
