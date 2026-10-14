// Static globe overlay for the active COLA plan: the manoeuvred ground track between the
// burns, the secondary's approach around TCA, and B1 / B2 / TCA markers. Rebuilt only when
// the plan changes; everything is Earth-fixed, so satellites fly along it as time advances.
// Each point keeps the instant it was sampled at, so an inertial view can re-project it.
import { rsoById } from '@/data'
import { maneuveredElementsAt } from '@/lib/maneuver'
import { earthSpinDeg, geoAt, orbitalPeriodS, type GeoPoint } from '@/lib/orbit'
import type { ConjunctionEvent, InterceptSequence, ManeuverSequence, ManeuverStep, ThreatWindow } from '@/types'

/** A ground point plus the instant the object was there. */
export interface TimedPoint extends GeoPoint {
  atMs: number
}

export interface OverlayPath {
  id: string
  points: GeoPoint[]
  /** When present, each point's instant: the path then follows an inertial view. */
  times?: number[]
  color: string
  stroke: number
  dash: number
  gap: number
}

export interface OverlayMarker {
  id: string
  el: HTMLElement
  lat: number
  lng: number
  alt: number
  /** Earth-fixed longitude and instant of a timed marker, for inertial re-projection. */
  at?: { lng: number; ms: number }
}

/**
 * Longitude, at `displayMs`, of the point in space an object occupied at `atMs` above `lng`:
 * the Earth has turned underneath it in between.
 */
export const inertialLng = (lng: number, atMs: number, displayMs: number) => lng + earthSpinDeg(displayMs, atMs)

/** A path's points re-projected for an inertial view; untimed paths are returned as-is. */
export function inertialPath(path: OverlayPath, displayMs: number): OverlayPath {
  const { times } = path
  if (!times) return path
  return { ...path, points: path.points.map((p, i) => ({ ...p, lng: inertialLng(p.lng, times[i]!, displayMs) })) }
}

const APPROACH_WINDOW_MS = 12 * 60_000

function sample(from: number, to: number, count: number, at: (t: number) => GeoPoint): Pick<OverlayPath, 'points' | 'times'> {
  const times = Array.from({ length: count + 1 }, (_, i) => from + ((to - from) * i) / count)
  return { points: times.map(at), times }
}

const timed = (at: (t: number) => GeoPoint) => (t: number): TimedPoint => ({ ...at(t), atMs: t })

function markerElement(text: string, color: string) {
  const el = document.createElement('div')
  el.className =
    'pointer-events-none -translate-y-4 whitespace-nowrap rounded border px-1.5 py-px font-mono text-[10px] font-semibold tabular-nums backdrop-blur-sm'
  el.style.color = color
  el.style.borderColor = color
  el.style.background = 'rgba(0,0,0,0.7)'
  el.textContent = text
  return el
}

export function buildPlanOverlay(
  event: ConjunctionEvent,
  sequence: ManeuverSequence,
  severityHex: string,
  toAlt: (altKm: number) => number,
): { paths: OverlayPath[]; markers: OverlayMarker[] } {
  const primary = rsoById.get(event.primaryId)!.elements
  const secondary = rsoById.get(event.secondaryId)!.elements
  const primaryAt = (t: number) => geoAt(maneuveredElementsAt(primary, sequence, t), t)
  const tca = Date.parse(event.tca)
  const [, burn1, , burn2] = sequence.steps
  const b1 = Date.parse(burn1.start)
  const b2 = Date.parse(burn2.start)

  const paths: OverlayPath[] = [
    {
      id: 'plan-arc',
      // Early burns are revolutions before TCA; draw only the final approach through Burn 2
      // so the arc does not wrap the globe several times.
      ...sample(Math.max(b1, tca - (orbitalPeriodS(primary.smaKm) * 1000) / 2), Date.parse(burn2.end), 240, primaryAt),
      color: '#5b9bd1',
      stroke: 0.6,
      dash: 1,
      gap: 0,
    },
    {
      id: 'secondary-approach',
      ...sample(tca - APPROACH_WINDOW_MS, tca + APPROACH_WINDOW_MS, 60, (t) => geoAt(secondary, t)),
      color: severityHex,
      stroke: 0.5,
      dash: 0.02,
      gap: 0.01,
    },
  ]

  const marker = (id: string, text: string, color: string, point: TimedPoint): OverlayMarker => ({
    id,
    el: markerElement(text, color),
    lat: point.lat,
    lng: point.lng,
    alt: toAlt(point.altKm),
    at: { lng: point.lng, ms: point.atMs },
  })

  const markers = [
    marker('b1', `B1 +${burn1.deltaVMps.toFixed(2)} m/s`, '#d97a3f', timed(primaryAt)(b1)),
    marker('b2', `B2 −${burn2.deltaVMps.toFixed(2)} m/s`, '#d97a3f', timed(primaryAt)(b2)),
    marker('tca', 'TCA', severityHex, timed((t) => geoAt(secondary, t))(tca)),
  ]
  return { paths, markers }
}

const signed = (step: ManeuverStep) => `${Math.sign(step.direction?.inTrack ?? 1) < 0 ? '−' : '+'}${step.deltaVMps.toFixed(2)} m/s`

/**
 * Overlay for an intercept: the chaser's final revolution into Burn 2 in the rating colour,
 * plus B1 / B2 markers and the arrival point on the target. Burn 1 is usually many
 * revolutions earlier, so only its marker is drawn, not the whole phasing arc.
 */
export function buildInterceptOverlay(
  window: ThreatWindow,
  sequence: InterceptSequence,
  ratingHex: string,
  toAlt: (altKm: number) => number,
): { paths: OverlayPath[]; markers: OverlayMarker[] } {
  const chaser = rsoById.get(window.opposedId)!.elements
  const target = rsoById.get(window.targetId)!.elements
  const chaserAt = (t: number) => geoAt(maneuveredElementsAt(chaser, sequence, t), t)
  const [, burn1, , burn2] = sequence.steps
  const b1 = Date.parse(burn1.start)
  const b2 = Date.parse(burn2.start)
  const arrival = Date.parse(burn2.end)
  const periodMs = orbitalPeriodS(chaser.smaKm) * 1000

  const paths: OverlayPath[] = [
    {
      id: 'intercept-approach',
      ...sample(Math.max(b1, b2 - periodMs), arrival, 240, chaserAt),
      color: ratingHex,
      stroke: 0.6,
      dash: 0.02,
      gap: 0.008,
    },
  ]
  const marker = (id: string, text: string, color: string, point: TimedPoint): OverlayMarker => ({
    id,
    el: markerElement(text, color),
    lat: point.lat,
    lng: point.lng,
    alt: toAlt(point.altKm),
    at: { lng: point.lng, ms: point.atMs },
  })
  return {
    paths,
    markers: [
      marker('b1', `B1 ${signed(burn1)}`, '#d97a3f', timed(chaserAt)(b1)),
      marker('b2', `B2 ${signed(burn2)}`, '#d97a3f', timed(chaserAt)(b2)),
      marker('arrival', `ARRIVAL · ${sequence.standoffKm.toFixed(1)} km`, ratingHex, timed((t) => geoAt(target, t))(arrival)),
    ],
  }
}
