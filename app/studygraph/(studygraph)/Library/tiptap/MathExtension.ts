// app/Library/tiptap/MathExtension.ts

import { MathExtension as BaseMath } from '@aarkue/tiptap-math-extension'

/**
 * MathExtension
 * - Configures KaTeX delimiters for both inline ($…$) and block ($$…$$) math.
 */
export const MathExtension = BaseMath.configure({
  delimiters: 'dollar',
  renderTextMode: 'raw-latex',
})
