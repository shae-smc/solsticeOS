import { describe, expect, it } from 'vitest'
import { describeRoute, HAZARD_TYPES, HAZARDS } from './hazards'

describe('hazard taxonomy', () => {
  it('covers every hazard class with a route', () => {
    expect(HAZARD_TYPES).toHaveLength(15)
    for (const type of HAZARD_TYPES) expect(HAZARDS[type].route.length, type).toBeGreaterThan(0)
  })

  it('describes routes the way the module table reads', () => {
    expect(describeRoute(HAZARDS.FRAGMENTATION)).toBe('M1 → M5 → M3')
    expect(describeRoute(HAZARDS.RPO_APPROACH)).toBe("M6, using M3's relative positions")
    expect(describeRoute(HAZARDS.CONFLICTING_MANEUVERS)).toBe('M8, using M3')
  })
})
