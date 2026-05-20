"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useCookieConsent } from "./CookieConsentProvider";
import { useTranslations } from "next-intl";
import {
  Cookie,
  Shield,
  BarChart3,
  Megaphone,
  ExternalLink,
} from "lucide-react";

/**
 * Cookie 設定對話框
 * 讓用戶詳細設定各類 Cookie 的同意狀態
 */
export function CookieSettingsDialog() {
  const {
    consent,
    isSettingsOpen,
    closeSettings,
    updateConsent,
    acceptAll,
    rejectAll,
  } = useCookieConsent();
  const t = useTranslations("cookies");

  const handleSave = () => {
    closeSettings();
  };

  return (
    <Dialog
      open={isSettingsOpen}
      onOpenChange={(open) => !open && closeSettings()}
    >
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Cookie className="h-5 w-5" />
            {t("settingsTitle")}
          </DialogTitle>
          <DialogDescription>
            {t("settingsDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* 必要 Cookie */}
          <div className="flex items-start justify-between gap-4 p-4 rounded-lg border bg-muted/30">
            <div className="flex gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <div>
                <Label className="text-base font-medium">{t("necessary")}</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  {t("necessaryDescription")}
                </p>
              </div>
            </div>
            <Switch checked={true} disabled className="shrink-0" />
          </div>

          {/* 分析 Cookie */}
          <div className="flex items-start justify-between gap-4 p-4 rounded-lg border">
            <div className="flex gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
                <BarChart3 className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <Label className="text-base font-medium">{t("analytics")}</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  {t("analyticsDescription")}
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-muted">
                    Google Analytics 4
                  </span>
                </div>
              </div>
            </div>
            <Switch
              checked={consent.analytics}
              onCheckedChange={(checked) =>
                updateConsent({ analytics: checked })
              }
              className="shrink-0"
            />
          </div>

          {/* 行銷 Cookie */}
          <div className="flex items-start justify-between gap-4 p-4 rounded-lg border">
            <div className="flex gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-500/10">
                <Megaphone className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <Label className="text-base font-medium">{t("marketing")}</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  {t("marketingDescription")}
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-muted">
                    {t("adTracking")}
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-muted">
                    {t("remarketing")}
                  </span>
                </div>
              </div>
            </div>
            <Switch
              checked={consent.marketing}
              onCheckedChange={(checked) =>
                updateConsent({ marketing: checked })
              }
              className="shrink-0"
            />
          </div>

          {/* 隱私政策連結 */}
          <div className="text-sm text-muted-foreground">
            <p>
              {t("privacyInfo")}{" "}
              <a
                href="/privacy"
                target="_blank"
                className="text-primary hover:underline inline-flex items-center gap-1"
              >
                {t("privacyPolicy")}
                <ExternalLink className="h-3 w-3" />
              </a>
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={rejectAll}
            className="w-full sm:w-auto"
          >
            {t("acceptNecessaryOnly")}
          </Button>
          <Button
            variant="outline"
            onClick={acceptAll}
            className="w-full sm:w-auto"
          >
            {t("acceptAll")}
          </Button>
          <Button onClick={handleSave} className="w-full sm:w-auto">
            {t("saveSettings")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
