import { useEffect, useRef } from 'react'
import type { MouseEvent, PointerEvent } from 'react'

export type CoverGestureOptions = {
  holdDelay: number; disabled?: boolean
  canStart?: (target: EventTarget | null) => boolean
  onHold: () => void; onRelease: () => void; onMove: (x: number, y: number) => void; onTap?: () => void
}
export type CoverGestureSession = {
  pointerId: number; x: number; y: number; lastX: number; lastY: number; started: number
  width: number; height: number; held: boolean; moved: boolean; target: HTMLElement
}
export function coverGestureIsTap(held: boolean, moved: boolean, elapsed: number, holdDelay: number, inside: boolean) {
  return !held && !moved && inside && elapsed < holdDelay * 1000
}
export function coverGestureMovement(dx: number, dy: number, width: number, height: number) {
  return { dragged: Math.hypot(dx, dy) > 10, x: Math.max(-1, Math.min(1, dx / Math.max(1, width * .3))), y: Math.max(-1, Math.min(1, dy / Math.max(1, height * .3))) }
}

/** A release opens the section only if the pointer never became a hold or a drag. */
export function useCoverGesture(options: CoverGestureOptions) {
  const latest = useRef(options); latest.current = options
  const session = useRef<CoverGestureSession | null>(null), timer = useRef(0), suppressClick = useRef(false)
  function clearTimer() { window.clearTimeout(timer.current); timer.current = 0 }
  function end() {
    const current = session.current
    if (!current) return
    session.current = null; clearTimer(); suppressClick.current = true
    latest.current.onRelease(); latest.current.onMove(0, 0)
    if (current.target.hasPointerCapture(current.pointerId)) current.target.releasePointerCapture(current.pointerId)
  }
  function hold(current: CoverGestureSession) {
    if (session.current !== current || current.held) return
    clearTimer(); current.held = true; latest.current.onHold()
  }
  useEffect(() => { if (options.disabled) end() }, [options.disabled])
  useEffect(() => {
    const cancel = () => { if (document.hidden) end() }
    document.addEventListener('visibilitychange', cancel)
    return () => { document.removeEventListener('visibilitychange', cancel); end() }
  }, [])
  return {
    onPointerDown(event: PointerEvent<HTMLElement>) {
      if (latest.current.disabled || event.button !== 0 || latest.current.canStart?.(event.target) === false) return
      if (!event.isPrimary) { end(); return }
      event.stopPropagation(); end(); suppressClick.current = false
      const target = event.currentTarget, bounds = target.getBoundingClientRect()
      const current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, lastX: event.clientX, lastY: event.clientY,
        started: performance.now(), width: bounds.width, height: bounds.height, held: false, moved: false, target }
      session.current = current; target.setPointerCapture(event.pointerId)
      timer.current = window.setTimeout(() => hold(current), latest.current.holdDelay * 1000)
    },
    onPointerMove(event: PointerEvent<HTMLElement>) {
      const current = session.current
      if (!current || current.pointerId !== event.pointerId) return
      event.stopPropagation(); current.lastX = event.clientX; current.lastY = event.clientY
      const movement = coverGestureMovement(event.clientX - current.x, event.clientY - current.y, current.width, current.height)
      current.moved ||= movement.dragged
      if (current.moved) hold(current)
      if (current.held) latest.current.onMove(movement.x, movement.y)
    },
    onPointerUp(event: PointerEvent<HTMLElement>) {
      const current = session.current
      if (!current || current.pointerId !== event.pointerId) return
      event.stopPropagation()
      const bounds = current.target.getBoundingClientRect()
      const inside = event.clientX >= bounds.left && event.clientX <= bounds.right && event.clientY >= bounds.top && event.clientY <= bounds.bottom
      const moved = current.moved || coverGestureMovement(event.clientX - current.x, event.clientY - current.y, current.width, current.height).dragged
      const tap = coverGestureIsTap(current.held, moved, performance.now() - current.started, latest.current.holdDelay, inside)
      end()
      if (tap && !latest.current.disabled) latest.current.onTap?.()
    },
    onPointerCancel(event: PointerEvent<HTMLElement>) { if (session.current?.pointerId === event.pointerId) { event.stopPropagation(); end() } },
    onLostPointerCapture(event: PointerEvent<HTMLElement>) { if (event.target === event.currentTarget && session.current?.pointerId === event.pointerId) end() },
    onContextMenu(event: MouseEvent<HTMLElement>) { if (session.current) event.preventDefault() },
    onClick(event: MouseEvent<HTMLElement>) {
      if (latest.current.canStart?.(event.target) === false) return
      event.stopPropagation()
      if (latest.current.disabled || (event.detail !== 0 && suppressClick.current)) { event.preventDefault(); return }
      latest.current.onTap?.()
    },
  }
}
