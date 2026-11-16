import React from 'react'
import { AbsoluteFill } from 'remotion'
import { MONO_FONT_STACK } from '../fonts'
import { BfsGraph } from './BfsGraph'
import { DpTable } from './DpTable'
import { SlidingWindow } from './SlidingWindow'
import { TwoPointer } from './TwoPointer'
import { WeeklyReport } from './WeeklyReport'
import { BacktrackingTree, BinarySearch, DfsTree, Dijkstra, GridBfs, HeapSort, LinkedListOps, SolutionCompare, SortVisualizer, UnionFind } from './AdvancedAlgorithms'

type Props = {
  component: string
  data: Record<string, unknown>
}

const REGISTRY: Record<string, React.FC<{ data: Record<string, unknown> }>> = {
  BfsGraph:      ({ data }) => <BfsGraph {...(data as any)} />,
  DpTable:       ({ data }) => <DpTable {...(data as any)} />,
  SlidingWindow: ({ data }) => <SlidingWindow {...(data as any)} />,
  TwoPointer:    ({ data }) => <TwoPointer {...(data as any)} />,
  WeeklyReport:  ({ data }) => <WeeklyReport {...(data as any)} />,
  DfsTree: ({ data }) => <DfsTree {...(data as any)} />,
  Dijkstra: ({ data }) => <Dijkstra {...(data as any)} />,
  UnionFind: ({ data }) => <UnionFind {...(data as any)} />,
  HeapSort: ({ data }) => <HeapSort {...(data as any)} />,
  BacktrackingTree: ({ data }) => <BacktrackingTree {...(data as any)} />,
  BinarySearch: ({ data }) => <BinarySearch {...(data as any)} />,
  LinkedListOps: ({ data }) => <LinkedListOps {...(data as any)} />,
  SolutionCompare: ({ data }) => <SolutionCompare {...(data as any)} />,
  SortVisualizer: ({ data }) => <SortVisualizer {...(data as any)} />,
  GridBfs: ({ data }) => <GridBfs {...(data as any)} />,
}

export const MainComp: React.FC<Props> = ({ component, data }) => {
  const Comp = REGISTRY[component] ?? REGISTRY['BfsGraph']
  return (
    <AbsoluteFill style={{ background: '#0d1117', fontFamily: MONO_FONT_STACK }}>
      <Comp data={data} />
    </AbsoluteFill>
  )
}
