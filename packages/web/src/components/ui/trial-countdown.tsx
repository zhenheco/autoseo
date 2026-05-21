"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

export interface TrialCountdownProps {
  trialEndsAt: Date;
  onUpgrade(): void;
}

const dayMs = 24 * 60 * 60 * 1000;

export function TrialCountdown({
  trialEndsAt,
  onUpgrade,
}: TrialCountdownProps) {
  const [now] = useState(() => new Date());
  const daysRemaining = Math.max(
    0,
    Math.ceil((trialEndsAt.getTime() - now.getTime()) / dayMs),
  );

  if (daysRemaining > 7) {
    return null;
  }

  const destructive = daysRemaining === 0;

  return (
    <div
      role="status"
      className={cn(
        "flex flex-col gap-3 rounded-lg border px-4 py-3 shadow-sm",
        "sm:flex-row sm:items-center sm:justify-between",
        destructive
          ? "border-destructive-300 bg-destructive-50 text-destructive-900"
          : "border-warning-300 bg-warning-50 text-warning-950",
      )}
    >
      <p className="text-small font-medium">
        {daysRemaining === 0
          ? "Trial ends today"
          : `${daysRemaining} days remaining in your trial`}
      </p>
      <Button type="button" size="sm" onClick={onUpgrade}>
        Upgrade
      </Button>
    </div>
  );
}
