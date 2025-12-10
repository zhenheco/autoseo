"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Link2, Unlink } from "lucide-react";
import { toast } from "sonner";
import type { GoogleServiceType } from "@/types/google-analytics.types";

interface GoogleConnectButtonProps {
  websiteId: string;
  serviceType: GoogleServiceType;
  isConnected?: boolean;
  connectedEmail?: string | null;
  onDisconnect?: () => void;
  variant?: "default" | "outline" | "secondary";
  size?: "default" | "sm" | "lg";
}

/**
 * Google 服務連接按鈕
 * 用於連接或斷開 GSC/GA4
 */
export function GoogleConnectButton({
  websiteId,
  serviceType,
  isConnected = false,
  connectedEmail,
  onDisconnect,
  variant = "outline",
  size = "default",
}: GoogleConnectButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const serviceName = serviceType === "gsc" ? "Search Console" : "Analytics 4";
  const serviceLabel = serviceType === "gsc" ? "GSC" : "GA4";

  // 發起連接
  const handleConnect = () => {
    setIsLoading(true);
    // 重定向到 OAuth 授權頁面
    window.location.href = `/api/google/oauth/authorize?website_id=${websiteId}&service_type=${serviceType}`;
  };

  // 斷開連接
  const handleDisconnect = async () => {
    if (!confirm(`確定要斷開 Google ${serviceName} 連接嗎？`)) {
      return;
    }

    setIsDisconnecting(true);

    try {
      const response = await fetch("/api/google/oauth/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          website_id: websiteId,
          service_type: serviceType,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "斷開連接失敗");
      }

      toast.success(`已斷開 Google ${serviceName} 連接`);
      onDisconnect?.();
    } catch (error) {
      console.error("斷開連接失敗:", error);
      toast.error(error instanceof Error ? error.message : "斷開連接失敗");
    } finally {
      setIsDisconnecting(false);
    }
  };

  if (isConnected) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="h-2 w-2 rounded-full bg-green-500" />
          <span className="hidden sm:inline">
            {connectedEmail || `已連接 ${serviceLabel}`}
          </span>
          <span className="sm:hidden">{serviceLabel}</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDisconnect}
          disabled={isDisconnecting}
          className="text-destructive hover:text-destructive"
        >
          {isDisconnecting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Unlink className="h-4 w-4" />
          )}
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleConnect}
      disabled={isLoading}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <Link2 className="h-4 w-4 mr-2" />
      )}
      連接 {serviceName}
    </Button>
  );
}
