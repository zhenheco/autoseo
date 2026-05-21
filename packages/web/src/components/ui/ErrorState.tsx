"use client";

import { TriangleAlert } from "lucide-react";
import { Button } from "@shared/ui/button";
import { Card, CardContent } from "@shared/ui/card";

export interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  supportUrl?: string;
}

export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
  supportUrl,
}: ErrorStateProps) {
  return (
    <Card className="border-destructive/30 bg-card">
      <CardContent className="flex flex-col items-center justify-center px-6 py-10 text-center">
        <div className="mb-4 rounded-full bg-destructive/10 p-3 text-destructive">
          <TriangleAlert className="h-6 w-6" aria-hidden="true" />
        </div>
        <h2 className="text-h3 font-semibold text-text-primary">{title}</h2>
        <p className="mt-2 max-w-md text-small text-text-muted">{message}</p>
        {(onRetry || supportUrl) && (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {onRetry && (
              <Button type="button" onClick={onRetry}>
                Retry
              </Button>
            )}
            {supportUrl && (
              <Button asChild variant="outline">
                <a href={supportUrl}>Contact support</a>
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
