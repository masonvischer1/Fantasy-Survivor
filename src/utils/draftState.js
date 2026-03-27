export const INITIAL_DRAFT_SIZE = 5
export const MERGE_DRAFT_SIZE = 6

export function getTeamSize(team) {
  return Array.isArray(team) ? team.length : 0
}

export function hasConfirmedMergePick(team) {
  return getTeamSize(team) >= MERGE_DRAFT_SIZE
}

export function getRemainingDraftSpots(team) {
  return Math.max(0, MERGE_DRAFT_SIZE - getTeamSize(team))
}

export function isMergeDraftAvailable(team) {
  const size = getTeamSize(team)
  return size >= INITIAL_DRAFT_SIZE && size < MERGE_DRAFT_SIZE
}
