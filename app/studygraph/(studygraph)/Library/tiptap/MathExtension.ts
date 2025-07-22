// app/Library/tiptap/MathExtension.ts

import { MathExtension as BaseMath } from '@aarkue/tiptap-math-extension'

/**
 * MathExtension
 * - Configures KaTeX delimiters for both inline \(...\) and block \[...\] math.
 * - Uses 'bracket' delimiters to avoid conflicts with dollar signs in currency.
 */
export const MathExtension = BaseMath.configure({
  delimiters: 'bracket',
  renderTextMode: 'raw-latex',
})
