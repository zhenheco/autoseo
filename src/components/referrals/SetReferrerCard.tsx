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
import { UserPlus, Loader2 } from "lucide-react";
import { REFERRAL_CREDIT_REWARD } from "@/types/referral.types";
import { useRouter } from "next/navigation";

export function SetReferrerCard() {
  const [referralCode, setReferralCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async () => {
    if (!referralCode.trim()) {
      setError("請輸入推薦碼");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/referrals/set-referrer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          referralCode: referralCode.trim().toUpperCase(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "設定失敗");
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "設定失敗");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="border-orange-200 bg-gradient-to-br from-orange-50/50 to-orange-100/50">
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-orange-100">
            <UserPlus className="h-5 w-5 text-orange-600" />
          </div>
          <div>
            <CardTitle>輸入推薦碼</CardTitle>
            <CardDescription>
              如果您是透過朋友推薦來的，輸入推薦碼後，首次付款時雙方都將獲得{" "}
              {REFERRAL_CREDIT_REWARD.toLocaleString()} credits
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2">
          <Input
            value={referralCode}
            onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
            placeholder="輸入推薦碼（例如：ABC123）"
            className="bg-background/50 font-mono uppercase"
            disabled={isSubmitting}
          />
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !referralCode.trim()}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                設定中
              </>
            ) : (
              "確認"
            )}
          </Button>
        </div>
        {error && <p className="text-sm text-destructive mt-2">{error}</p>}
        <p className="text-xs text-muted-foreground mt-3">
          注意：推薦碼只能在首次付款前設定，設定後無法更改
        </p>
      </CardContent>
    </Card>
  );
}
