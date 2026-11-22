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

export type RowStyle = 'brownstone' | 'terrace' | 'modernTown';

export interface RowPalette {
  walls: string[];
  roofs: string[];
  trims: string[];
  doors: string[];
  cornices: string[];
  paving: string[];
}

export const ROW_PALETTES: Record<RowStyle, RowPalette> = {
  // New York style brownstones: brown/red stone, stone trims, heavy cornices.
  brownstone: {
    walls: ['#7a4a3a', '#8b5a44', '#6e3f33', '#9a6a52', '#a0522d', '#7d5a4a', '#b07a5a', '#8a4a3a'],
    roofs: ['#4a4a4a', '#555555'],
    trims: ['#e9e2cf', '#d8cfb8', '#cbbfa5'],
    doors: ['#3a2a20', '#1f2a33', '#5c1f1f', '#2f3b2f', '#6b4a33'],
    cornices: ['#3b3632', '#5a4a3f', '#e9e2cf', '#2f2b28'],
    paving: ['#a9a49a', '#b3aca0'],
  },
  // British / European terraces: pastel render, white trims, slate roofs.
  terrace: {
    walls: ['#f2e6c9', '#d7e3e8', '#f0d4c8', '#e8e1d1', '#cfe0c8', '#f5f1e6', '#e7c9c1', '#c9d8e6', '#f3dfa2', '#e9d0e3'],
    roofs: ['#4a4f59', '#55595e', '#5c3b2f'],
    trims: ['#ffffff', '#f7f4ec'],
    doors: ['#7d2b25', '#2d4b66', '#2f5040', '#232323', '#d4a017', '#6a2f6a', '#1f6b6b'],
    cornices: ['#ffffff'],
    paving: ['#c4beb3', '#b8b2a6'],
  },
  // Contemporary townhouses: mixed cladding, dark frames, flat roofs.
  modernTown: {
    walls: ['#f3f3f1', '#3b3e42', '#b4895e', '#9da0a3', '#d9d5cc', '#2f3236', '#c8b8a2'],
    roofs: ['#4d5054', '#2f3236'],
    trims: ['#26282b', '#3a3d40'],
    doors: ['#b4895e', '#26282b', '#8c6a48'],
    cornices: ['#26282b'],
    paving: ['#d0cdc6', '#a9a6a0'],
  },
};

export type MidriseStyle = 'southAsian' | 'mainStreet' | 'modern';

export interface MidrisePalette {
  walls: string[];
  /** Floor-slab bands, sunshades, balcony slabs, cornices. */
  bands: string[];
  frames: string[];
  signs: string[];
  awnings: string[];
  shutters: string[];
  paving: string[];
  roofs: string[];
}

export const MIDRISE_PALETTES: Record<MidriseStyle, MidrisePalette> = {
  // Commercial "plaza" blocks common across Pakistan / South Asia: painted plaster, slab bands,
  // chajjas, balconies, roller-shutter shops with big signboards, lots of water tanks.
  southAsian: {
    walls: ['#efe8da', '#e8dcc0', '#f2efe6', '#d9cfba', '#cfd8d4', '#e6d3b3', '#d8e2e8', '#f0e0d0', '#c9d3c0', '#e9d6c4'],
    bands: ['#b8462f', '#2f5b8a', '#3f6f4f', '#7a4a2f', '#8a8a8a', '#c9a227', '#ffffff', '#5a5f66'],
    frames: ['#3b3e42', '#6b4a33', '#e9e6df', '#2f5b8a'],
    signs: ['#c0392b', '#1f6fb5', '#27ae60', '#f1c40f', '#ffffff', '#e67e22', '#8e44ad', '#16a085', '#2c3e50'],
    awnings: ['#2e6b4a', '#1f3f73'],
    shutters: ['#9aa0a6', '#8a8f96', '#6f7a83', '#7d8a96'],
    paving: ['#b9b4aa', '#aaa59b'],
    roofs: ['#9a958c', '#8f8b84'],
  },
  // European / US main street: brick, stone trims, cornices, shopfronts with awnings.
  mainStreet: {
    walls: ['#8b4a3a', '#9c5a45', '#7a3f33', '#a86a50', '#b98a6a', '#6f4a3f', '#c2a27f', '#d8c8a8'],
    bands: ['#efe6d2', '#e9e2cf', '#d8cfb8'],
    frames: ['#1f3b2f', '#2b2b2b', '#6a1f1f', '#1f2f4a', '#efe6d2'],
    signs: ['#1f3b2f', '#6a1f1f', '#1f2f4a', '#2b2b2b', '#c9a648'],
    awnings: ['#2e6b4a', '#8e1c1c', '#1f3f73', '#c9772b', '#2b2b2b'],
    shutters: ['#5a5f66'],
    paving: ['#b9b4aa', '#c4beb3'],
    roofs: ['#5a5a58', '#4f4f4d'],
  },
  // Contemporary: panels + glass, ribbon windows or curtain walls, glass balconies.
  modern: {
    walls: ['#e9e9e6', '#d6d6d2', '#3b3e42', '#9da0a3', '#b4895e', '#f3f3f1'],
    bands: ['#3b3e42', '#e9e9e6', '#26282b'],
    frames: ['#26282b', '#9aa0a6'],
    signs: ['#26282b', '#ffffff', '#c0392b', '#1f6fb5'],
    awnings: ['#26282b'],
    shutters: ['#5a5f66'],
    paving: ['#d0cdc6', '#bdbab3'],
    roofs: ['#6b6e72', '#5a5d61'],
  },
};

/** Accent cladding for modern upper volumes (wood, charcoal, white). */
export const MODERN_ACCENTS_DARK = ['#3b3e42', '#b4895e', '#2f3236', '#8c6a48'];
export const MODERN_ACCENTS_LIGHT = ['#f3f3f1', '#d9d5cc', '#b4895e'];

export const TREE_GREENS = ['#5d8a3a', '#4f7d33', '#6e9b45', '#3f6b35', '#7aa34a'];
export const CONIFER_GREENS = ['#2f5a3a', '#3a6440', '#2b4f36'];
export const AUTUMN = ['#c9772b', '#b8492f', '#d9a33a'];
