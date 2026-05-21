"use client";

import { ErrorState } from "@/components/ui/ErrorState";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="container mx-auto p-4 md:p-8">
      <ErrorState
        message={error.message || "The dashboard could not load."}
        onRetry={reset}
        supportUrl="/faq"
      />
    </div>
  );
}
