import { getWorkspaceId } from './deepTutorCapabilities'
import { readLearningSpaceLayout } from './learningSpace'
import { readNotebookEntries } from './learningNotebook'
import { readLearningTasks } from './learningTasks'
import { readLocalPracticeRecords } from './localProgress'
import { readReviewEntries } from './reviewQueue'

/** A portable snapshot of the active workspace's browser-managed learning data. */
export function createWorkspaceExport() {
  return {
    format: 'algocoach-workspace-v1',
    exportedAt: new Date().toISOString(),
    workspaceId: getWorkspaceId(),
    notebook: readNotebookEntries(),
    tasks: readLearningTasks(),
    practiceRecords: readLocalPracticeRecords(),
    reviews: readReviewEntries(),
    layout: readLearningSpaceLayout(),
  }
}
