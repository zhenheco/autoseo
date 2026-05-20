'use client'

import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { LogOut } from 'lucide-react'
import { useTranslations } from 'next-intl'

export function LogoutButton() {
  const t = useTranslations('nav')

  const handleLogoutClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault()
    const form = document.getElementById('logout-form') as HTMLFormElement
    form?.requestSubmit()
  }

  return (
    <DropdownMenuItem onClick={handleLogoutClick}>
      <LogOut className="mr-2 h-4 w-4" />
      <span>{t('logout')}</span>
    </DropdownMenuItem>
  )
}
