import React, { useEffect, useRef } from 'react'
import DOMPurify from 'dompurify'
import 'katex/dist/katex.min.css'
import renderMathInElement from 'katex/contrib/auto-render'

DOMPurify.setConfig({ ADD_ATTR: ['class'] })

interface SafeContentProps {
  html: string
  className?: string
}

const SafeContent: React.FC<SafeContentProps> = ({ html, className }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const sanitized = DOMPurify.sanitize(html)

  useEffect(() => {
    if (!containerRef.current) return

    // 1) Inject the clean HTML exactly once per change
    containerRef.current.innerHTML = sanitized

    // 2) Run KaTeX’s auto-renderer on that exact same DOM
    renderMathInElement(containerRef.current, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '$',  right: '$',  display: false },
      ],
      throwOnError: false,
    })
  }, [sanitized])

  return <div ref={containerRef} className={className} />
}

export default SafeContent
