export const MERGE_CLOSE_AT = Date.parse('2026-11-04T20:20:00-05:00')
export const isMergeOpen = (now = Date.now()) => now < MERGE_CLOSE_AT
