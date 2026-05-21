export type TrialState =
  | "pending"
  | "active"
  | "converted"
  | "cancelled"
  | "expired";

export type TrialEvent =
  | { type: "card_added"; at: Date }
  | { type: "trial_will_end"; daysOut: 1 | 3 }
  | { type: "invoice_paid"; at: Date; stripeInvoiceId: string }
  | { type: "cancel_requested"; at: Date }
  | { type: "payment_failed"; at: Date; stripeInvoiceId: string }
  | { type: "expire_tick"; at: Date };

export type SideEffect =
  | {
      kind: "send_email";
      template:
        | "trial_d3"
        | "trial_d1"
        | "converted"
        | "cancelled"
        | "expired"
        | "payment_failed"
        | "payment_failed_d1";
    }
  | { kind: "mark_subscription_active"; stripeInvoiceId: string }
  | { kind: "start_dunning" }
  | { kind: "downgrade_account" };

export interface TransitionResult {
  state: TrialState;
  sideEffects: SideEffect[];
  changed: boolean;
}

function stay(
  state: TrialState,
  sideEffects: SideEffect[] = [],
): TransitionResult {
  return { state, sideEffects, changed: false };
}

function move(
  state: TrialState,
  sideEffects: SideEffect[] = [],
): TransitionResult {
  return { state, sideEffects, changed: true };
}

function converted(stripeInvoiceId: string): TransitionResult {
  return move("converted", [
    { kind: "send_email", template: "converted" },
    { kind: "mark_subscription_active", stripeInvoiceId },
  ]);
}

function expired(): TransitionResult {
  return move("expired", [
    { kind: "send_email", template: "expired" },
    { kind: "downgrade_account" },
  ]);
}

export function transition(
  prev: TrialState,
  event: TrialEvent,
): TransitionResult {
  switch (prev) {
    case "pending":
      switch (event.type) {
        case "card_added":
          return move("active");
        case "cancel_requested":
          return move("cancelled", [
            { kind: "send_email", template: "cancelled" },
          ]);
        case "expire_tick":
          return expired();
        default:
          return stay(prev);
      }

    case "active":
      switch (event.type) {
        case "trial_will_end":
          return stay(prev, [
            {
              kind: "send_email",
              template: event.daysOut === 3 ? "trial_d3" : "trial_d1",
            },
          ]);
        case "invoice_paid":
          return converted(event.stripeInvoiceId);
        case "cancel_requested":
          return move("cancelled", [
            { kind: "send_email", template: "cancelled" },
          ]);
        case "payment_failed":
          return stay(prev, [
            { kind: "send_email", template: "payment_failed_d1" },
            { kind: "start_dunning" },
          ]);
        case "expire_tick":
          return expired();
        default:
          return stay(prev);
      }

    case "converted":
      switch (event.type) {
        case "cancel_requested":
          return move("cancelled", [
            { kind: "send_email", template: "cancelled" },
            { kind: "downgrade_account" },
          ]);
        case "payment_failed":
          return stay(prev, [
            { kind: "send_email", template: "payment_failed_d1" },
            { kind: "start_dunning" },
          ]);
        default:
          return stay(prev);
      }

    case "expired":
      if (event.type === "invoice_paid") {
        return converted(event.stripeInvoiceId);
      }

      return stay(prev);

    case "cancelled":
      return stay(prev);
  }
}
