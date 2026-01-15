"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Globe } from "lucide-react";
import { getUserWebsites } from "@/app/(dashboard)/dashboard/websites/actions";

interface Website {
  id: string;
  website_name: string;
  wordpress_url: string;
  company_id: string;
  is_active?: boolean | null;
}

/** 從 URL 提取 hostname，失敗時返回原始字串 */
function getHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

interface WebsiteSelectorProps {
  value: string | null;
  onChange: (websiteId: string | null) => void;
  onlyUserWebsites?: boolean;
  disabled?: boolean;
  placeholder?: string;
  articleWebsiteId?: string | null;
  allowNoWebsite?: boolean;
}

export function WebsiteSelector({
  value,
  onChange,
  onlyUserWebsites = true,
  disabled = false,
  placeholder = "選擇網站",
  articleWebsiteId = null,
  allowNoWebsite = false,
}: WebsiteSelectorProps) {
  const [websites, setWebsites] = useState<Website[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const hasSetDefaultRef = useRef(false);

  const getDefaultWebsite = useCallback(
    (
      sites: Website[],
      companyId: string,
      articleWebId: string | null,
    ): Website | null => {
      if (sites.length === 0) return null;

      const localStorageKey = `last-selected-website-${companyId}`;
      const lastSelectedId = localStorage.getItem(localStorageKey);

      if (lastSelectedId) {
        const lastSelected = sites.find(
          (s) => s.id === lastSelectedId && s.is_active !== false,
        );
        if (lastSelected) return lastSelected;
      }

      if (articleWebId) {
        const articleWebsite = sites.find(
          (s) => s.id === articleWebId && s.is_active !== false,
        );
        if (articleWebsite) return articleWebsite;
      }

      return sites.find((s) => s.is_active !== false) || sites[0];
    },
    [],
  );

  useEffect(() => {
    let mounted = true;

    async function fetchWebsites() {
      try {
        const result = await getUserWebsites();

        if (!mounted) return;

        setCompanyId(result.companyId);
        setWebsites(result.websites);
        setLoading(false);

        if (!value && !hasSetDefaultRef.current) {
          if (allowNoWebsite) {
            hasSetDefaultRef.current = true;
            onChange(null);
          } else if (result.websites.length > 0 && result.companyId) {
            const defaultWebsite = getDefaultWebsite(
              result.websites,
              result.companyId,
              articleWebsiteId,
            );
            if (defaultWebsite) {
              hasSetDefaultRef.current = true;
              onChange(defaultWebsite.id);
            }
          }
        }
      } catch (error) {
        console.error("Failed to fetch websites:", error);
        if (mounted) {
          setLoading(false);
        }
      }
    }

    fetchWebsites();

    return () => {
      mounted = false;
    };
  }, [articleWebsiteId, getDefaultWebsite, onChange, value, allowNoWebsite]);

  function handleChange(websiteId: string): void {
    const isNoWebsite = websiteId === "__none__";
    onChange(isNoWebsite ? null : websiteId);

    if (!companyId) return;

    const storageKey = `last-selected-website-${companyId}`;
    if (isNoWebsite) {
      localStorage.removeItem(storageKey);
    } else {
      localStorage.setItem(storageKey, websiteId);
    }
  }

  if (loading) {
    return (
      <Select disabled>
        <SelectTrigger>
          <SelectValue placeholder="載入中..." />
        </SelectTrigger>
      </Select>
    );
  }

  if (websites.length === 0 && !allowNoWebsite) {
    return (
      <Select disabled>
        <SelectTrigger>
          <SelectValue placeholder="尚未設定網站" />
        </SelectTrigger>
      </Select>
    );
  }

  const selectedWebsite = websites.find((w) => w.id === value);

  // 計算 Select 的 value：
  // - allowNoWebsite=true 且 value=null → "__none__"（對應「單純寫文章」選項）
  // - allowNoWebsite=false 且 value=null → ""（顯示 placeholder）
  // - 有選擇網站 → 直接使用 value
  function getSelectValue(): string {
    if (value === null) {
      return allowNoWebsite ? "__none__" : "";
    }
    return value;
  }

  function renderSelectedValue(): React.ReactNode {
    if (value === null && allowNoWebsite) {
      return <span className="text-muted-foreground">單純寫文章</span>;
    }
    if (selectedWebsite) {
      return (
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-muted-foreground" />
          <span>{selectedWebsite.website_name}</span>
        </div>
      );
    }
    return null;
  }

  return (
    <Select
      value={getSelectValue()}
      onValueChange={handleChange}
      disabled={disabled}
    >
      <SelectTrigger>
        <SelectValue placeholder={placeholder}>
          {renderSelectedValue()}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {allowNoWebsite && (
          <SelectItem value="__none__">
            <span className="text-muted-foreground">單純寫文章</span>
          </SelectItem>
        )}
        {websites.map((website) => {
          const isActive = website.is_active !== false;
          return (
            <SelectItem
              key={website.id}
              value={website.id}
              disabled={!isActive}
            >
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <div className="flex flex-col items-start">
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-medium ${!isActive ? "text-muted-foreground" : ""}`}
                    >
                      {website.website_name}
                    </span>
                    {!isActive && (
                      <span className="text-xs text-muted-foreground">
                        （已停用）
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {getHostname(website.wordpress_url)}
                  </span>
                </div>
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

export function getSelectedWebsiteName(
  websites: Website[],
  websiteId: string | null,
): string | null {
  if (!websiteId) return null;
  const website = websites.find((w) => w.id === websiteId);
  return website?.website_name || null;
}
