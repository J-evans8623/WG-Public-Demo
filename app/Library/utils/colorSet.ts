// colorSet.ts

/**
 * Simple color palette for StudyGraph file categories.
 * Returns hex color strings for file categorization.
 */

const colors = [
  '#C8E6C9', // sage green
  '#FFE0B2', // peach cream  
  '#BBDEFB', // powder blue
  '#E1BEE7', // lavender
  '#FFCDD2', // coral pink
  '#B2DFDB', // eucalyptus
  '#B2EBF2', // seafoam
  '#DCEDC1', // moss
  '#C5E1A5', // jade
  '#D4EDD5', // spring leaf
  '#E8F5E8', // bamboo
  '#D1E7DD', // sage gray
  '#B3E5FC', // sky mist
  '#E1F5FE', // ice blue
  '#CFD8DC', // steel blue
  '#C5CAE9', // periwinkle
  '#E8EAF6', // glacier
  '#F3E5F5', // arctic
  '#D7CCC8', // denim wash
  '#F3E5F5', // thistle
  '#E8EAF6', // plum haze
  '#EDE7F6', // amethyst
  '#F5F5F5', // orchid gray
  '#FFCCBC', // apricot
  '#EFEBE9', // sandstone
  '#FFF3E0', // papaya
  '#FFE4E1', // sunset
  '#FFF8E1', // amber cream
  '#FFF9C4', // cream yellow
  '#FFFDE7', // butter
  '#F5F5DC', // champagne
  '#FFFEF7', // vanilla
  '#FFFACD', // lemon chiffon
  '#F8BBD9', // rose quartz
  '#FCE4EC', // blush
  '#FFEAA7', // pearl pink
  '#ECEFF1', // dove gray
  '#FAFAFA', // pearl gray
  '#E8E8E8', // ash
  '#FDF5E6', // parchment
  '#F5DEB3'  // wheat
];

/**
 * Returns a random hex color string from the palette
 */
export function getRandomColor(): string {
  return colors[Math.floor(Math.random() * colors.length)];
}

/**
 * Returns a specific color by index
 */
export function selectColor(index: number): string {
  return colors[index % colors.length];
}

/**
 * Returns the complete list of available colors
 */
export function getColorList(): string[] {
  return [...colors];
}