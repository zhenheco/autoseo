'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Send } from 'lucide-react'
import { PublishControlDialog } from './PublishControlDialog'

interface ArticlePublishButtonProps {
  articleId: string
  currentStatus: string
  onPublishSuccess?: () => void
}

export function ArticlePublishButton({
  articleId,
  currentStatus,
  onPublishSuccess,
}: ArticlePublishButtonProps) {
  const [dialogOpen, setDialogOpen] = useState(false)

  const handlePublishSuccess = () => {
    if (onPublishSuccess) {
      onPublishSuccess()
    }
    window.location.reload()
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="h-8 text-xs"
        onClick={() => setDialogOpen(true)}
      >
        <Send className="mr-1.5 h-3 w-3" />
        <span className="hidden sm:inline">發布</span>
      </Button>

      <PublishControlDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        articleId={articleId}
        currentStatus={currentStatus}
        onPublishSuccess={handlePublishSuccess}
      />
    </>
  )
}
