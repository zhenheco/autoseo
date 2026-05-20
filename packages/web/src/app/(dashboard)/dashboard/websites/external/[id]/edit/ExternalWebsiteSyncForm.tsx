"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RefreshCw } from "lucide-react";
import { updateExternalWebsiteSyncSettings } from "../../actions";
import type { SyncFormProps } from "@/types/external-website.types";
import { useTranslations } from "next-intl";

type SyncSettingKey =
  | "syncOnPublish"
  | "syncOnUpdate"
  | "syncOnUnpublish"
  | "syncTranslations";

export function ExternalWebsiteSyncForm({
  websiteId,
  syncOnPublish: initialSyncOnPublish,
  syncOnUpdate: initialSyncOnUpdate,
  syncOnUnpublish: initialSyncOnUnpublish,
  syncTranslations: initialSyncTranslations,
}: SyncFormProps): React.ReactElement {
  const t = useTranslations("externalWebsites");

  const SYNC_SETTINGS: Array<{
    key: SyncSettingKey;
    labelKey: string;
    descKey: string;
  }> = [
    {
      key: "syncOnPublish",
      labelKey: "syncSettings.syncOnPublish",
      descKey: "syncSettings.syncOnPublishDesc",
    },
    {
      key: "syncOnUpdate",
      labelKey: "syncSettings.syncOnUpdate",
      descKey: "syncSettings.syncOnUpdateDesc",
    },
    {
      key: "syncOnUnpublish",
      labelKey: "syncSettings.syncOnUnpublish",
      descKey: "syncSettings.syncOnUnpublishDesc",
    },
    {
      key: "syncTranslations",
      labelKey: "syncSettings.syncTranslations",
      descKey: "syncSettings.syncTranslationsDesc",
    },
  ];

  const [settings, setSettings] = useState({
    syncOnPublish: initialSyncOnPublish ?? true,
    syncOnUpdate: initialSyncOnUpdate ?? true,
    syncOnUnpublish: initialSyncOnUnpublish ?? true,
    syncTranslations: initialSyncTranslations ?? true,
  });

  function handleToggle(key: SyncSettingKey): void {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5" />
          {t("syncSettingsTitle")}
        </CardTitle>
        <CardDescription>{t("syncSettingsDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={updateExternalWebsiteSyncSettings} className="space-y-4">
          <input type="hidden" name="websiteId" value={websiteId} />
          <input
            type="hidden"
            name="syncOnPublish"
            value={String(settings.syncOnPublish)}
          />
          <input
            type="hidden"
            name="syncOnUpdate"
            value={String(settings.syncOnUpdate)}
          />
          <input
            type="hidden"
            name="syncOnUnpublish"
            value={String(settings.syncOnUnpublish)}
          />
          <input
            type="hidden"
            name="syncTranslations"
            value={String(settings.syncTranslations)}
          />

          <div className="space-y-4">
            {SYNC_SETTINGS.map(({ key, labelKey, descKey }) => (
              <div
                key={key}
                className="flex items-center justify-between rounded-lg border p-4"
              >
                <div className="space-y-0.5">
                  <Label className="text-base">{t(labelKey)}</Label>
                  <p className="text-sm text-muted-foreground">{t(descKey)}</p>
                </div>
                <Switch
                  checked={settings[key]}
                  onCheckedChange={() => handleToggle(key)}
                />
              </div>
            ))}
          </div>

          <Button type="submit">{t("saveSyncSettings")}</Button>
        </form>
      </CardContent>
    </Card>
  );
}
