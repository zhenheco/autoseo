import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { Orchestrator } from '@/lib/agents/orchestrator'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { keyword } = body

    if (!keyword || typeof keyword !== 'string' || keyword.trim().length === 0) {
      return NextResponse.json(
        { error: '請提供有效的關鍵字' },
        { status: 400 }
      )
    }

    const articleJobId = uuidv4()

    const orchestrator = new Orchestrator()

    setImmediate(async () => {
      try {
        await orchestrator.execute({
          articleJobId,
          researchKeyword: keyword.trim(),
        })
      } catch (error) {
        console.error('[API] 文章生成失敗:', error)
      }
    })

    return NextResponse.json({
      success: true,
      articleJobId,
      message: '文章生成任務已啟動，請稍後查看文章列表',
    })
  } catch (error: unknown) {
    console.error('[API] 文章生成 API 錯誤:', error)
    const errorMessage = error instanceof Error ? error.message : '文章生成失敗'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
