'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Globe } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Website {
  id: string
  website_name: string
  base_url: string
  company_id: string
  is_active?: boolean
}

interface WebsiteSelectorProps {
  value: string | null
  onChange: (websiteId: string) => void
  onlyUserWebsites?: boolean
  disabled?: boolean
  placeholder?: string
  articleWebsiteId?: string | null
}

export function WebsiteSelector({
  value,
  onChange,
  onlyUserWebsites = true,
  disabled = false,
  placeholder = '選擇網站',
  articleWebsiteId = null,
}: WebsiteSelectorProps) {
  const [websites, setWebsites] = useState<Website[]>([])
  const [loading, setLoading] = useState(true)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const hasSetDefaultRef = useRef(false)
  const hasFetchedRef = useRef(false)

  const getDefaultWebsite = useCallback((sites: Website[], companyId: string, articleWebId: string | null): Website | null => {
    if (sites.length === 0) return null

    const localStorageKey = `last-selected-website-${companyId}`
    const lastSelectedId = localStorage.getItem(localStorageKey)

    if (lastSelectedId) {
      const lastSelected = sites.find(s => s.id === lastSelectedId && s.is_active !== false)
      if (lastSelected) return lastSelected
    }

    if (articleWebId) {
      const articleWebsite = sites.find(s => s.id === articleWebId && s.is_active !== false)
      if (articleWebsite) return articleWebsite
    }

    return sites.find(s => s.is_active !== false) || sites[0]
  }, [])

  useEffect(() => {
    async function fetchWebsites() {
      if (hasFetchedRef.current) return
      hasFetchedRef.current = true

      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) return

      const { data: membership } = await supabase
        .from('company_members')
        .select('company_id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single()

      if (!membership) return

      setCompanyId(membership.company_id)

      const { data, error } = await supabase
        .from('website_configs')
        .select('id, website_name, base_url, company_id, is_active')
        .eq('company_id', membership.company_id)
        .order('website_name')

      if (error) {
        console.error('Failed to fetch websites:', error)
        setLoading(false)
        return
      }

      setWebsites(data || [])
      setLoading(false)

      if (!value && !hasSetDefaultRef.current && (data || []).length > 0) {
        const defaultWebsite = getDefaultWebsite(data || [], membership.company_id, articleWebsiteId)
        if (defaultWebsite) {
          hasSetDefaultRef.current = true
          onChange(defaultWebsite.id)
        }
      }
    }

    fetchWebsites()
  }, [onlyUserWebsites, articleWebsiteId, getDefaultWebsite])

  const handleChange = (websiteId: string) => {
    onChange(websiteId)
    if (companyId) {
      localStorage.setItem(`last-selected-website-${companyId}`, websiteId)
    }
  }

  if (loading) {
    return (
      <Select disabled>
        <SelectTrigger>
          <SelectValue placeholder="載入中..." />
        </SelectTrigger>
      </Select>
    )
  }

  if (websites.length === 0) {
    return (
      <Select disabled>
        <SelectTrigger>
          <SelectValue placeholder="尚未設定網站" />
        </SelectTrigger>
      </Select>
    )
  }

  const selectedWebsite = websites.find(w => w.id === value)

  return (
    <>
      <Select value={value || ''} onValueChange={handleChange} disabled={disabled}>
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
            const isActive = website.is_active !== false
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
                      <span className={`font-medium ${!isActive ? 'text-muted-foreground' : ''}`}>
                        {website.website_name}
                      </span>
                      {!isActive && (
                        <span className="text-xs text-muted-foreground">（已停用）</span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {(() => {
                        try {
                          return new URL(website.base_url).hostname
                        } catch {
                          return website.base_url
                        }
                      })()}
                    </span>
                  </div>
                </div>
              </SelectItem>
            )
          })}
        </SelectContent>
      </Select>
    </>
  )
}

export function getSelectedWebsiteName(websites: Website[], websiteId: string | null): string | null {
  if (!websiteId) return null
  const website = websites.find(w => w.id === websiteId)
  return website?.website_name || null
}
