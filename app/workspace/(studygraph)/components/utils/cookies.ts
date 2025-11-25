// utils/cookies.ts
/**
 * @file utils/cookies.ts
 * @responsibility
 *   • Expose getCookie(name) to read cookie values in both browser and server contexts.
 */

export function getCookie(name: string, cookieHeader?: string): string | null {
  // Browser context: use document.cookie
  const source = cookieHeader ?? (typeof document !== 'undefined' ? document.cookie : '');
  console.log('utils/cookies.ts 1001 › getCookie source=', source);
  if (!source) return null;

  const match = source.match(new RegExp('(?:^|; )' + name.replace(/([$?*|{}()[\]\\/+^])/g, '\\$1') + '=([^;]*)'));
  const value = match ? decodeURIComponent(match[1]) : null;
  console.log(`utils/cookies.ts 1002 › getCookie(${name})=`, value);
  return value;
}
