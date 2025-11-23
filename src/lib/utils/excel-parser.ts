import * as XLSX from 'xlsx'
import type { PublishPlan } from '@/app/(dashboard)/dashboard/articles/import/page'

interface ExcelRow {
  keyword: string
  website: string
  type?: string
  publishTime?: string
  slug?: string
}

export async function parseMultiColumnExcel(file: File): Promise<PublishPlan[]> {
  validateExcelFile(file)

  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
        const jsonData: unknown[][] = XLSX.utils.sheet_to_json(firstSheet, {
          header: 1,
          defval: ''
        })

        const firstRow = jsonData[0] as string[]
        const hasHeader = firstRow.some(cell =>
          typeof cell === 'string' &&
          (cell.includes('關鍵字') || cell.includes('網站') || cell.includes('keyword'))
        )

        const dataRows = hasHeader ? jsonData.slice(1) : jsonData

        const rows: ExcelRow[] = dataRows
          .filter(row => row.length > 0 && row[0])
          .map((row) => ({
            keyword: String(row[0] || '').trim(),
            website: String(row[1] || '').trim(),
            type: row[2] ? String(row[2]).trim() : undefined,
            publishTime: row[3] ? String(row[3]).trim() : undefined,
            slug: row[4] ? String(row[4]).trim() : undefined
          }))
          .filter(row => row.keyword && row.website)

        if (rows.length === 0) {
          reject(new Error('Excel 檔案中沒有有效的資料行'))
          return
        }

        if (rows.length > 500) {
          reject(new Error('超過最大限制 500 個關鍵字，請分批匯入'))
          return
        }

        const plans: PublishPlan[] = rows.map((row, index) => ({
          id: `plan-${Date.now()}-${index}`,
          keyword: sanitizeKeyword(row.keyword),
          websiteName: row.website,
          articleType: row.type && validateArticleType(row.type) ? row.type : undefined,
          publishTime: row.publishTime,
          customSlug: row.slug,
          status: 'valid'
        }))

        resolve(plans)
      } catch (error) {
        reject(new Error('無法解析 Excel 檔案，請確認格式正確'))
      }
    }

    reader.onerror = () => reject(new Error('檔案讀取失敗'))
    reader.readAsArrayBuffer(file)
  })
}

function validateExcelFile(file: File): void {
  const validTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel'
  ]
  const maxSize = 5 * 1024 * 1024

  if (!validTypes.includes(file.type)) {
    throw new Error('僅支援 .xlsx 和 .xls 格式')
  }

  if (file.size > maxSize) {
    throw new Error('檔案大小超過限制（最大 5MB）')
  }
}

function sanitizeKeyword(keyword: string): string {
  return keyword
    .trim()
    .replace(/[<>]/g, '')
    .substring(0, 200)
}

function validateArticleType(type: string): boolean {
  const validTypes = ['教學', '排行榜', '比較', '資訊型']
  return validTypes.includes(type)
}
