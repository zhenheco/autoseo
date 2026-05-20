interface WebsiteMatch {
  websiteId: string
  confidence: 'exact' | 'fuzzy' | 'none'
  suggestion?: string
}

interface Website {
  id: string
  name: string
}

export async function matchWebsiteName(
  inputName: string,
  websites: Website[]
): Promise<WebsiteMatch> {
  const exactMatch = websites.find(w =>
    w.name.toLowerCase() === inputName.toLowerCase()
  )

  if (exactMatch) {
    return {
      websiteId: exactMatch.id,
      confidence: 'exact'
    }
  }

  const fuzzyMatch = websites.find(w =>
    w.name.toLowerCase().includes(inputName.toLowerCase()) ||
    inputName.toLowerCase().includes(w.name.toLowerCase())
  )

  if (fuzzyMatch) {
    return {
      websiteId: fuzzyMatch.id,
      confidence: 'fuzzy',
      suggestion: fuzzyMatch.name
    }
  }

  return {
    websiteId: '',
    confidence: 'none'
  }
}

export function calculateMatchScore(input: string, target: string): number {
  const inputLower = input.toLowerCase()
  const targetLower = target.toLowerCase()

  if (inputLower === targetLower) return 1.0

  if (targetLower.includes(inputLower) || inputLower.includes(targetLower)) {
    return 0.8
  }

  const distance = levenshteinDistance(inputLower, targetLower)
  const maxLen = Math.max(inputLower.length, targetLower.length)
  return 1 - distance / maxLen
}

function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length
  const len2 = str2.length
  const matrix: number[][] = []

  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i]
  }

  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      )
    }
  }

  return matrix[len1][len2]
}
