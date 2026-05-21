import { TrialCountdown } from "./trial-countdown";

export function TrialCountdownExample() {
  return (
    <TrialCountdown
      trialEndsAt={new Date("2026-05-24T00:00:00.000Z")}
      onUpgrade={() => undefined}
    />
  );
}
