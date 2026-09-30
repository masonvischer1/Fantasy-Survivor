export function isGuestPickWeekReleased(season, week) {
  return (season?.guest_released_pick_weeks || []).some(releasedWeek => Number(releasedWeek) === Number(week))
}

export function guestPickReleaseMessage(season, week = season?.current_week) {
  const releaseAt = season?.guest_pick_release_at
  if (Number(week) === Number(season?.current_week) && releaseAt && Number.isFinite(Date.parse(releaseAt))) {
    const label = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York', weekday: 'long', month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit', timeZoneName: 'short'
    }).format(new Date(releaseAt))
    return `Week ${week} picks become public ${label}.`
  }
  return `Week ${week} picks are not public yet. Guest picks are released Wednesdays at 7:55 p.m. Eastern after the admin activates that week.`
}
