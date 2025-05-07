/**
 * Copy given text to the clipboard.
 */
export async function copyText(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}

/**
 * Ask the assistant backend about this text.
 */
export async function askAssistant(text: string): Promise<any> {
  const res = await fetch('/api/assistant/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  return res.json();
}

/**
 * Explore topic: generate concept-map updates from text.
 */
export async function exploreTopic(text: string): Promise<any> {
  const res = await fetch('/api/concept/explore', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  return res.json();
}

/**
 * Create a quiz based on the given text.
 */
export async function createQuiz(text: string): Promise<any> {
  const res = await fetch('/api/quiz/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  return res.json();
}
