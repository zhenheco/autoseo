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

interface WebsiteSelectorProps {
  value: string | null;
  onChange: (websiteId: string) => void;
  onlyUserWebsites?: boolean;
  disabled?: boolean;
  placeholder?: string;
  articleWebsiteId?: string | null;
}

export function WebsiteSelector({
  value,
  onChange,
  onlyUserWebsites = true,
  disabled = false,
  placeholder = "選擇網站",
  articleWebsiteId = null,
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

        if (
          !value &&
          !hasSetDefaultRef.current &&
          result.websites.length > 0 &&
          result.companyId
        ) {
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
  }, [articleWebsiteId, getDefaultWebsite, onChange, value]);

  const handleChange = (websiteId: string) => {
    onChange(websiteId);
    if (companyId) {
      localStorage.setItem(`last-selected-website-${companyId}`, websiteId);
    }
  };

  if (loading) {
    return (
      <Select disabled>
        <SelectTrigger>
          <SelectValue placeholder="載入中..." />
        </SelectTrigger>
      </Select>
    );
  }

  if (websites.length === 0) {
    return (
      <Select disabled>
        <SelectTrigger>
          <SelectValue placeholder="尚未設定網站" />
        </SelectTrigger>
      </Select>
    );
  }

  const selectedWebsite = websites.find((w) => w.id === value);

  return (
    <>
      <Select
        value={value || ""}
        onValueChange={handleChange}
        disabled={disabled}
      >
        <SelectTrigger>
          <SelectValue placeholder={placeholder}>
            {selectedWebsite && (
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <span>{selectedWebsite.website_name}</span>
              </div>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
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
                      {(() => {
                        try {
                          return new URL(website.wordpress_url).hostname;
                        } catch {
                          return website.wordpress_url;
                        }
                      })()}
                    </span>
                  </div>
                </div>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </>
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
