import React from 'react'
import { AbsoluteFill, useVideoConfig } from 'remotion'
import { MONO_FONT_STACK, useFontGate } from '../fonts'
import { C } from '../theme'
import { BfsGraph } from './BfsGraph'
import { DpTable } from './DpTable'
import { SlidingWindow } from './SlidingWindow'
import { TwoPointer } from './TwoPointer'
import { WeeklyReport } from './WeeklyReport'
import {
  BacktrackingTree,
  BinarySearch,
  DfsTree,
  Dijkstra,
  GridBfs,
  HeapSort,
  LinkedListOps,
  SolutionCompare,
  SortVisualizer,
  UnionFind,
} from './AdvancedAlgorithms'

export type MainCompProps = {
  component: string
  data: Record<string, unknown>
}

/** Agent JSON is untyped; scenes default every field they read. Cast once. */
function scene<P extends object>(Component: React.ComponentType<P>) {
  return function Scene({ data }: { data: Record<string, unknown> }) {
    return <Component {...(data as unknown as P)} />
  }
}

const REGISTRY: Record<string, React.ComponentType<{ data: Record<string, unknown> }>> = {
  BfsGraph: scene(BfsGraph),
  DpTable: scene(DpTable),
  SlidingWindow: scene(SlidingWindow),
  TwoPointer: scene(TwoPointer),
  WeeklyReport: scene(WeeklyReport),
  DfsTree: scene(DfsTree),
  Dijkstra: scene(Dijkstra),
  UnionFind: scene(UnionFind),
  HeapSort: scene(HeapSort),
  BacktrackingTree: scene(BacktrackingTree),
  BinarySearch: scene(BinarySearch),
  LinkedListOps: scene(LinkedListOps),
  SolutionCompare: scene(SolutionCompare),
  SortVisualizer: scene(SortVisualizer),
  GridBfs: scene(GridBfs),
}

export const MainComp: React.FC<MainCompProps> = ({ component, data }) => {
  useFontGate()
  const { width, height } = useVideoConfig()
  const Comp = REGISTRY[component] ?? REGISTRY.BfsGraph
  // Scenes draw in a fixed 1280x720 designer space. Scaling the whole stage
  // keeps them correct if MainComp is ever registered at another resolution
  // (the default registration is exactly 1280x720, so scale === 1).
  const scale = Math.min(width / 1280, height / 720)
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: 1280,
          height: 720,
          transformOrigin: 'top left',
          transform: `translate(${(width - 1280 * scale) / 2}px, ${(height - 720 * scale) / 2}px) scale(${scale})`,
          fontFamily: MONO_FONT_STACK,
        }}
      >
        <Comp data={data} />
      </div>
    </AbsoluteFill>
  )
}
