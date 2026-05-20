"use client";

import { useEffect, ReactNode } from "react";
import { useRouter } from "next/navigation";

interface AutoRefreshWrapperProps {
  children: ReactNode;
  intervalMs?: number;
}

export function AutoRefreshWrapper({
  children,
  intervalMs = 5 * 60 * 1000,
}: AutoRefreshWrapperProps) {
  const router = useRouter();

  useEffect(() => {
    const interval = setInterval(() => {
      router.refresh();
    }, intervalMs);

    return () => clearInterval(interval);
  }, [router, intervalMs]);

  return <>{children}</>;
}
