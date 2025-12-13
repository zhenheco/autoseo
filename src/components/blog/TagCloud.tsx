"use client";

import Link from "next/link";
import { Tags } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { TagCount } from "@/types/blog";

interface TagCloudProps {
  tags: TagCount[];
  maxTags?: number;
  className?: string;
}

/**
 * 標籤雲組件
 * 用於側邊欄顯示熱門標籤
 */
export function TagCloud({
  tags,
  maxTags = 15,
  className = "",
}: TagCloudProps) {
  if (tags.length === 0) {
    return null;
  }

  const displayTags = tags.slice(0, maxTags);

  return (
    <div className={className}>
      <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
        <Tags className="h-5 w-5" />
        標籤
      </h3>
      <div className="flex flex-wrap gap-2">
        {displayTags.map((tag) => (
          <Link
            key={tag.name}
            href={`/blog/tag/${encodeURIComponent(tag.name)}`}
          >
            <Badge
              variant="outline"
              className="cursor-pointer transition-colors hover:bg-primary hover:text-primary-foreground"
            >
              {tag.name}
              <span className="ml-1 text-[10px] opacity-60">({tag.count})</span>
            </Badge>
          </Link>
        ))}
      </div>
    </div>
  );
}
