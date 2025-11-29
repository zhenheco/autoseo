"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Check, Link as LinkIcon } from "lucide-react";
import { REFERRAL_TOKEN_REWARD } from "@/types/referral.types";

interface ReferralLinkCardProps {
  referralCode: string;
}

export function ReferralLinkCard({ referralCode }: ReferralLinkCardProps) {
  const [copied, setCopied] = useState(false);

  const baseUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL || "";
  const referralUrl = `${baseUrl}/r/${referralCode}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referralUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <LinkIcon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle>您的推薦連結</CardTitle>
            <CardDescription>
              分享給朋友，朋友付款後雙方都將獲得{" "}
              {REFERRAL_TOKEN_REWARD.toLocaleString()} tokens
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2">
          <Input
            value={referralUrl}
            readOnly
            className="bg-background/50 font-mono text-sm"
          />
          <Button
            onClick={handleCopy}
            variant={copied ? "default" : "outline"}
            className={copied ? "bg-green-600 hover:bg-green-700" : ""}
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 mr-2" />
                已複製
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 mr-2" />
                複製
              </>
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          推薦碼：
          <span className="font-mono font-semibold">{referralCode}</span>
        </p>
      </CardContent>
    </Card>
  );
}
