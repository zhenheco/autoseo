'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function createArticle(formData: FormData) {
  const keyword = formData.get('keyword') as string

  if (!keyword || keyword.trim().length === 0) {
    redirect('/dashboard/articles/new?error=' + encodeURIComponent('請輸入關鍵字'))
  }

  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/articles/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: keyword.trim(),
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || '文章生成失敗')
    }

    const data = await response.json()

    revalidatePath('/dashboard/articles')
    redirect(`/dashboard/articles?success=${encodeURIComponent('文章生成任務已啟動')}`)
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '未知錯誤'
    redirect('/dashboard/articles/new?error=' + encodeURIComponent(errorMessage))
  }
}
