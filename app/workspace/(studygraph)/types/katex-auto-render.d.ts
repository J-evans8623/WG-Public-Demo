// katex-auto-render.d.ts
declare module 'katex/contrib/auto-render' {
    export default function renderMathInElement(
      element: HTMLElement,
      options?: {
        delimiters?: Array<{ left: string; right: string; display: boolean }>;
        throwOnError?: boolean;
        errorColor?: string;
        ignoredTags?: string[];
        macros?: Record<string, any>;
        preProcess?: (math: string) => string;
        postProcess?: (math: HTMLElement) => void;
      }
    ): void;
  }
  