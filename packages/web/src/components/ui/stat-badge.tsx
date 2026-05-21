import { cn } from "@/lib/utils";

export interface StatBadgeProps {
  amount: string;
  emphasis?: "normal" | "strong";
}

export function StatBadge({ amount, emphasis = "normal" }: StatBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center rounded-full border px-3 py-1 text-tiny font-semibold",
        emphasis === "strong"
          ? "border-primary bg-primary text-primary-foreground shadow-sm"
          : "border-secondary-200 bg-secondary-50 text-secondary-800",
      )}
    >
      Save {amount}
    </span>
  );
}
