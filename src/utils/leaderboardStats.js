export function ordinalPlace(rank) {
  const lastTwo = rank % 100
  const suffix = lastTwo >= 11 && lastTwo <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[rank % 10] || 'th')
  return `${rank}${suffix} Place`
}

// Mirrors recalculate_season_scores: surviving castaways use the latest game day.
export function castawayContribution(castaway, contestants) {
  const currentDay = contestants.reduce((day, c) => Math.max(day, Number(c.elimination_day || 0)), 0)
  const days = castaway.is_eliminated ? Math.max(Number(castaway.elimination_day || 0), 0) : currentDay
  return days + Number(castaway.jury_votes_received || 0)
}
