import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: vi.fn(() => (key: string) => {
    const messages: Record<string, string> = {
      title: "Settings",
      description: "Manage your account settings",
      accountInfo: "Account Information",
      accountInfoDescription: "Manage your basic account information",
      accountName: "Account Name",
      accountNamePlaceholder: "Enter account name",
      saveChanges: "Save Changes",
      "billing.title": "Manage subscription",
      "billing.description": "Open Stripe billing to update payment details.",
      "billing.ownerHelp":
        "Manage billing, invoices, and plan details in Stripe.",
      "billing.manageButton": "Manage subscription",
      "billing.contactOwner": "Contact your company owner to manage billing.",
      "refund.title": "Refund Request",
      "refund.description": "Request a refund here.",
      "refund.policy": "Automatic refund within 7 days of purchase.",
      "refund.requestButton": "Request Refund",
    };
    return messages[key] ?? key;
  }),
}));

vi.mock("../actions", () => ({
  updateCompany: vi.fn(),
}));

vi.mock("@/components/refund", () => ({
  RefundRequestDialog: () => null,
}));

describe("SettingsClient subscription portal card", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the Manage subscription button to company owners", async () => {
    const { SettingsClient } = await import("../settings-client");

    render(
      <SettingsClient
        company={{ id: "company-1", name: "Acme" }}
        searchParams={{}}
        canManageSubscription={true}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Manage subscription" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Contact your company owner to manage billing."),
    ).not.toBeInTheDocument();
  });

  it("hides the Manage subscription button from non-owner members", async () => {
    const { SettingsClient } = await import("../settings-client");

    render(
      <SettingsClient
        company={{ id: "company-1", name: "Acme" }}
        searchParams={{}}
        canManageSubscription={false}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "Manage subscription" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("Contact your company owner to manage billing."),
    ).toBeInTheDocument();
  });
});
