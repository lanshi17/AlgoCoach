/**
 * Shared timing model for every step-based composition.
 *
 * Two rules make renders reproducible and pacing predictable:
 *
 * 1. A scene is `intro + steps × per-step + outro`. `sequenceDurationInFrames`
 *    is the single place that decides how long a scene must be; `Root.tsx`
 *    feeds it into `calculateMetadata` so the composition duration follows the
 *    agent's data instead of a hard-coded 240 frames.
 * 2. `useStepSequence` derives the same grid back from the real
 *    `durationInFrames`, so a clip stays correct when it is shortened with
 *    `--frames`, previewed at another size, or rendered per-composition.
 */
import { Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'

/** Seconds before the first step (title establishes, then the scene starts). */
export const INTRO_SECONDS = 0.6
/** Seconds a single step stays on screen. */
export const STEP_SECONDS = 1.0
/** Seconds the solution stays visible after the last step. */
export const OUTRO_SECONDS = 0.9
export const MIN_SECONDS = 3
export const MAX_SECONDS = 30

export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

export const sequenceDurationInFrames = (steps: number, fps: number) => {
  const count = Math.max(1, steps)
  const seconds = INTRO_SECONDS + count * STEP_SECONDS + OUTRO_SECONDS
  return Math.round(clamp(seconds, MIN_SECONDS, MAX_SECONDS) * fps)
}

export type StepSequence = {
  /** Current step, clamped to the last step during the outro. */
  index: number
  /** 0..1 progress inside the current step (resets every step). */
  progress: number
  /** Eased 0..1 progress, ready for interpolation. */
  eased: number
  /** Number of steps that have started (0 while the intro is on screen). */
  revealed: number
  framesPerStep: number
  introFrame: number
  /** False during the intro, so scenes can hold their "before" state. */
  started: boolean
  frame: number
  fps: number
  durationInFrames: number
}

export const useStepSequence = (count: number): StepSequence => {
  const frame = useCurrentFrame()
  const { fps, durationInFrames } = useVideoConfig()
  const safeCount = Math.max(1, count)
  const intro = Math.round(INTRO_SECONDS * fps)
  const outro = Math.round(OUTRO_SECONDS * fps)
  const framesPerStep = Math.max(
    1,
    Math.floor((durationInFrames - intro - outro) / safeCount),
  )
  const raw = (frame - intro) / framesPerStep
  const index = clamp(Math.floor(raw), 0, safeCount - 1)
  const progress = clamp(raw - index, 0, 1)

  return {
    index,
    progress,
    eased: Easing.out(Easing.cubic)(progress),
    revealed: clamp(Math.floor(raw) + 1, 0, safeCount),
    framesPerStep,
    introFrame: intro,
    started: frame >= intro,
    frame,
    fps,
    durationInFrames,
  }
}

/** Critically damped spring: content lands without overshoot. */
export const springIn = (
  frame: number,
  fps: number,
  startFrame = 0,
  config: { damping?: number; stiffness?: number; mass?: number } = {},
) =>
  spring({
    frame: Math.max(0, frame - startFrame),
    fps,
    config: { damping: 200, stiffness: 170, mass: 0.7, ...config },
  })

/** Playful spring for highlights and badges: a small overshoot is wanted. */
export const popIn = (frame: number, fps: number, startFrame = 0) =>
  spring({
    frame: Math.max(0, frame - startFrame),
    fps,
    config: { damping: 14, stiffness: 180, mass: 0.6 },
  })

/** Interpolate with clamping and optional easing, defaulting to linear. */
export const slide = (
  progress: number,
  from: number,
  to: number,
  easing: (value: number) => number = (value) => value,
) =>
  interpolate(easing(clamp(progress, 0, 1)), [0, 1], [from, to], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
