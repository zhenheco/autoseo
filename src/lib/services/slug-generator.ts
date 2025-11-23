import { pinyin } from 'pinyin-pro'
import slugify from 'slugify'
import { createClient } from '@/lib/supabase/server'

export type SlugStrategy = 'auto' | 'pinyin' | 'english' | 'custom'

export async function generateAndEnsureUniqueSlug(
  keyword: string,
  websiteId: string,
  strategy: SlugStrategy = 'auto',
  customSlug?: string
): Promise<string> {
  if (strategy === 'custom' && customSlug) {
    const sanitized = slugify(customSlug, { lower: true, strict: true })
    return await ensureUniqueSlug(websiteId, sanitized)
  }

  let baseSlug = ''

  switch (strategy) {
    case 'auto':
      const hasChinese = /[\u4e00-\u9fa5]/.test(keyword)
      baseSlug = hasChinese
        ? generatePinyinSlug(keyword)
        : generateEnglishSlug(keyword)
      break

    case 'pinyin':
      baseSlug = generatePinyinSlug(keyword)
      break

    case 'english':
      baseSlug = generateEnglishSlug(keyword)
      break

    default:
      baseSlug = slugify(keyword, { lower: true, strict: true })
  }

  return await ensureUniqueSlug(websiteId, baseSlug)
}

export function generatePinyinSlug(text: string): string {
  const pinyinText = pinyin(text, {
    toneType: 'none',
    type: 'array'
  }).join('-')

  return slugify(pinyinText, {
    lower: true,
    strict: true,
    remove: /[*+~.()'"!:@]/g
  }).substring(0, 60)
}

export function generateEnglishSlug(text: string): string {
  const englishOnly = text.replace(/[^\w\s-]/g, ' ')

  return slugify(englishOnly, {
    lower: true,
    strict: true
  }).substring(0, 60)
}

export async function ensureUniqueSlug(
  websiteId: string,
  baseSlug: string
): Promise<string> {
  const supabase = await createClient()
  let slug = baseSlug
  let counter = 1

  while (true) {
    const { data, error } = await supabase
      .from('article_jobs')
      .select('id')
      .eq('website_id', websiteId)
      .eq('slug', slug)
      .maybeSingle()

    if (error && error.code !== 'PGRST116') {
      throw error
    }

    if (!data) break

    slug = `${baseSlug}-${counter}`
    counter++
  }

  return slug
}

export function assemblePublishURL(
  baseUrl: string,
  slugPrefix: string,
  slug: string
): string {
  const normalizedBase = baseUrl.replace(/\/$/, '')
  const normalizedPrefix = slugPrefix.replace(/^\/|\/$/g, '')
  const parts = [normalizedBase]

  if (normalizedPrefix) {
    parts.push(normalizedPrefix)
  }

  parts.push(slug)

  return parts.join('/')
}
