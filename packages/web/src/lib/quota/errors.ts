import type { QuotaPlan } from "./enforcer";

export interface QuotaExceededDetails {
  resource: string;
  used: number;
  cap: number;
  plan: QuotaPlan;
}

export class QuotaExceededError extends Error {
  readonly resource: string;
  readonly used: number;
  readonly cap: number;
  readonly plan: QuotaPlan;

  constructor(details: QuotaExceededDetails) {
    super(`quota_exceeded:${details.resource}`);
    this.name = "QuotaExceededError";
    this.resource = details.resource;
    this.used = details.used;
    this.cap = details.cap;
    this.plan = details.plan;
  }
}

export class BrandNotFoundError extends Error {
  constructor(readonly brandId?: string | null) {
    super("brand_not_found");
    this.name = "BrandNotFoundError";
  }
}
