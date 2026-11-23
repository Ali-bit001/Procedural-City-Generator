/**
 * The whole city renders with these 6 materials (one draw call each per chunk).
 */
import * as THREE from 'three';
import type { BucketName } from '../buildings/mesher/MeshBuilder';
import { createFacadeMaterials } from './windowMaterial';

export interface CityMaterials {
  materials: Record<BucketName, THREE.Material>;
  /** Shadow-pass overrides (cut-out fences need their gaps in the shadow too). */
  depthMaterials: Partial<Record<BucketName, THREE.Material>>;
  setNight(on: boolean): void;
}

export function createCityMaterials(): CityMaterials {
  const night = { value: 0 };
  const facade = createFacadeMaterials(night);
  // Lamps glow in their own vertex colour (warm street lights, red aviation lights, green helipad lights).
  const lamp = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, emissive: '#ffffff', emissiveIntensity: 0 });
  lamp.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= vColor.rgb;',
    );
  };
  lamp.customProgramCacheKey = () => 'lamp-vertex-emissive';
  const materials: Record<BucketName, THREE.Material> = {
    solid: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0, side: THREE.DoubleSide }),
    window: facade.window,
    cutout: facade.cutout,
    glass: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.08, metalness: 0.5, envMapIntensity: 1.6 }),
    water: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.05, metalness: 0.1, envMapIntensity: 1.4 }),
    lamp,
  };
  return {
    materials,
    depthMaterials: { cutout: facade.cutoutDepth },
    setNight(on: boolean) {
      night.value = on ? 1.0 : 0;
      lamp.emissiveIntensity = on ? 3 : 0;
    },
  };
}
