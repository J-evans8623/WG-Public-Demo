// colorSet.ts

/**
 * Simple color palette for StudyGraph file categories.
 * Returns hex color strings for file categorization.
 */

const NOTEBOOK_COLORS = [
  '#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444',
  '#06B6D4', '#84CC16', '#F97316', '#EC4899', '#6366F1',
  '#0EA5E9', // Sky
  '#22C55E', // Green
  '#EAB308', // Yellow
  '#14B8A6', // Teal
  '#D946EF', // Fuchsia
  '#A855F7', // Purple
  '#F43F5E', // Rose
  '#3ABFF8', // Electric Sky
  '#06D6A0', // Mint
  '#FFB703', // Saffron
];

/**
 * Returns a random hex color string from the palette
 */
export function getRandomColor(): string {
  return NOTEBOOK_COLORS[Math.floor(Math.random() * NOTEBOOK_COLORS.length)];
}

/**
 * Returns a specific color by index
 */
export function selectColor(index: number): string {
  return NOTEBOOK_COLORS[index % NOTEBOOK_COLORS.length];
}

/**
 * Returns the complete list of available NOTEBOOK_COLORS
 */
export function getColorList(): string[] {
  return [...NOTEBOOK_COLORS];
}