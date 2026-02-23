export function buildContestantMap(contestants) {
  const map = new Map()
  ;(contestants || []).forEach(contestant => {
    map.set(String(contestant.id), contestant)
  })
  return map
}

export function hydrateTeamFromContestants(team, contestantMap) {
  if (!Array.isArray(team)) return []

  return team.map(pick => {
    const key = String(pick?.id ?? '')
    const liveContestant = contestantMap.get(key)
    return liveContestant ? { ...pick, ...liveContestant } : pick
  })
}
