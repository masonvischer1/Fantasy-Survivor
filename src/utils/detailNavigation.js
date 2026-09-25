export const compareTeams = (a, b) => Number(b.total_score ?? 0) - Number(a.total_score ?? 0) || Number(b.remaining_castaways ?? 0) - Number(a.remaining_castaways ?? 0) || (a.team_name || '').localeCompare(b.team_name || '') || Number(a.id) - Number(b.id)

export function compareCastaways(a, b) {
  const aEliminated = a.is_eliminated === true
  const bEliminated = b.is_eliminated === true
  if (aEliminated !== bEliminated) return aEliminated ? 1 : -1
  if (aEliminated && Number(a.elimination_day || 0) !== Number(b.elimination_day || 0)) return Number(b.elimination_day || 0) - Number(a.elimination_day || 0)
  return (a.name || '').localeCompare(b.name || '') || Number(a.id) - Number(b.id)
}

export function swipeDirection(dx, dy) {
  return Math.abs(dx) >= 60 && Math.abs(dx) > Math.abs(dy) * 1.5 ? (dx < 0 ? 1 : -1) : 0
}

export function adjacentItem(items, id, direction) {
  const index = items.findIndex(item => String(item.id) === String(id))
  if (index < 0 || items.length < 2) return null
  return items[(index + direction + items.length) % items.length]
}

export function withRemainingCastaways(teams, contestants) {
  const activeIds = new Set(contestants.filter(c => !c.is_eliminated).map(c => String(c.id)))
  return teams.map(team => ({ ...team, remaining_castaways: new Set((team.drafted_team || []).map(p => String(p?.id ?? p)).filter(id => activeIds.has(id))).size }))
}
