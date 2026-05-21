export const LEGACY_FREE_PLAN_SLUG = "free";
export const MANUAL_GRANDFATHER_TRIAL_STATUS = "grandfather_trial";
export const MANUAL_GRANDFATHER_ACCESS_TIER = "pro";

export type PaidSubscriptionTier =
  | "starter"
  | "pro"
  | "professional"
  | "business"
  | "agency";

export type UserSubscriptionTier = PaidSubscriptionTier | null;

export function isPaidSubscriptionTier(
  value: unknown,
): value is PaidSubscriptionTier {
  return (
    value === "starter" ||
    value === "pro" ||
    value === "professional" ||
    value === "business" ||
    value === "agency"
  );
}
