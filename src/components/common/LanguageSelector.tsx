'use client'

import { useState, useEffect } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Languages } from 'lucide-react'

interface Language {
  code: string
  name: string
  flag: string
}

const SUPPORTED_LANGUAGES: Language[] = [
  { code: 'zh-TW', name: '繁體中文', flag: '🇹🇼' },
  { code: 'zh-CN', name: '简体中文', flag: '🇨🇳' },
  { code: 'en-US', name: 'English', flag: '🇺🇸' },
  { code: 'ja-JP', name: '日本語', flag: '🇯🇵' },
  { code: 'ko-KR', name: '한국어', flag: '🇰🇷' },
  { code: 'vi-VN', name: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'ms-MY', name: 'Bahasa Melayu', flag: '🇲🇾' },
  { code: 'th-TH', name: 'ไทย', flag: '🇹🇭' },
  { code: 'id-ID', name: 'Bahasa Indonesia', flag: '🇮🇩' },
  { code: 'tl-PH', name: 'Filipino', flag: '🇵🇭' },
  { code: 'fr-FR', name: 'Français', flag: '🇫🇷' },
  { code: 'de-DE', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'es-ES', name: 'Español', flag: '🇪🇸' },
  { code: 'pt-PT', name: 'Português', flag: '🇵🇹' },
  { code: 'it-IT', name: 'Italiano', flag: '🇮🇹' },
  { code: 'ru-RU', name: 'Русский', flag: '🇷🇺' },
  { code: 'ar-SA', name: 'العربية', flag: '🇸🇦' },
  { code: 'hi-IN', name: 'हिन्दी', flag: '🇮🇳' },
]

const STORAGE_KEY = 'preferred-language'

export function LanguageSelector() {
  const [selectedLanguage, setSelectedLanguage] = useState<string>('zh-TW')

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      setTimeout(() => {
        setSelectedLanguage(stored)
      }, 0)
    }
  }, [])

  const handleLanguageChange = (value: string) => {
    setSelectedLanguage(value)
    localStorage.setItem(STORAGE_KEY, value)

    window.dispatchEvent(new CustomEvent('languageChanged', { detail: value }))
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground whitespace-nowrap">撰寫語系</span>
      <Select value={selectedLanguage} onValueChange={handleLanguageChange}>
        <SelectTrigger className="h-9 w-[180px] gap-2 border-border bg-background">
          <Languages className="h-4 w-4 text-muted-foreground" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SUPPORTED_LANGUAGES.map((lang) => (
            <SelectItem key={lang.code} value={lang.code}>
              <div className="flex items-center gap-2">
                <span>{lang.flag}</span>
                <span>{lang.name}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
