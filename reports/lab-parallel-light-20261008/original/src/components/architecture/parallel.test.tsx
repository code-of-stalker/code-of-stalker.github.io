import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { LabLanguageContext } from '../../i18n/LabLanguage'
import { ArchitectureControls } from './ArchitectureControls'
import { defaultArchitectureSettings, normalizeArchitectureSettings, parseArchitecturePreset, serializeArchitecturePreset } from './architectureSettings'
import { defaultGuidanceSettings } from './guidanceSettings'
import { defaultParallelSettings as defaults, normalizeParallelSettings, parallelDuration, parallelPhase, parallelStages, parallelTimeAtPhase } from './parallelSettings'
import { parallelFrame } from './parallelGeometry'
import { exportArchitectureComponent } from './architectureExport'

describe('parallel path', () => {
  it('preserves the approved thin lines, restrained signals and brighter guide', () => {
    expect(defaults.stroke).toBe(.75); expect(defaults.support).toBe(.6); expect(defaults.guideBrightness).toBe(1.3)
    expect(parallelDuration(defaults)).toBeCloseTo(11)
    expect(parallelFrame(0, defaults).power).toBe(0)
    expect(parallelFrame(.95, defaults).power).toBe(1)
    expect(parallelFrame(1, defaults).power).toBe(0)
  })
  it('settles at two independent, stationary landings at exactly the same height', () => {
    for (const phase of [.66, .69, .78, .83, .94, .955]) {
      expect(parallelFrame(phase, defaults).positions).toEqual([[93, 24], [195, 24]])
    }
    for (const turns of [1, 2, 3]) for (const radius of [18, 43, 76]) {
      const s = { ...defaults, turns, radius, height: 95, landingSpread: 24, exitLift: 12 }
      const frame = parallelFrame(.66, s)
      expect(frame.positions[0][1]).toBe(frame.positions[1][1]); expect(frame.positions[0][0]).toBeLessThan(frame.positions[1][0])
      expect(frame.positions).toEqual(parallelFrame(.94, s).positions)
    }
  })
  it('has no positional discontinuity when the helix meets the horizontal exit', () => {
    for (const turns of [1, 3]) {
      const s = { ...defaults, turns, radius: 76, height: 106, depth: 20, sway: .45, landingSpread: 30 }
      let previous = parallelFrame(.48, s).positions
      for (let step = 481; step <= 700; step++) {
        const current = parallelFrame(step / 1000, s).positions
        for (const i of [0, 1]) expect(Math.hypot(current[i][0] - previous[i][0], current[i][1] - previous[i][1])).toBeLessThan(4)
        previous = current
      }
    }
  })
  it('retimes four stages without losing their order and holds the single-pass finale', () => {
    for (const timings of [[1, .3, .4, .8], [30, 10, 12, 20], [4, 2, 3, 7]]) {
      const s = { ...defaults, ...Object.fromEntries(parallelStages.map((stage, i) => [stage.key, timings[i]])) }
      for (const phase of [.01, .3, .51, .6, .66, .75, .83, .94, .97]) {
        expect(parallelPhase(parallelTimeAtPhase(phase, s), s)).toBeCloseTo(phase, 7)
      }
      expect(parallelPhase(parallelDuration(s), s)).toBe(0)
      expect(parallelPhase(10000, s, false)).toBe(.94)
      expect(parallelTimeAtPhase(.955, s) - parallelTimeAtPhase(.83, s)).toBeGreaterThan(s.finalDuration * .7)
    }
  })
  it('preserves junction and parallel presets independently and migrates old presets to the junction', () => {
    const settings = { ...defaultArchitectureSettings, illustration: 'guidance' as const, guidanceVariant: 'parallel' as const,
      guidance: { ...defaultGuidanceSettings, hintDuration: 5.7, mode: 'beam' as const }, parallel: { ...defaults, radius: 58, mode: 'ribbon' as const } }
    expect(parseArchitecturePreset(serializeArchitecturePreset(settings))).toEqual(settings)
    const legacy = normalizeArchitectureSettings({ illustration: 'guidance', guidance: { hintDuration: 5.7, mode: 'beam' } })
    expect(legacy.guidanceVariant).toBe('junction'); expect(legacy.guidance.hintDuration).toBe(5.7); expect(legacy.guidance.mode).toBe('beam')
    expect(legacy.parallel).toEqual(defaults)
    const malformed = normalizeParallelSettings({ turns: 2.8, rungs: 13.5, stroke: NaN, guideColor: '<svg>', radius: 500, finalDuration: 0 })
    expect(malformed.turns).toBe(3); expect(malformed.rungs).toBe(14); expect(malformed.stroke).toBe(defaults.stroke)
    expect(malformed.guideColor).toBe(defaults.guideColor); expect(malformed.radius).toBe(76); expect(malformed.finalDuration).toBe(.8)
  })
  it.each(['together', 'dialogue', 'ribbon'] as const)('renders English controls and includes the portable %s renderer', mode => {
    const value = { ...defaultArchitectureSettings, illustration: 'guidance' as const, guidanceVariant: 'parallel' as const, parallel: { ...defaults, mode } }
    const noop = () => {}
    const markup = renderToStaticMarkup(createElement(LabLanguageContext.Provider, { value: 'en' }, createElement(ArchitectureControls, { value, onChange: noop, onReplay: noop, onTouch: noop, onHome: noop, onAdd: noop, getSvg: () => '', placed: false })))
    expect(markup).not.toMatch(/[А-Яа-яЁё]/); expect(markup).toContain('Hint at the junction'); expect(markup).toContain('Parallel path')
    expect(markup).toContain('Spiral width'); expect(markup).toContain('Level exit')
    const code = exportArchitectureComponent(value, 'en')
    expect(code).toContain('createParallelPath'); expect(code).toContain('ParallelCover'); expect(code).toContain('createGuidanceJunction')
    expect(code).not.toContain("from './parallel")
  })
})
