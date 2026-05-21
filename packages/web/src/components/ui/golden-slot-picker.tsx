"use client";

import {
  type GoldenSlot,
  getGoldenSlotOptions,
} from "@/lib/scheduling/golden-slots";
import { cn } from "@/lib/utils";

export type { GoldenSlot };

export interface GoldenSlotPickerProps {
  value?: GoldenSlot;
  onChange(slot: GoldenSlot): void;
  locale?: string;
}

export function GoldenSlotPicker({
  value,
  onChange,
  locale = "zh-TW",
}: GoldenSlotPickerProps) {
  const slots = getGoldenSlotOptions(locale);

  return (
    <div className="grid gap-2 sm:grid-cols-3" role="radiogroup">
      {slots.map((slot) => {
        const selected = value?.utcHour === slot.utcHour;
        const [timeLabel, ...suffix] = slot.label.split(" ");
        const zoneLabel = suffix.join(" ");

        return (
          <button
            key={slot.utcHour}
            type="button"
            role="radio"
            aria-checked={selected}
            className={cn(
              "rounded-lg border px-4 py-3 text-left transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              selected
                ? "border-primary bg-primary-50 text-primary-800"
                : "border-border-subtle bg-bg-surface text-text-primary",
            )}
            onClick={() => onChange(slot)}
          >
            <span className="block text-body font-semibold">{timeLabel}</span>
            <span className="mt-1 block text-tiny text-text-muted">
              {zoneLabel}
            </span>
          </button>
        );
      })}
    </div>
  );
}
