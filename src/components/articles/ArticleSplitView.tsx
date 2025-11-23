'use client'

import { ReactNode, useEffect, useState } from 'react'
import { Allotment } from 'allotment'
import 'allotment/dist/style.css'

interface ArticleSplitViewProps {
  leftPane: ReactNode
  rightPane: ReactNode
  defaultSizes?: number[]
  minLeftSize?: number
  maxLeftSize?: number
}

export function ArticleSplitView({
  leftPane,
  rightPane,
  defaultSizes = [40, 60],
  minLeftSize = 300,
  maxLeftSize = undefined,
}: ArticleSplitViewProps) {
  const [sizes, setSizes] = useState<number[]>(defaultSizes)

  useEffect(() => {
    const saved = localStorage.getItem('article-pane-sizes')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length === 2) {
          setTimeout(() => {
            setSizes(parsed)
          }, 0)
        }
      } catch {
        // ignore
      }
    }
  }, [])

  const handleChange = (newSizes: number[]) => {
    setSizes(newSizes)
    const timeoutId = setTimeout(() => {
      localStorage.setItem('article-pane-sizes', JSON.stringify(newSizes))
    }, 300)
    return () => clearTimeout(timeoutId)
  }

  return (
    <div className="h-full w-full split-view-container">
      <Allotment
        defaultSizes={sizes}
        onChange={handleChange}
      >
        <Allotment.Pane
          preferredSize={`${defaultSizes[0]}%`}
          minSize={minLeftSize}
          maxSize={maxLeftSize}
          snap
        >
          {leftPane}
        </Allotment.Pane>

        <Allotment.Pane preferredSize={`${defaultSizes[1]}%`}>
          {rightPane}
        </Allotment.Pane>
      </Allotment>
    </div>
  )
}
