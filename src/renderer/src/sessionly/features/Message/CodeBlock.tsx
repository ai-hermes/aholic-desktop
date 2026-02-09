import { useEffect, useRef } from 'react'
import hljs from 'highlight.js/lib/common'
import 'highlight.js/styles/github-dark.css'

interface CodeBlockProps {
  code: string
  language?: string
}

export function CodeBlock({ code, language }: CodeBlockProps) {
  const ref = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (ref.current) {
      hljs.highlightElement(ref.current)
    }
  }, [code, language])

  const langClass = language ? `language-${language}` : ''

  return (
    <pre className="rounded-md bg-[#0b0b0b] border border-border overflow-auto text-xs">
      <code ref={ref} className={langClass}>
        {code}
      </code>
    </pre>
  )
}
