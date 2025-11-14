const TRUSTED_IMAGE_SOURCES = [
  'https://drive.google.com',
  'https://lh3.googleusercontent.com',
  'https://lh4.googleusercontent.com',
  'https://lh5.googleusercontent.com',
  'https://lh6.googleusercontent.com',
]

const UNSAFE_PROTOCOLS = [
  'javascript:',
  'data:',
  'vbscript:',
  'file:',
]

export function validateImageURL(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false
  }

  const trimmedUrl = url.trim().toLowerCase()

  if (UNSAFE_PROTOCOLS.some(protocol => trimmedUrl.startsWith(protocol))) {
    return false
  }

  if (!trimmedUrl.startsWith('https://')) {
    return false
  }

  return TRUSTED_IMAGE_SOURCES.some(source =>
    url.trim().startsWith(source)
  )
}

export function sanitizeImageUrl(url: string): string {
  if (!validateImageURL(url)) {
    return ''
  }
  return url
}
