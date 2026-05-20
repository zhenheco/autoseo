'use client'

import { useEffect } from 'react'
import Editor from 'react-simple-code-editor'
import Prism from 'prismjs'
import 'prismjs/components/prism-markup'
import 'prismjs/themes/prism-tomorrow.css'

interface HtmlEditorProps {
  value: string
  onChange: (value: string) => void
  readOnly?: boolean
}

export function HtmlEditor({ value, onChange, readOnly = false }: HtmlEditorProps) {
  useEffect(() => {
    Prism.highlightAll()
  }, [value])

  const highlight = (code: string) => {
    return Prism.highlight(code, Prism.languages.markup, 'markup')
  }

  return (
    <div className="border rounded-lg overflow-hidden bg-[#1e1e1e]">
      <Editor
        value={value}
        onValueChange={onChange}
        highlight={highlight}
        padding={16}
        disabled={readOnly}
        className="font-mono text-sm min-h-[500px] focus:outline-none"
        style={{
          backgroundColor: '#1e1e1e',
          color: '#d4d4d4',
        }}
        textareaClassName="focus:outline-none"
      />
    </div>
  )
}
