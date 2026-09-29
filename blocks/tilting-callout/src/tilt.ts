/**
 * The tilt maths, kept apart from the DOM so it can be tested on its own.
 *
 * The callout turns to face the pointer: the edge nearest the cursor lifts
 * towards the viewer and the far edge falls away. A soft glare sits under the
 * cursor to sell the angle.
 */

/**
 * The angles follow the Thread & Stack brand book's Tilt3D spec: at most 8°
 * of horizontal tilt and 6° of vertical, with no skew or parallax.
 */

/** Maximum vertical tilt: lean around the horizontal axis as the pointer moves up and down. */
export const MAX_TILT_X = 6

/** Maximum horizontal tilt: lean around the vertical axis as the pointer moves left and right. */
export const MAX_TILT_Y = 8

/**
 * Perspective scales with width. A callout is usually far wider than it is
 * tall, so at a fixed perspective 8° of horizontal tilt would swing its near
 * edge well past the iframe and get clipped. Three times the width keeps the
 * overhang inside the block's side padding. Never shallower than this.
 */
const MIN_PERSPECTIVE = 800

export type Tilt = {
  /** Degrees around the X axis. Positive lifts the bottom edge towards the viewer. */
  rotateX: number
  /** Degrees around the Y axis. Positive lifts the left edge towards the viewer. */
  rotateY: number
  /** Where the glare sits, as percentages of the callout's width and height. */
  glareX: number
  glareY: number
  perspective: number
}

export const FLAT: Tilt = {
  rotateX: 0,
  rotateY: 0,
  glareX: 50,
  glareY: 50,
  perspective: MIN_PERSPECTIVE,
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** Round to two decimal places so CSS strings stay short and stable in tests. */
function round(value: number): number {
  return Math.round(value * 100) / 100 || 0
}

/**
 * Work out the tilt for a pointer at (`x`, `y`) inside a callout of the given
 * size, all in the callout's own pixel space.
 */
export function tiltFor(x: number, y: number, width: number, height: number): Tilt {
  if (width <= 0 || height <= 0) return FLAT

  // -1 at the left/top edge, 1 at the right/bottom edge.
  const dx = clamp((x / width) * 2 - 1, -1, 1)
  const dy = clamp((y / height) * 2 - 1, -1, 1)

  return {
    rotateX: round(dy * MAX_TILT_X),
    rotateY: round(-dx * MAX_TILT_Y),
    glareX: round(((dx + 1) / 2) * 100),
    glareY: round(((dy + 1) / 2) * 100),
    perspective: Math.max(MIN_PERSPECTIVE, Math.round(width * 3)),
  }
}
