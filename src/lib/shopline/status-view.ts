import type { ShoplineConnectionPublicStatus } from "./connections";

export type ShoplineDashboardStatusKind =
  | "connected"
  | "disconnected"
  | "needs_reconnect";

export interface ShoplineDashboardStatusView {
  kind: ShoplineDashboardStatusKind;
  titleKey:
    | "edit.shoplineConnected"
    | "edit.shoplineNotConnected"
    | "edit.shoplineNeedsReconnect";
  descriptionKey: "edit.shoplineAuthorizeHint" | "edit.shoplineReconnectHint";
  badgeKey: "connected" | "notConnected" | "edit.shoplineReconnectRequired";
  badgeVariant: "default" | "secondary" | "destructive";
  showConnectAction: boolean;
}

export function getShoplineDashboardStatusView(
  status: ShoplineConnectionPublicStatus,
  hasInstallHref: boolean,
): ShoplineDashboardStatusView {
  if (status.connected) {
    return {
      kind: "connected",
      titleKey: "edit.shoplineConnected",
      descriptionKey: "edit.shoplineAuthorizeHint",
      badgeKey: "connected",
      badgeVariant: "default",
      showConnectAction: false,
    };
  }

  if (status.status === "error" || status.status === "revoked") {
    return {
      kind: "needs_reconnect",
      titleKey: "edit.shoplineNeedsReconnect",
      descriptionKey: "edit.shoplineReconnectHint",
      badgeKey: "edit.shoplineReconnectRequired",
      badgeVariant: "destructive",
      showConnectAction: hasInstallHref,
    };
  }

  return {
    kind: "disconnected",
    titleKey: "edit.shoplineNotConnected",
    descriptionKey: "edit.shoplineAuthorizeHint",
    badgeKey: "notConnected",
    badgeVariant: "secondary",
    showConnectAction: hasInstallHref,
  };
}
