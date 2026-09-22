export const compareTeams = (a, b) => Number(b.total_score ?? 0) - Number(a.total_score ?? 0) || (a.team_name || '').localeCompare(b.team_name || '') || Number(a.id) - Number(b.id)

export function compareCastaways(a, b) {
  const aEliminated = a.is_eliminated === true
  const bEliminated = b.is_eliminated === true
  if (aEliminated !== bEliminated) return aEliminated ? 1 : -1
  if (aEliminated && Number(a.elim_day || 0) !== Number(b.elim_day || 0)) return Number(b.elim_day || 0) - Number(a.elim_day || 0)
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
