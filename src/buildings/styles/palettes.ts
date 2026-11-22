/**
 * Style palettes are plain data so the look can be tuned without touching generator code.
 * Each house picks from its style's palette, then jitters slightly.
 */
export type HouseStyle = 'traditional' | 'ranch' | 'modern';

export interface HousePalette {
  walls: string[];
  roofs: string[];
  trims: string[];
  doors: string[];
  shutters: string[];
  garageDoors: string[];
  foundation: string;
  paving: string[];
}

export const HOUSE_PALETTES: Record<HouseStyle, HousePalette> = {
  traditional: {
    walls: ['#efe6d2', '#c9d6df', '#d9c7a8', '#f4f1ea', '#b9c7a6', '#e6bfae', '#cfc8bb', '#a9bfd4', '#e9d9a8'],
    roofs: ['#4a4f59', '#5c3b2f', '#6b6f76', '#3b4a5e', '#744a3a', '#555a4e'],
    trims: ['#ffffff', '#f5f2ea'],
    doors: ['#7d2b25', '#2d4b66', '#2f5040', '#232323', '#8a5a2c', '#b5452f'],
    shutters: ['#2c3a4e', '#45583a', '#1f2a2e', '#6a2f2a', '#ffffff'],
    garageDoors: ['#f3f1ec', '#e6e1d6'],
    foundation: '#8f8a83',
    paving: ['#c4beb3', '#b8b2a6'],
  },
  ranch: {
    walls: ['#d8c6a4', '#c4a585', '#a9654b', '#e8decd', '#b8a58c', '#cfd3c8', '#9c5f47'],
    roofs: ['#5b4a3e', '#6a6a66', '#4c4038', '#7b6a58'],
    trims: ['#f2ede2', '#ffffff', '#6b5a48'],
    doors: ['#5b3a26', '#7d2b25', '#33414d'],
    shutters: ['#5b3a26', '#3f4b3a'],
    garageDoors: ['#ece6da', '#d9d0bf'],
    foundation: '#8a7f72',
    paving: ['#c4beb3', '#bcb4a5'],
  },
  modern: {
    walls: ['#f3f3f1', '#ecebe7', '#3b3e42', '#9da0a3', '#d9d5cc', '#f3f3f1'],
    roofs: ['#4d5054', '#2f3236', '#eeeeec'],
    trims: ['#26282b', '#3a3d40'],
    doors: ['#b4895e', '#26282b', '#8c6a48'],
    shutters: ['#b4895e'],
    garageDoors: ['#3a3d40', '#b4895e', '#d9d9d6'],
    foundation: '#9a9a96',
    paving: ['#d0cdc6', '#a9a6a0'],
  },
};

/** Accent cladding for modern upper volumes (wood, charcoal, white). */
export const MODERN_ACCENTS_DARK = ['#3b3e42', '#b4895e', '#2f3236', '#8c6a48'];
export const MODERN_ACCENTS_LIGHT = ['#f3f3f1', '#d9d5cc', '#b4895e'];

export const TREE_GREENS = ['#5d8a3a', '#4f7d33', '#6e9b45', '#3f6b35', '#7aa34a'];
export const CONIFER_GREENS = ['#2f5a3a', '#3a6440', '#2b4f36'];
export const AUTUMN = ['#c9772b', '#b8492f', '#d9a33a'];
