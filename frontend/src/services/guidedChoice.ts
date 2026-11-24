/** Choice-question protocol for guided learning: four options, then a final [[答案:X]] line. */

export const optionLine = /^[ \t]*(?:[-*][ \t]*)?(?:\*\*)?([A-D])[.、:：)）][ \t]*(?:\*\*)?[ \t]*(\S.*?)\s*$/gm

export function parseChoices(text: string) {
  const choices = [...text.matchAll(optionLine)]
    .map(match => ({ label: match[1], body: match[2] }))
  return choices.length === 4 && new Set(choices.map(choice => choice.label)).size === 4 ? choices : []
}

/** The letter from a final [[答案:X]] line; undefined if the marker is missing or not alone on its last line. */
export function parseChoiceAnswer(text: string): string | undefined {
  return text.match(/(?:^|\n)[ \t]*\[\[答案:([A-D])\]\]\s*$/)?.[1]
}

/** Text to show while a reply streams: hides a complete or partial marker and a lone trailing bracket. */
export function visibleReply(text: string, marker: string): string {
  const start = text.lastIndexOf('[[')
  if (start >= 0 && (marker.startsWith(text.slice(start)) || text.slice(start).startsWith(marker))) {
    return text.slice(0, start).trimEnd()
  }
  if (text.endsWith('[')) return text.slice(0, -1)
  return text
}
