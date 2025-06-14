/**
 * Context-aware LaTeX preprocessor that only fixes LaTeX within mathematical contexts
 */

// Mathematical LaTeX commands that are unlikely to appear as regular English words
const SAFE_LATEX_COMMANDS = [
  // Fractions and mathematical functions (these are very unlikely to be English words)
  'frac', 'dfrac', 'tfrac', 'cfrac', 'sqrt', 'binom',
  
  // Mathematical operators that don't conflict with English
  'cdot', 'times', 'oplus', 'ominus', 'otimes', 'oslash', 'odot',
  'bigoplus', 'bigotimes', 'bigodot', 'biguplus', 'bigsqcup',
  
  // Size modifiers (very unlikely to be English)
  'big', 'Big', 'bigg', 'Bigg',
  
  // Mathematical environments
  'pmatrix', 'bmatrix', 'vmatrix', 'Vmatrix',
  
  // Specific mathematical symbols
  'nabla', 'partial', 'infty', 'emptyset', 'varnothing',
  
  // Greek letters that are clearly mathematical (less common in English)
  'Gamma', 'Delta', 'Theta', 'Lambda', 'Xi', 'Pi', 'Sigma', 'Phi', 'Psi', 'Omega',
  'gamma', 'delta', 'theta', 'lambda', 'xi', 'mu', 'nu', 'rho', 'tau', 'phi', 'psi', 'omega'
];

// Words that could be both English and LaTeX - only fix these in mathematical contexts
const AMBIGUOUS_WORDS = [
  'alpha', 'beta', 'sin', 'cos', 'tan', 'log', 'max', 'min', 'sum', 'text',
  'in', 'parallel', 'cap', 'cup', 'star', 'angle', 'top', 'sum', 'exp'
];

/**
 * Detects if content is within a mathematical context
 */
function findMathContexts(content: string): Array<{start: number, end: number, type: 'inline' | 'block'}> {
  const contexts: Array<{start: number, end: number, type: 'inline' | 'block'}> = [];
  
  // Find all mathematical delimiters
  const patterns = [
    { regex: /\$\$([\s\S]*?)\$\$/g, type: 'block' as const },
    { regex: /\\\[([\s\S]*?)\\\]/g, type: 'block' as const },
    { regex: /\$([^$\n]*?)\$/g, type: 'inline' as const },
    { regex: /\\\(([\s\S]*?)\\\)/g, type: 'inline' as const }
  ];
  
  patterns.forEach(pattern => {
    let match;
    while ((match = pattern.regex.exec(content)) !== null) {
      contexts.push({
        start: match.index,
        end: match.index + match[0].length,
        type: pattern.type
      });
    }
  });
  
  // Sort by start position
  return contexts.sort((a, b) => a.start - b.start);
}

/**
 * Checks if a position is within any mathematical context
 */
function isInMathContext(position: number, contexts: Array<{start: number, end: number, type: string}>): boolean {
  return contexts.some(ctx => position >= ctx.start && position <= ctx.end);
}

/**
 * Detects likely mathematical contexts based on surrounding content
 */
function detectMathematicalContext(content: string, position: number, windowSize: number = 100): boolean {
  const start = Math.max(0, position - windowSize);
  const end = Math.min(content.length, position + windowSize);
  const context = content.substring(start, end);
  
  // Look for mathematical indicators
  const mathIndicators = [
    /\b(?:equation|formula|theorem|proof|calculate|solve|derivative|integral)\b/i,
    /[=+\-*/^_{}()[\]]/,
    /\b\d+\.?\d*\b/,  // Numbers
    /\b[a-z]\s*[=<>]/i,  // Variables with operators
    /\\[a-zA-Z]+/,  // Any LaTeX command
    /\$[\s\S]*?\$/,  // Any math delimiters
  ];
  
  return mathIndicators.some(indicator => indicator.test(context));
}

/**
 * Enhanced LaTeX preprocessor with context awareness
 */
export function preprocessLatex(content: string): string {
  if (!content || typeof content !== 'string') {
    return content;
  }

  let processed = content;
  
  // Find all existing mathematical contexts
  const mathContexts = findMathContexts(content);
  
  // Method 1: Always fix safe commands (unlikely to be English words)
  SAFE_LATEX_COMMANDS.forEach(command => {
    const regex = new RegExp(`(?<!\\\\)\\b${command}(?=\\s*[\\{\\[\\s]|$)`, 'g');
    processed = processed.replace(regex, `\\${command}`);
  });

  // Method 2: Fix common broken patterns that are clearly mathematical
  
  // Fix fraction patterns: "rac{a}{b}" -> "\frac{a}{b}" (clearly mathematical)
  processed = processed.replace(/(?<!\\)\brac\s*\{[^}]+\}\s*\{[^}]+\}/g, match => {
    return '\\f' + match;
  });
  
  // Fix text patterns within braces: "ext{something}" -> "\text{something}"
  processed = processed.replace(/(?<!\\)\bext\s*\{[^}]+\}/g, match => {
    return '\\t' + match;
  });

  // Method 3: Context-aware fixing for ambiguous words
  AMBIGUOUS_WORDS.forEach(word => {
    const regex = new RegExp(`(?<!\\\\)\\b${word}(?=\\s*[\\{\\[\\s]|$)`, 'g');
    let match;
    
    // Create a new regex for finding matches (since we need to reset lastIndex)
    const findRegex = new RegExp(regex.source, regex.flags);
    
    while ((match = findRegex.exec(processed)) !== null) {
      const matchPosition = match.index;
      
      // Check if this match is in a mathematical context
      const inExistingMathContext = isInMathContext(matchPosition, mathContexts);
      const inProbableMathContext = detectMathematicalContext(processed, matchPosition);
      
      if (inExistingMathContext || inProbableMathContext) {
        // Replace this specific occurrence
        const before = processed.substring(0, match.index);
        const after = processed.substring(match.index + match[0].length);
        processed = before + '\\' + match[0] + after;
        
        // Adjust the regex lastIndex since we modified the string
        findRegex.lastIndex = match.index + match[0].length + 1;
      }
    }
  });

  // Method 4: Fix environment commands (these are almost always mathematical)
  processed = processed.replace(/(?<!\\)\bbegin\s*\{(matrix|pmatrix|bmatrix|vmatrix|Vmatrix|cases|align|equation|split|gather|multline)\}/g, 
    '\\begin{$1}');
  processed = processed.replace(/(?<!\\)\bend\s*\{(matrix|pmatrix|bmatrix|vmatrix|Vmatrix|cases|align|equation|split|gather|multline)\}/g, 
    '\\end{$1}');

  return processed;
}

/**
 * Alternative approach: Only preprocess content that's explicitly marked as mathematical
 */
export function preprocessMathOnly(content: string): string {
  if (!content || typeof content !== 'string') {
    return content;
  }

  let processed = content;
  const mathContexts = findMathContexts(content);
  
  // Only process content within mathematical delimiters
  mathContexts.forEach(context => {
    const mathContent = content.substring(context.start, context.end);
    let fixedMathContent = mathContent;
    
    // Apply aggressive fixing only within math contexts
    [...SAFE_LATEX_COMMANDS, ...AMBIGUOUS_WORDS].forEach(command => {
      const regex = new RegExp(`(?<!\\\\)\\b${command}(?=\\s*[\\{\\[\\s]|$)`, 'g');
      fixedMathContent = fixedMathContent.replace(regex, `\\${command}`);
    });
    
    // Replace the original math content with fixed version
    processed = processed.substring(0, context.start) + 
                fixedMathContent + 
                processed.substring(context.end);
  });
  
  return processed;
}

/**
 * Enhanced SafeContent component with intelligent preprocessing
 */
import React, { useEffect, useRef } from 'react';
import DOMPurify from 'dompurify';
import 'katex/dist/katex.min.css';
import renderMathInElement from 'katex/contrib/auto-render';

DOMPurify.setConfig({ ADD_ATTR: ['class'] });

interface SafeContentProps {
  html: string;
  className?: string;
  // New prop to control preprocessing strategy
  preprocessingMode?: 'contextAware' | 'mathOnly' | 'safe';
}

const SafeContent: React.FC<SafeContentProps> = ({ 
  html, 
  className, 
  preprocessingMode = 'contextAware' 
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Choose preprocessing strategy based on prop
  const getPreprocessedHtml = () => {
    switch (preprocessingMode) {
      case 'mathOnly':
        return preprocessMathOnly(html);
      case 'safe':
        // Only fix clearly mathematical commands
        return SAFE_LATEX_COMMANDS.reduce((content, command) => {
          const regex = new RegExp(`(?<!\\\\)\\b${command}(?=\\s*[\\{\\[\\s]|$)`, 'g');
          return content.replace(regex, `\\${command}`);
        }, html);
      case 'contextAware':
      default:
        return preprocessLatex(html);
    }
  };
  
  const preprocessedHtml = getPreprocessedHtml();
  const sanitized = DOMPurify.sanitize(preprocessedHtml);

  useEffect(() => {
    if (!containerRef.current) return;

    // Inject the clean HTML
    containerRef.current.innerHTML = sanitized;

    // Run KaTeX with error handling
    try {
      renderMathInElement(containerRef.current, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$', right: '$', display: false },
          { left: '\\(', right: '\\)', display: false },
          { left: '\\[', right: '\\]', display: true }
        ],
        throwOnError: false,
        errorColor: '#cc0000',
        ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code']
      });
    } catch (error) {
      console.warn('KaTeX rendering failed:', error);
    }
  }, [sanitized]);

  return <div ref={containerRef} className={className} />;
};

export default SafeContent;