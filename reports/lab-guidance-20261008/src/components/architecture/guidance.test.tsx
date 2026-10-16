import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { LabLanguageContext } from '../../i18n/LabLanguage'
import { ArchitectureControls } from './ArchitectureControls'
import { defaultArchitectureSettings, normalizeArchitectureSettings, parseArchitecturePreset, serializeArchitecturePreset } from './architectureSettings'
import { defaultGuidanceSettings as defaults, guidanceDuration, guidancePhase, guidanceStages, guidanceTimeAtPhase, normalizeGuidanceSettings } from './guidanceSettings'
import { guidanceApproach, guidanceBranchIndex, guidanceFrame, guidancePointOnRoute } from './guidanceGeometry'
import { exportArchitectureComponent } from './architectureExport'

describe('guidance junction choreography', () => {
  it('starts without light, pauses at the same node, then reaches the selected endpoint', () => {
    expect(guidanceFrame(0, defaults).power).toBe(0)
    expect(guidanceFrame(0, defaults).guidePower).toBe(0)
    expect(guidanceFrame(.28, defaults).guidePower).toBe(0)
    for (const branch of ['upper', 'middle', 'lower'] as const) {
      const s = { ...defaults, branch }
      for (const t of [.33, .42, .539999, .54]) expect(guidanceFrame(t, s).position).toEqual([151, 86])
      const final = guidanceFrame(.84, s)
      expect(final.position).toEqual(final.routes[final.branch].at(-1))
      expect(guidanceFrame(.89, s).position).toEqual(final.position)
    }
  })
  it('follows every bend by arc length with no snap toward the platform centers', () => {
    for (const progress of [0, .05, .17, .4, .67, .91, 1]) {
      const p = guidancePointOnRoute(guidanceApproach, progress)
      const distances = guidanceApproach.slice(1).map((b, i) => {
        const a = guidanceApproach[i], dx = b[0] - a[0], dy = b[1] - a[1]
        const u = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)))
        return Math.hypot(p[0] - a[0] - u * dx, p[1] - a[1] - u * dy)
      })
      expect(Math.min(...distances)).toBeLessThan(1e-10)
    }
  })
  it('retimes each stage without changing event order or jumping across boundaries', () => {
    for (const times of [[.5, .5, .5, .5], [20, 15, 20, 15], [3, 6, 2, 8]]) {
      const s = { ...defaults, ...Object.fromEntries(guidanceStages.map((stage, i) => [stage.key, times[i]])) }
      expect(guidanceDuration(s)).toBe(times.reduce((a, b) => a + b, 0))
      for (const phase of [.001, .12, .33, .42, .54, .7, .84, .89, .95]) {
        expect(guidancePhase(guidanceTimeAtPhase(phase, s), s)).toBeCloseTo(phase, 8)
      }
      for (const stage of guidanceStages.slice(1)) {
        const time = guidanceTimeAtPhase(stage.start, s)
        expect(guidancePhase(time - 1e-7, s)).toBeCloseTo(stage.start, 6)
        expect(guidancePhase(time + 1e-7, s)).toBeCloseTo(stage.start, 6)
      }
    }
    expect(guidancePhase(1e5, defaults, false)).toBe(.89)
    expect(guidancePhase(guidanceDuration(defaults), defaults)).toBe(0)
  })
  it('alternates only between complete cycles in a stable order', () => {
    expect([0, 1, 2, 3, 4, 5].map(cycle => guidanceBranchIndex({ ...defaults, branch: 'alternate' }, cycle))).toEqual([1, 0, 2, 1, 0, 2])
  })
  it('preserves nested settings in presets and adds safe defaults to legacy presets', () => {
    const settings = { ...defaultArchitectureSettings, illustration: 'guidance' as const, guidance: { ...defaults, mode: 'beam' as const, branch: 'lower' as const, guideBrightness: 1.65, hintDuration: 5.7, connection: false } }
    expect(parseArchitecturePreset(serializeArchitecturePreset(settings))).toEqual(settings)
    expect(normalizeArchitectureSettings({ illustration: 'cell', cycle: 13 }).guidance).toEqual(defaults)
    const s = normalizeGuidanceSettings({ guideBrightness: 50, hintDuration: 0, stroke: NaN, spread: '1.3', guideColor: '<svg>', mode: 'bad', repeat: false })
    expect(s.guideBrightness).toBe(3); expect(s.hintDuration).toBe(.5); expect(s.stroke).toBe(defaults.stroke)
    expect(s.spread).toBe(defaults.spread); expect(s.guideColor).toBe(defaults.guideColor); expect(s.mode).toBe('hint'); expect(s.repeat).toBe(false)
  })
  it.each(['hint', 'pulse', 'beam'] as const)('translates every guidance control and exports the %s mode', mode => {
    const settings = { ...defaultArchitectureSettings, illustration: 'guidance' as const, guidance: { ...defaults, mode, branch: 'alternate' as const }, parallaxEnabled: true }
    const noop = () => {}
    const markup = renderToStaticMarkup(createElement(LabLanguageContext.Provider, { value: 'en' }, createElement(ArchitectureControls, { value: settings, onChange: noop, onReplay: noop, onTouch: noop, getSvg: () => '', onAdd: noop, placed: false, onHome: noop })))
    expect(markup).not.toMatch(/[А-Яа-яЁё]/)
    expect(markup).toContain('Guide brightness'); expect(markup).toContain('Independent path')
    const code = exportArchitectureComponent(settings, 'en')
    expect(code).toContain('createGuidanceJunction'); expect(code).toContain('GuidanceCover'); expect(code).toContain(`"mode": "${mode}"`)
    expect(code).not.toContain("from './guidance")
  })
})
