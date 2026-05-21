import { redirect } from 'next/navigation'

export default async function ArticlePreviewRedirect({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  // Redirect to main articles page
  redirect('/dashboard/articles')
}
