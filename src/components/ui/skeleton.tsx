"use client";

import { cn } from "@/lib/utils";

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md bg-mp-surface/30 animate-shimmer bg-gradient-to-r bg-[length:1000px_100%] from-transparent via-mp-text/10 to-transparent",
        className,
      )}
      {...props}
    />
  );
}

// Skeleton variants for different content types
function ArticleSkeleton() {
  return (
    <div className="space-y-4 p-6 bg-gradient-to-br from-mp-surface/80 to-mp-surface/60 backdrop-blur-xl rounded-3xl border border-mp-primary/20">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-4 w-2/3" />
      <div className="mt-6 space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
        <Skeleton className="h-3 w-3/5" />
      </div>
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="p-6 bg-gradient-to-br from-mp-surface/60 to-mp-surface/40 rounded-2xl border border-mp-primary/20 backdrop-blur-sm">
      <div className="mb-4">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-3 w-48 mt-2" />
      </div>
      <div className="relative h-32 mb-4">
        <div className="absolute inset-0 flex items-end gap-2">
          {Array.from({ length: 12 }).map((_, i) => {
            const heights = Array.from({ length: 12 }).map(
              () => Math.random() * 60,
            );
            return (
              <Skeleton
                key={i}
                className="flex-1"
                style={{ height: `${20 + heights[i]}%` }}
              />
            );
          })}
        </div>
      </div>
      <div className="flex justify-between">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="p-6 bg-gradient-to-br from-mp-surface/80 to-mp-surface/60 backdrop-blur-xl rounded-3xl border border-mp-primary/20">
      <Skeleton className="w-12 h-12 rounded-xl mb-4" />
      <Skeleton className="h-6 w-3/4 mb-2" />
      <Skeleton className="h-4 w-full mb-4" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  );
}

export { Skeleton, ArticleSkeleton, ChartSkeleton, CardSkeleton };
