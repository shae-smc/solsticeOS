// Hazard taxonomy: every class of threat Orbital Rakshak screens for, and the modules that
// detect and score it. A route reads left to right, e.g. a fragmentation is first seen as
// unmatched tracks (M1), modelled as a debris cloud (M5) and then screened (M3).
import type { HazardModule, HazardType } from '@/types'

export type HazardGroup = 'Collision' | 'Proximity operations' | 'Debris & population' | 'Space weather' | 'Mission operations'

export interface HazardSpec {
  label: string
  /** Fits a chip: two or three words. */
  short: string
  group: HazardGroup
  /** Modules in the order the hazard flows through them. */
  route: HazardModule[]
  /** What the last module draws on from earlier ones, when it is not the whole output. */
  uses?: string
  description: string
}

export const HAZARDS: Record<HazardType, HazardSpec> = {
  CONJUNCTION: {
    label: 'Conjunction with a tracked object',
    short: 'Conjunction',
    group: 'Collision',
    route: ['M3'],
    description: 'Screened pair whose predicted miss distance and collision probability cross the alert thresholds.',
  },
  CLOSE_APPROACH: {
    label: 'Close approach or flyby',
    short: 'Close approach',
    group: 'Collision',
    route: ['M3'],
    description: 'A pass inside the screening volume that does not threaten collision but reveals intent or capability.',
  },
  RPO_APPROACH: {
    label: 'Approach (rendezvous and proximity operations)',
    short: 'RPO approach',
    group: 'Proximity operations',
    route: ['M6'],
    uses: "M3's relative positions",
    description: 'An object manoeuvring onto the asset’s orbit to close to a short standoff range.',
  },
  LOITERING: {
    label: 'Loitering',
    short: 'Loitering',
    group: 'Proximity operations',
    route: ['M6'],
    uses: "M3's dwell times",
    description: 'An object holding station near the asset, shadowing it for hours or days.',
  },
  UNANNOUNCED_MANEUVER: {
    label: 'Unannounced manoeuvre',
    short: 'Unannounced burn',
    group: 'Proximity operations',
    route: ['M6'],
    description: 'An orbit change no operator declared, detected as a break in the object’s ephemeris.',
  },
  FRAGMENTATION: {
    label: 'Fragmentation event',
    short: 'Fragmentation',
    group: 'Debris & population',
    route: ['M1', 'M5', 'M3'],
    description: 'Unmatched tracks reveal a break-up; the debris cloud is modelled, then screened against the fleet.',
  },
  NEW_LAUNCH: {
    label: 'New launch or deployment',
    short: 'New launch',
    group: 'Debris & population',
    route: ['M4'],
    description: 'Fresh objects in the asset’s shell before they are catalogued and well tracked.',
  },
  DECAYING_OBJECT: {
    label: 'Decaying object crossing customer altitude',
    short: 'Decaying object',
    group: 'Debris & population',
    route: ['M5', 'M3'],
    description: 'An object spiralling down through the asset’s altitude band, screened as it crosses.',
  },
  SMALL_DEBRIS: {
    label: 'Small untracked debris',
    short: 'Small debris',
    group: 'Debris & population',
    route: ['M5'],
    description: 'Statistical flux of debris too small to track, scored as a background risk.',
  },
  GEOMAGNETIC_STORM: {
    label: 'Geomagnetic storm and drag surge',
    short: 'Geomagnetic storm',
    group: 'Space weather',
    route: ['M5', 'M2', 'M3'],
    description: 'A storm alert raises atmospheric density and orbit uncertainty, triggering a rescreen.',
  },
  SOLAR_RADIATION_STORM: {
    label: 'Solar radiation storm',
    short: 'Radiation storm',
    group: 'Space weather',
    route: ['M5'],
    description: 'Energetic particle event that can upset electronics and degrade sensors.',
  },
  SAA_PASS: {
    label: 'South Atlantic Anomaly passes',
    short: 'SAA pass',
    group: 'Space weather',
    route: ['M5'],
    description: 'Passes through the anomaly’s elevated radiation, planned around for sensitive operations.',
  },
  ORBIT_DECAY_EOL: {
    label: 'Orbit decay and end-of-life',
    short: 'End-of-life',
    group: 'Mission operations',
    route: ['M5', 'M8'],
    description: 'Natural decay of the asset itself, tracked through to disposal and compliance filing.',
  },
  PLAN_DEVIATION: {
    label: 'Customer satellite deviating from plan',
    short: 'Plan deviation',
    group: 'Mission operations',
    route: ['M6'],
    description: 'The asset’s own observed orbit drifting from its planned ephemeris.',
  },
  CONFLICTING_MANEUVERS: {
    label: 'Conflicting manoeuvres',
    short: 'Conflicting burns',
    group: 'Mission operations',
    route: ['M8'],
    uses: 'M3',
    description: 'Two operators planning avoidance burns that would re-create the conjunction.',
  },
}

export const HAZARD_TYPES = Object.keys(HAZARDS) as HazardType[]

/** "M1 → M5 → M3", or "M6, using M3's relative positions". */
export function describeRoute(hazard: HazardSpec): string {
  const route = hazard.route.join(' → ')
  return hazard.uses ? `${route}, using ${hazard.uses}` : route
}
