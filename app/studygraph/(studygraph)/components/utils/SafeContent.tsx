/**
 * SafeContent.tsx
 *
 * Responsibilities
 * ────────────────
 * 1)  Sanitize incoming HTML via DOMPurify.
 * 2)  Run KaTeX auto-render on the sanitized DOM.
 * 3)  Attach click-handlers to any
 *     <sup class="citation" data-cite="n">…</sup> elements.
 */

import React, { useEffect, useRef } from 'react'
import DOMPurify from 'dompurify'
import 'katex/dist/katex.min.css'
import renderMathInElement from 'katex/contrib/auto-render'

/* ------------------------------------------------------------------ */
/*  Allow our citation markup to pass through the purifier             */
/* ------------------------------------------------------------------ */
DOMPurify.setConfig({
  ADD_TAGS : ['sup'],                       // <sup> is already allowed, but explicit
  ADD_ATTR : ['class', 'data-cite'],        // keep the citation attributes
})

interface SafeContentProps {
  html: string
  className?: string
  onCitationClick?: (index: number) => void
}

const SafeContent: React.FC<SafeContentProps> = ({
  html,
  className,
  onCitationClick,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)

  /* Sanitize once, memoised by input string */
  const sanitized = React.useMemo(() => DOMPurify.sanitize(html), [html])

  useEffect(() => {
    if (!containerRef.current) return

    /* 1) Inject HTML */
    containerRef.current.innerHTML = sanitized

    /* 2) Render KaTeX */
    renderMathInElement(containerRef.current, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '$',  right: '$',  display: false },
      ],
      throwOnError: false,
    })

    /* 3) Wire citation clicks */
    const nodes = Array.from(
      containerRef.current.querySelectorAll<HTMLElement>('sup.citation')
    )

    const listeners: Array<() => void> = []

    nodes.forEach(el => {
      const handler = (e: MouseEvent) => {
        e.preventDefault()
        const raw = el.getAttribute('data-cite') ?? ''
        const idx  = parseInt(raw, 10)
        if (!isNaN(idx) && onCitationClick) {
          onCitationClick(idx)
        }
      }
      el.addEventListener('click', handler)
      listeners.push(() => el.removeEventListener('click', handler))
    })

    /* Cleanup on unmount / re-render */
    return () => listeners.forEach(fn => fn())
  }, [sanitized, onCitationClick])

  return <div ref={containerRef} className={className} />
}

export default SafeContent
