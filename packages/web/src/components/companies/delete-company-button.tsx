'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'

interface DeleteCompanyButtonProps {
  companyId: string
  companyName: string
}

export function DeleteCompanyButton({ companyId, companyName }: DeleteCompanyButtonProps) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const t = useTranslations('companies')
  const tCommon = useTranslations('common')

  async function handleDelete() {
    setLoading(true)

    try {
      const response = await fetch(`/api/companies/${companyId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error(t('deleteFailed'))
      }

      router.refresh()
    } catch (error) {
      console.error(error)
      alert(t('deleteFailedRetry'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="icon">
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-2xl">{t('deleteTitle')}</AlertDialogTitle>
          <AlertDialogDescription className="text-base">
            {t('deleteDescription', { companyName })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={loading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading ? t('deleting') : t('deleteButton')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
