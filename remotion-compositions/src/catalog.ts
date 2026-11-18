/**
 * Component → duration map.
 *
 * `calculateMetadata` runs before a render starts and has no `useVideoConfig`,
 * so durations are computed from the same pure step builders the scenes use.
 * A scene that is opened in the Studio, previewed by the chat player or rendered
 * by the agent therefore always gets the same pacing.
 */
import { bfsGraphFrames, type BfsGraphProps } from './compositions/BfsGraph'
import { dpTableFrames, type DpTableProps } from './compositions/DpTable'
import { slidingWindowFrames, type SlidingWindowProps } from './compositions/SlidingWindow'
import { twoPointerFrames, type TwoPointerProps } from './compositions/TwoPointer'
import {
  backtrackingFrames,
  binarySearchFrames,
  dijkstraFrames,
  dfsTreeFrames,
  gridBfsFrames,
  heapSortFrames,
  linkedListFrames,
  solutionCompareFrames,
  sortVisualizerFrames,
  unionFindFrames,
  type BacktrackingTreeProps,
  type BinarySearchProps,
  type DfsTreeProps,
  type DijkstraProps,
  type GridBfsProps,
  type HeapSortProps,
  type LinkedListOpsProps,
  type SolutionCompareProps,
  type SortVisualizerProps,
  type UnionFindProps,
} from './compositions/AdvancedAlgorithms'

/** Width of the agent's JSON is unknown at compile time; each scene validates
 *  what it reads with defaults, so the props cast happens once, here. */
const props = <P,>(data: Record<string, unknown>) => data as unknown as P

const DURATIONS: Record<string, (data: Record<string, unknown>, fps: number) => number> = {
  BfsGraph: (data, fps) => bfsGraphFrames(props<BfsGraphProps>(data), fps),
  DpTable: (data, fps) => dpTableFrames(props<DpTableProps>(data), fps),
  SlidingWindow: (data, fps) => slidingWindowFrames(props<SlidingWindowProps>(data), fps),
  TwoPointer: (data, fps) => twoPointerFrames(props<TwoPointerProps>(data), fps),
  DfsTree: (data, fps) => dfsTreeFrames(props<DfsTreeProps>(data), fps),
  Dijkstra: (data, fps) => dijkstraFrames(props<DijkstraProps>(data), fps),
  UnionFind: (data, fps) => unionFindFrames(props<UnionFindProps>(data), fps),
  HeapSort: (data, fps) => heapSortFrames(props<HeapSortProps>(data), fps),
  BacktrackingTree: (data, fps) => backtrackingFrames(props<BacktrackingTreeProps>(data), fps),
  BinarySearch: (data, fps) => binarySearchFrames(props<BinarySearchProps>(data), fps),
  LinkedListOps: (data, fps) => linkedListFrames(props<LinkedListOpsProps>(data), fps),
  SolutionCompare: (data, fps) => solutionCompareFrames(props<SolutionCompareProps>(data), fps),
  SortVisualizer: (data, fps) => sortVisualizerFrames(props<SortVisualizerProps>(data), fps),
  GridBfs: (data, fps) => gridBfsFrames(props<GridBfsProps>(data), fps),
  // The weekly report is registered in MainComp only for chat previews; its
  // own 1920x1080 composition keeps the 10-second cut.
  WeeklyReport: (_data, fps) => Math.round(8 * fps),
}

export const MAIN_COMP_DEFAULT_FRAMES = 240

export const mainDurationInFrames = (
  component: string,
  data: Record<string, unknown>,
  fps: number,
) => DURATIONS[component]?.(data, fps) ?? MAIN_COMP_DEFAULT_FRAMES
