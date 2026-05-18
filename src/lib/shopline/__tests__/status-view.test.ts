import { describe, expect, it } from "vitest";
import { getShoplineDashboardStatusView } from "../status-view";

describe("SHOPLINE dashboard status view", () => {
  it("maps active connections to a connected non-action state", () => {
    expect(
      getShoplineDashboardStatusView(
        {
          connected: true,
          shopHandle: "demo-shop",
          status: "active",
        },
        true,
      ),
    ).toMatchObject({
      kind: "connected",
      badgeKey: "connected",
      badgeVariant: "default",
      showConnectAction: false,
    });
  });

  it("maps missing connections to a connect action when an install URL is available", () => {
    expect(
      getShoplineDashboardStatusView({ connected: false }, true),
    ).toMatchObject({
      kind: "disconnected",
      badgeKey: "notConnected",
      badgeVariant: "secondary",
      showConnectAction: true,
    });
  });

  it("maps error and revoked connections to reconnect states without token details", () => {
    for (const status of ["error", "revoked"] as const) {
      expect(
        getShoplineDashboardStatusView({ connected: false, status }, true),
      ).toEqual({
        kind: "needs_reconnect",
        titleKey: "edit.shoplineNeedsReconnect",
        descriptionKey: "edit.shoplineReconnectHint",
        badgeKey: "edit.shoplineReconnectRequired",
        badgeVariant: "destructive",
        showConnectAction: true,
      });
    }
  });
});
