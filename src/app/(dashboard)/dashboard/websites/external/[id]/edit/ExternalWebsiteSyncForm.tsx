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

interface SyncSetting {
  key: "syncOnPublish" | "syncOnUpdate" | "syncOnUnpublish" | "syncTranslations";
  label: string;
  description: string;
}

const SYNC_SETTINGS: SyncSetting[] = [
  {
    key: "syncOnPublish",
    label: "發布時同步",
    description: "文章發布時自動同步到此網站",
  },
  {
    key: "syncOnUpdate",
    label: "更新時同步",
    description: "文章更新時自動同步變更",
  },
  {
    key: "syncOnUnpublish",
    label: "取消發布時同步",
    description: "文章下架時通知此網站",
  },
  {
    key: "syncTranslations",
    label: "同步翻譯版本",
    description: "同時同步文章的翻譯版本",
  },
];

export function ExternalWebsiteSyncForm({
  websiteId,
  syncOnPublish: initialSyncOnPublish,
  syncOnUpdate: initialSyncOnUpdate,
  syncOnUnpublish: initialSyncOnUnpublish,
  syncTranslations: initialSyncTranslations,
}: SyncFormProps): React.ReactElement {
  const [settings, setSettings] = useState({
    syncOnPublish: initialSyncOnPublish ?? true,
    syncOnUpdate: initialSyncOnUpdate ?? true,
    syncOnUnpublish: initialSyncOnUnpublish ?? true,
    syncTranslations: initialSyncTranslations ?? true,
  });

  function handleToggle(key: SyncSetting["key"]): void {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5" />
          同步設定
        </CardTitle>
        <CardDescription>
          設定何時透過 Webhook 同步文章到此外部網站
        </CardDescription>
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
            {SYNC_SETTINGS.map(({ key, label, description }) => (
              <div
                key={key}
                className="flex items-center justify-between rounded-lg border p-4"
              >
                <div className="space-y-0.5">
                  <Label className="text-base">{label}</Label>
                  <p className="text-sm text-muted-foreground">{description}</p>
                </div>
                <Switch
                  checked={settings[key]}
                  onCheckedChange={() => handleToggle(key)}
                />
              </div>
            ))}
          </div>

          <Button type="submit">儲存同步設定</Button>
        </form>
      </CardContent>
    </Card>
  );
}
