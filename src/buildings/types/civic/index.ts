/**
 * Civic grammar: health, education, public buildings, parks and municipal services.
 * Each form has its own generator (sharing the Site toolkit) and a recommended lot size.
 */
import { RNG } from '../../../core/rng';
import { DEFAULT_DETAILS, type DetailOptions, type HouseModel } from '../../spec';
import { Site } from './site';
import { clinic, hospital } from './health';
import { highSchool, primarySchool, university } from './education';
import { busStand, fireStation, parkingGarage, policeStation, stadium, trainStation } from './public';
import { collectionPoint, utility, wasteYard } from './parks';
import { park, zoo } from './landscape';

export type CivicForm =
  | 'hospital' | 'clinic'
  | 'primarySchool' | 'highSchool' | 'university'
  | 'stadium' | 'trainStation' | 'busStand' | 'parkingGarage' | 'fireStation' | 'policeStation'
  | 'park' | 'zoo' | 'wasteYard' | 'collectionPoint' | 'utility';

export const CIVIC_FORMS: CivicForm[] = [
  'hospital', 'clinic', 'primarySchool', 'highSchool', 'university', 'stadium', 'trainStation', 'busStand',
  'parkingGarage', 'fireStation', 'policeStation', 'park', 'zoo', 'wasteYard', 'collectionPoint', 'utility',
];

/** Lot size ranges per form: [wMin, wMax, dMin, dMax]. */
export const CIVIC_LOTS: Record<CivicForm, [number, number, number, number]> = {
  hospital: [96, 118, 86, 100],
  clinic: [26, 36, 30, 38],
  primarySchool: [62, 80, 56, 70],
  highSchool: [120, 134, 118, 128],
  university: [192, 210, 190, 200],
  stadium: [166, 184, 142, 154],
  trainStation: [130, 160, 72, 88],
  busStand: [50, 70, 44, 56],
  parkingGarage: [40, 58, 40, 54],
  fireStation: [34, 46, 40, 50],
  policeStation: [34, 46, 38, 48],
  park: [60, 110, 52, 92],
  zoo: [150, 190, 135, 165],
  wasteYard: [90, 118, 80, 98],
  collectionPoint: [16, 24, 14, 20],
  utility: [42, 56, 40, 54],
};

/** Relative frequency when a civic form is picked at random (small neighbourhood things are common). */
export const CIVIC_WEIGHTS: Record<CivicForm, number> = {
  hospital: 6, clinic: 12, primarySchool: 10, highSchool: 6, university: 3, stadium: 3, trainStation: 3, busStand: 6,
  parkingGarage: 8, fireStation: 7, policeStation: 7, park: 12, zoo: 2, wasteYard: 3, collectionPoint: 9, utility: 5,
};

export function pickCivicForm(rng: RNG, among: CivicForm[] = CIVIC_FORMS): CivicForm {
  return rng.weighted(among.map((f) => [f, CIVIC_WEIGHTS[f]] as const));
}

export function civicLotSize(rng: RNG, form: CivicForm): { w: number; d: number } {
  const [w0, w1, d0, d1] = CIVIC_LOTS[form];
  return { w: rng.range(w0, w1), d: rng.range(d0, d1) };
}

export interface CivicSpec {
  seed: number;
  lotWidth: number;
  lotDepth: number;
  form: CivicForm;
  details?: DetailOptions;
}

const GENERATORS: Record<CivicForm, (s: Site) => void> = {
  hospital, clinic, primarySchool, highSchool, university, stadium, trainStation, busStand,
  parkingGarage, fireStation, policeStation, park, zoo, wasteYard, collectionPoint, utility,
};

export function generateCivic(spec: CivicSpec): HouseModel {
  const rng = new RNG(spec.seed);
  const site = new Site(rng, spec.lotWidth, spec.lotDepth, spec.details ?? DEFAULT_DETAILS, spec.seed, spec.form);
  GENERATORS[spec.form](site);
  return site.model(`civic:${spec.form}`);
}
