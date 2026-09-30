import { useEffect, useState } from 'react'
import { Navigate, Routes, Route, useLocation } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import Teams from './Teams'
import RankHistory from './RankHistory'
import ContestantsGrid from './contestantsGrid'
import TeamProfileView from './TeamProfileView'
import SeasonContestantDetail from './SeasonContestantDetail'
import WeeklyPicks from './weekly_picks'
import Rules from './Rules'
import { BottomNav } from './Navbar'

export default function GuestSite() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const location = useLocation()
  useEffect(() => {
    let active = true
    let releaseTimer
    async function load() {
      try {
        let next
        if (import.meta.env.DEV) {
          const response = await fetch('/__guest-preview')
          if (!response.ok) throw new Error('The local guest preview is not available.')
          next = await response.json()
        } else {
          const result = await supabase.rpc('get_guest_season_snapshot')
          if (result.error) throw result.error
          next = result.data
        }
        if (active) {
          setData(next)
          setError('')
          clearTimeout(releaseTimer)
          const untilRelease = Date.parse(next?.season?.guest_pick_release_at) - Date.now()
          if (untilRelease > 0) releaseTimer = setTimeout(load, Math.min(untilRelease + 250, 2147483647))
        }
      } catch {
        if (active) setError('Guest standings are temporarily unavailable. Please try again shortly.')
      }
    }
    load()
    const timer = setInterval(load, 60000)
    window.addEventListener('focus', load)
    return () => { active = false; clearInterval(timer); clearTimeout(releaseTimer); window.removeEventListener('focus', load) }
  }, [])
  if (!data) return <p className="guest-card" role={error ? 'alert' : 'status'}>{error || 'Loading league…'}</p>
  if (!data.season) return <p className="guest-card">No active season yet.</p>
  return <>
    {error && <p className="guest-card" role="alert">{error}</p>}
    <Routes>
      <Route index element={<Navigate to="teams" replace />} />
      <Route path="teams" element={<Teams guestData={data} />} />
      <Route path="rank-history" element={<RankHistory guest />} />
      <Route path="teams/:id" element={<TeamProfileView key={location.pathname} guestData={data} />} />
      <Route path="castaways" element={<ContestantsGrid guestData={data} />} />
      <Route path="castaways/:id" element={<SeasonContestantDetail key={location.pathname} guestData={data} />} />
      <Route path="weekly-picks" element={<WeeklyPicks guestData={data} />} />
      <Route path="rules" element={<Rules />} />
      <Route path="*" element={<Navigate to="/guest/teams" replace />} />
    </Routes>
    <BottomNav guest />
  </>
}
