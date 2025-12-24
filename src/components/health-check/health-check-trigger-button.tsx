"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import {
  Activity,
  Loader2,
  ChevronDown,
  Smartphone,
  Monitor,
} from "lucide-react";
import { toast } from "sonner";
import type { DeviceType } from "@/types/health-check";

interface HealthCheckTriggerButtonProps {
  websiteId: string;
  disabled?: boolean;
}

/**
 * 健康檢查觸發按鈕
 * 支援選擇 Mobile 或 Desktop 模式
 */
export function HealthCheckTriggerButton({
  websiteId,
  disabled = false,
}: HealthCheckTriggerButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const router = useRouter();

  const handleHealthCheck = async (device: DeviceType) => {
    setIsLoading(true);
    setProgress(0);

    // 模擬進度條（因為無法從 API 取得真實進度）
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) return prev;
        return prev + Math.random() * 5;
      });
    }, 1000);

    try {
      const response = await fetch(`/api/websites/${websiteId}/health-check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          device,
          includeAIRecommendations: true,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "健康檢查失敗");
      }

      setProgress(100);
      toast.success("健康檢查完成", {
        description: `已完成 ${device === "mobile" ? "行動版" : "桌面版"} 檢查`,
      });

      // 重新整理頁面以顯示新結果
      router.refresh();
    } catch (error) {
      toast.error("健康檢查失敗", {
        description: error instanceof Error ? error.message : "請稍後再試",
      });
    } finally {
      clearInterval(progressInterval);
      setIsLoading(false);
      setProgress(0);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-end gap-2">
        <Button disabled className="min-w-[140px]">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          檢查中...
        </Button>
        <div className="w-[140px]">
          <Progress value={progress} className="h-1" />
          <p className="text-xs text-muted-foreground text-right mt-1">
            {Math.round(progress)}%
          </p>
        </div>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button disabled={disabled}>
          <Activity className="mr-2 h-4 w-4" />
          執行健檢
          <ChevronDown className="ml-2 h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleHealthCheck("mobile")}>
          <Smartphone className="mr-2 h-4 w-4" />
          行動版檢查
          <span className="ml-2 text-xs text-muted-foreground">(推薦)</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleHealthCheck("desktop")}>
          <Monitor className="mr-2 h-4 w-4" />
          桌面版檢查
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
