import { type CalculateMetadataFunction, Composition } from 'remotion'
import { mainDurationInFrames } from './catalog'
import { MainComp, type MainCompProps } from './compositions/MainComp'
import { DEFAULT_WEEKLY_REPORT, WeeklyReport } from './compositions/WeeklyReport'

const MAIN_FPS = 30

/**
 * MainComp duration follows the agent's data: a 3-step DFS and a 20-state heap
 * sort no longer share the old fixed 240 frames. Every scene exposes its step
 * count through `catalog.ts`, and the timeouts/limits live in `motion.ts`.
 */
const calculateMainMetadata: CalculateMetadataFunction<MainCompProps> = ({ props }) => ({
  durationInFrames: mainDurationInFrames(props.component, props.data ?? {}, MAIN_FPS),
})

/**
 * Root — registers all compositions.
 * The agent renders "MainComp" with dynamic props { component, data } for
 * in-chat animations. Weekly reports use the dedicated "WeeklyReport"
 * composition at the 1920x1080 / 60fps spec instead of the 1280x720 / 30fps
 * chat composition.
 */
export function RemotionRoot() {
  return (
    <>
      <Composition
        id="MainComp"
        component={MainComp}
        durationInFrames={240}
        fps={MAIN_FPS}
        width={1280}
        height={720}
        defaultProps={{ component: 'BfsGraph', data: {} }}
        calculateMetadata={calculateMainMetadata}
      />
      <Composition
        id="WeeklyReport"
        component={WeeklyReport}
        durationInFrames={600}
        fps={60}
        width={1920}
        height={1080}
        defaultProps={DEFAULT_WEEKLY_REPORT}
      />
    </>
  )
}
