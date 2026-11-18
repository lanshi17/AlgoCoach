/**
 * Single source of truth for the AlgoCoach palette.
 *
 * The UI (`frontend/src/index.css`), the chat animation player and the
 * rendered MP4 all share the GitHub-dark tokens; keeping them in one module
 * stops each composition from drifting its own shade of "visited blue".
 */
export const C = {
  bg: '#0d1117',
  bg2: '#161b22',
  panel: '#161b22',
  border: '#30363d',
  text: '#e6edf3',
  muted: '#8b949e',
  accent: '#58a6ff',
  visited: '#1f6feb',
  success: '#3fb950',
  warning: '#d29922',
  danger: '#f85149',
} as const
