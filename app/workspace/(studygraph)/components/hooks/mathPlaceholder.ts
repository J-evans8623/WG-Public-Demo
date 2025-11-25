// app/Library/utils/mathPlaceholder.ts

/**
 * mathPlaceholder.ts
 *
 * Responsibilities:
 *  - Scans a text string for all LaTeX math expressions (inline and block,
 *    including both raw `\(...\)` and escaped `\\(...\\)` forms).
 *  - Replaces each found expression with a unique placeholder token.
 *  - Exports `extractMath` to perform the extraction and produce a mapping,
 *    and `restoreMath` to re-insert the original fragments after markdown render.
 */

let _counter = 0;

/**
 * extractMath
 *  - Finds math segments in `text`, replaces them with placeholders, and
 *    returns the stripped text plus a map of placeholder → original fragment.
 */
export function extractMath(text: string): {
  stripped: string;
  map: Record<string, string>;
} {
  const map: Record<string, string> = {};
  let stripped = text;

  // Define regexes for all four delimiter styles
const patterns = [
  /\\\\\[\s*([\s\S]+?)\s*\\\\\]/g, // \\[ … \\]
  /\\\[\s*([\s\S]+?)\s*\\\]/g,     // \[ … \]
  /\\\\\(\s*([\s\S]+?)\s*\\\\\)/g, // \\( … \\)
  /\\\(\s*([\s\S]+?)\s*\\\)/g      // \( … \)
];



  for (const regex of patterns) {
    stripped = stripped.replace(regex, (_match, content) => {
      const key = `@@MATH_${_counter++}@@`;
      map[key] = _match;
      return key;
    });
  }

  return { stripped, map };
}

/**
 * restoreMath
 *  - Walks through `html` and replaces each placeholder token with its
 *    original LaTeX fragment from `map`.
 */
export function restoreMath(
  html: string,
  map: Record<string, string>
): string {
  let restored = html;
  for (const [placeholder, original] of Object.entries(map)) {
    restored = restored.split(placeholder).join(original);
  }
  return restored;
}
