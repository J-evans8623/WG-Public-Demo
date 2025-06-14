/**
 * @file models/TextKeys.ts
 * @description
 *   Provides a branded Key2 type and a generator function for two-character (and longer) identifiers.
 *   Ensures unique, stable keys for hierarchical nodes.
 */

/**
 * Key2
 * A branded string type representing a two-character (or longer) uppercase identifier.
 */
export type Key2 = string & { readonly __brand: 'Key2' };

/**
 * nextKey2
 * Generates the Excel-style column identifier for the given zero-based index.
 *   0 -> "A", 25 -> "Z", 26 -> "AA", 27 -> "AB", …
 *
 * @param index Zero-based index
 * @returns A Key2 string
 */
export function nextKey2(index: number): Key2 {
  if (index < 0) {
    throw new Error(`nextKey2: index must be non-negative, got ${index}`);
  }
  let n = index + 1; // switch to 1-based for Excel logic
  let result = '';
  while (n > 0) {
    n--; // adjust because Excel columns are 1-based
    const charCode = (n % 26) + 65; // ASCII 'A' = 65
    result = String.fromCharCode(charCode) + result;
    n = Math.floor(n / 26);
  }
  return result as Key2;
}
