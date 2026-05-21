import { describe, expect, it } from "vitest";
import {
  transition,
  type SideEffect,
  type TrialEvent,
  type TrialState,
} from "../state-machine";

const at = new Date("2026-05-21T00:00:00.000Z");
const invoicePaid = {
  type: "invoice_paid",
  at,
  stripeInvoiceId: "in_123",
} satisfies TrialEvent;
const paymentFailed = {
  type: "payment_failed",
  at,
  stripeInvoiceId: "in_failed",
} satisfies TrialEvent;

const events = {
  card_added: { type: "card_added", at },
  trial_will_end: { type: "trial_will_end", daysOut: 3 },
  invoice_paid: invoicePaid,
  cancel_requested: { type: "cancel_requested", at },
  payment_failed: paymentFailed,
  expire_tick: { type: "expire_tick", at },
} satisfies Record<TrialEvent["type"], TrialEvent>;

type Expected = {
  state: TrialState;
  sideEffects: SideEffect[];
  changed: boolean;
};

type TransitionCase = Expected & {
  name: string;
  prev: TrialState;
  event: TrialEvent;
};

const convertedEffects: SideEffect[] = [
  { kind: "send_email", template: "converted" },
  { kind: "mark_subscription_active", stripeInvoiceId: "in_123" },
];
const cancelledEmail: SideEffect[] = [
  { kind: "send_email", template: "cancelled" },
];
const expiredEffects: SideEffect[] = [
  { kind: "send_email", template: "expired" },
  { kind: "downgrade_account" },
];
const convertedCancelEffects: SideEffect[] = [
  { kind: "send_email", template: "cancelled" },
  { kind: "downgrade_account" },
];
const convertedPaymentFailedEffects: SideEffect[] = [
  { kind: "start_dunning", stripeInvoiceId: "in_failed" },
];

function expectTransition(
  prev: TrialState,
  state: TrialState,
  sideEffects: SideEffect[] = [],
): Expected {
  return { state, sideEffects, changed: state !== prev };
}

const matrix = {
  pending: {
    card_added: expectTransition("pending", "active"),
    trial_will_end: expectTransition("pending", "pending"),
    invoice_paid: expectTransition("pending", "pending"),
    cancel_requested: expectTransition("pending", "cancelled", cancelledEmail),
    payment_failed: expectTransition("pending", "pending"),
    expire_tick: expectTransition("pending", "expired", expiredEffects),
  },
  active: {
    card_added: expectTransition("active", "active"),
    trial_will_end: expectTransition("active", "active", [
      { kind: "send_email", template: "trial_d3" },
    ]),
    invoice_paid: expectTransition("active", "converted", convertedEffects),
    cancel_requested: expectTransition("active", "cancelled", cancelledEmail),
    payment_failed: expectTransition("active", "active", [
      { kind: "start_dunning", stripeInvoiceId: "in_failed" },
    ]),
    expire_tick: expectTransition("active", "expired", expiredEffects),
  },
  converted: {
    card_added: expectTransition("converted", "converted"),
    trial_will_end: expectTransition("converted", "converted"),
    invoice_paid: expectTransition("converted", "converted"),
    cancel_requested: expectTransition(
      "converted",
      "cancelled",
      convertedCancelEffects,
    ),
    payment_failed: expectTransition(
      "converted",
      "converted",
      convertedPaymentFailedEffects,
    ),
    expire_tick: expectTransition("converted", "converted"),
  },
  cancelled: {
    card_added: expectTransition("cancelled", "cancelled"),
    trial_will_end: expectTransition("cancelled", "cancelled"),
    invoice_paid: expectTransition("cancelled", "cancelled"),
    cancel_requested: expectTransition("cancelled", "cancelled"),
    payment_failed: expectTransition("cancelled", "cancelled"),
    expire_tick: expectTransition("cancelled", "cancelled"),
  },
  expired: {
    card_added: expectTransition("expired", "expired"),
    trial_will_end: expectTransition("expired", "expired"),
    invoice_paid: expectTransition("expired", "converted", convertedEffects),
    cancel_requested: expectTransition("expired", "expired"),
    payment_failed: expectTransition("expired", "expired"),
    expire_tick: expectTransition("expired", "expired"),
  },
} satisfies Record<TrialState, Record<TrialEvent["type"], Expected>>;

const states = Object.keys(matrix) as TrialState[];
const eventTypes = Object.keys(events) as TrialEvent["type"][];
const cases: TransitionCase[] = states.flatMap((prev) =>
  eventTypes.map((eventType) => ({
    name: `${prev} + ${eventType}`,
    prev,
    event: events[eventType],
    ...matrix[prev][eventType],
  })),
);

describe("trial state machine", () => {
  it.each(cases)("$name", ({ prev, event, state, sideEffects, changed }) => {
    expect(transition(prev, event)).toEqual({ state, sideEffects, changed });
  });

  it("sends the D-1 email for an active trial_will_end event", () => {
    expect(
      transition("active", { type: "trial_will_end", daysOut: 1 }),
    ).toEqual({
      state: "active",
      sideEffects: [{ kind: "send_email", template: "trial_d1" }],
      changed: false,
    });
  });

  it("treats a second card_added event as a no-op after activation", () => {
    const first = transition("pending", events.card_added);

    expect(first.state).toBe("active");
    expect(transition(first.state, events.card_added)).toEqual({
      state: "active",
      sideEffects: [],
      changed: false,
    });
  });

  it("treats a duplicate invoice_paid event as a state-level no-op", () => {
    const first = transition("active", events.invoice_paid);

    expect(first.state).toBe("converted");
    expect(transition(first.state, events.invoice_paid)).toEqual({
      state: "converted",
      sideEffects: [],
      changed: false,
    });
  });

  it("ignores expire_tick after conversion", () => {
    expect(transition("converted", events.expire_tick)).toEqual({
      state: "converted",
      sideEffects: [],
      changed: false,
    });
  });
});
