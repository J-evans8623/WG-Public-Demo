/**
 * Copy given text to the clipboard.
 */
export async function copyText(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}
