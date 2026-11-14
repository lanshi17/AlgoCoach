import { Composition } from 'remotion'
import { MainComp } from './compositions/MainComp'
import { DEFAULT_WEEKLY_REPORT, WeeklyReport } from './compositions/WeeklyReport'

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
        fps={30}
        width={1280}
        height={720}
        defaultProps={{ component: 'BfsGraph', data: {} }}
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
