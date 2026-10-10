import { useCallback, useEffect, useRef, type ReactNode } from "react"
import { FLAT, tiltFor, type Tilt } from "./tilt"

type TiltSurfaceProps = {
  /** When false the surface lies flat and ignores the pointer (e.g. while editing). */
  enabled: boolean
  className?: string
  children: ReactNode
}

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)"

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia(REDUCED_MOTION).matches
}

/**
 * Tilts its children towards the pointer.
 *
 * The angles are written straight to CSS custom properties from a single
 * animation frame per pointer move, rather than through React state, so a fast
 * mouse does not re-render the callout dozens of times a second.
 *
 * Only mouse and pen pointers tilt it. On touch there is no hover to follow, and
 * tilting under a finger would fight the page scroll.
 */
export function TiltSurface({ enabled, className, children }: TiltSurfaceProps) {
  const ref = useRef<HTMLDivElement>(null)
  const frame = useRef<number | null>(null)
  const pending = useRef<Tilt>(FLAT)

  const apply = useCallback((tilt: Tilt, active: boolean) => {
    pending.current = tilt
    if (frame.current !== null) return
    frame.current = requestAnimationFrame(() => {
      frame.current = null
      const node = ref.current
      if (!node) return
      const { rotateX, rotateY, glareX, glareY, perspective } = pending.current
      node.style.setProperty("--tilt-x", `${rotateX}deg`)
      node.style.setProperty("--tilt-y", `${rotateY}deg`)
      node.style.setProperty("--glare-x", `${glareX}%`)
      node.style.setProperty("--glare-y", `${glareY}%`)
      node.style.setProperty("--tilt-perspective", `${perspective}px`)
      node.classList.toggle("is-tilting", active)
    })
  }, [])

  const settle = useCallback(() => apply(FLAT, false), [apply])

  // Lay flat whenever tilting is switched off, and cancel any queued frame on unmount.
  useEffect(() => {
    if (!enabled) settle()
  }, [enabled, settle])

  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current)
    },
    []
  )

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!enabled || event.pointerType === "touch" || prefersReducedMotion()) return
    const rect = event.currentTarget.getBoundingClientRect()
    apply(
      tiltFor(event.clientX - rect.left, event.clientY - rect.top, rect.width, rect.height),
      true
    )
  }

  return (
    <div
      ref={ref}
      className={`tilt-surface ${className ?? ""}`}
      onPointerMove={onPointerMove}
      onPointerLeave={settle}
      onPointerCancel={settle}
    >
      <div className="tilt-body">
        {children}
        <span className="tilt-glare" aria-hidden="true" />
      </div>
    </div>
  )
}
