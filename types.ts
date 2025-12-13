export enum PlateShape {
  ROUND = 'round',
  SQUARE = 'square',
  RECTANGULAR = 'rectangular'
}

export interface PlateConfig {
  shape: PlateShape;
  textureUrl: string | null;
}

export const PLACEHOLDER_TEXTURE = "https://picsum.photos/600/600";
// Navy Blue Signature (Marmara TABLEWARE) on transparent background
export const SIGNATURE_TEXTURE_URL = "https://placehold.co/512x256/png?text=marmara%0ATABLEWARE&font=playfair&color=001f3f"; 
// Texture for the "Stucco/Granular" gold effect
export const NOISE_TEXTURE_URL = "https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/disturb.jpg";