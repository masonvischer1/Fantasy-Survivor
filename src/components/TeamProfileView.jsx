import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { castawayContribution } from '../utils/leaderboardStats'
import DetailNavigation from './DetailNavigation'
import { compareTeams, withRemainingCastaways } from '../utils/detailNavigation'
import { supabase } from '../supabaseClient'

export default function TeamProfileView({ guestData = null }) {
  const { id } = useParams()
  const prefix = guestData ? '/guest' : ''
  const [teams, setTeams] = useState([])
  const [entry, setEntry] = useState(null)
  const [contestants, setContestants] = useState([])
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(true)
  const [viewerPicks, setViewerPicks] = useState({})
  const [viewerCanSee, setViewerCanSee] = useState(false)

  useEffect(() => {
    let active = true
    async function load() {
      if (guestData) {
        if (!active) return
        setEntry(guestData.teams.find(t => String(t.id) === id) || null)
        setTeams(withRemainingCastaways(guestData.teams, guestData.castaways).sort(compareTeams))
        setContestants(guestData.castaways)
        setResults(guestData.results)
        setViewerCanSee(true)
        setLoading(false)
        return
      }
      const [{ data: team, error }, { data: authData }] = await Promise.all([
        supabase.from('season_entries').select('*').eq('id', id).single(),
        supabase.auth.getUser()
      ])
      if (!active) return
      if (error) {
        if (error) console.error(error)
        setLoading(false)
        return
      }
      const [{ data: cast }, { data: weekly }, { data: season }, { data: viewer }, { data: teamList }] = await Promise.all([
        supabase.from('season_contestants').select('*').eq('season_id', team.season_id),
        supabase.from('season_weekly_results').select('*').eq('season_id', team.season_id).order('week'),
        supabase.from('seasons').select('initial_draft_size').eq('id', team.season_id).single(),
        supabase.from('season_entries').select('drafted_team, weekly_picks').eq('season_id', team.season_id).eq('profile_id', authData?.user?.id).single(),
        supabase.from('season_entries').select('id, team_name, player_name, avatar_url, total_score, drafted_team').eq('season_id', team.season_id).not('team_name', 'is', null)
      ])
      if (!active) return
      setTeams(withRemainingCastaways(teamList || [], cast || []).sort(compareTeams))
      setEntry(team)
      setContestants(cast || [])
      setResults(weekly || [])
      setViewerPicks(viewer?.weekly_picks || {})
      setViewerCanSee((viewer?.drafted_team || []).length >= Number(season?.initial_draft_size || 5))
      setLoading(false)
    }
    Promise.resolve().then(load)
    return () => { active = false }
  }, [id, guestData])

  const contestantMap = useMemo(() => new Map(contestants.map(c => [String(c.id), c])), [contestants])
  const roster = useMemo(() => (entry?.drafted_team || []).map(pick => contestantMap.get(String(pick?.id ?? pick))).filter(Boolean), [contestantMap, entry])
  const resultMap = useMemo(() => new Map(results.map(result => [String(result.week), result])), [results])

  const visibleWeeklyPicks = Object.entries(entry?.weekly_picks || {}).filter(([week]) => !!guestData || (viewerPicks[week] != null && viewerPicks[week] !== ''))

  if (loading) return <div style={{ padding: '1rem' }}>Loading team…</div>
  if (!entry) return <div style={{ padding: '1rem' }}>Team not found.</div>
  if (!viewerCanSee) return <div style={{ maxWidth: 620, margin: '2rem auto', padding: '1rem', borderRadius: 12, background: 'rgba(255,255,255,.9)', textAlign: 'center' }}><h1>Complete Your Draft</h1><p>Draft your five starting players before viewing other teams.</p><Link to="/castaways">Choose Castaways</Link></div>

  return (
    <div className="team-detail">
      <Link to={`${prefix}/teams`} className="castaway-back">← Back</Link>
      <DetailNavigation items={teams} id={id} basePath={`${prefix}/teams`} label="team" previews renderPreview={team => (
        <div className="team-preview-content">
          <div className="team-detail-header">{team.avatar_url && <img className="team-avatar" src={team.avatar_url} alt="" />}<h2>{team.team_name}</h2></div>
          <p>{team.total_score || 0} Points</p>
          <div className="team-detail-roster">{(team.drafted_team || []).map(pick => contestantMap.get(String(pick?.id ?? pick))).filter(Boolean).map(c => <img key={c.id} src={c.picture_url} alt="" />)}</div>
        </div>
      )}>
      <article style={{ maxWidth: 880, margin: '0 auto', background: 'rgba(255,255,255,.9)', borderRadius: 14, padding: '1rem' }}>
        <div className="team-detail-header">
          {entry.avatar_url && <img className="team-avatar" src={entry.avatar_url} alt="" />}
          <div><h1>{entry.team_name}</h1><p>{entry.player_name}</p></div>
        </div>
        <dl className="team-score-breakdown">
          <div><dt>Tribe</dt><dd>{entry.team_points || 0}</dd></div>
          <div><dt>Bonus</dt><dd>{entry.bonus_points || 0}</dd></div>
          {!!Number(entry.manual_points) && <div><dt>Adjustment</dt><dd>{entry.manual_points}</dd></div>}
          <div><dt>Total</dt><dd>{entry.total_score || 0}</dd></div>
        </dl>

        <h2>Drafted Tribe</h2>
        {roster.length === 0 && <p>No castaways drafted yet.</p>}
        <div className="team-detail-roster">
          {roster.map(c => <Link key={c.id} to={`${prefix}/castaways/${c.id}`} style={{ textAlign: 'center', color: 'inherit' }}><span className="roster-photo-wrap"><img src={c.picture_url} alt={c.name} style={{ width: '100%', aspectRatio: 1, objectFit: 'cover', objectPosition: 'center top', borderRadius: 8, filter: c.is_eliminated ? 'grayscale(1)' : 'none' }} /><span className="castaway-points-badge" aria-label={`${castawayContribution(c, contestants)} tribe points contributed`}>{castawayContribution(c, contestants)} pts</span></span><strong>{c.display_name || c.name}</strong></Link>)}
        </div>

        <h2>Weekly Picks</h2>
        {visibleWeeklyPicks.length === 0 && <p>{guestData ? 'No weekly picks submitted yet.' : 'Team picks appear after you submit your own pick for that week.'}</p>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 8 }}>
          {visibleWeeklyPicks.sort((a, b) => Number(a[0]) - Number(b[0])).map(([week, value]) => {
            const result = resultMap.get(String(week))
            const castaway = contestantMap.get(String(value))
            const won = result?.phase === 'tribal' ? String(result.winner_team) === String(value) : (result?.winner_original_contestant_ids || []).map(String).includes(String(value))
            return <div key={week} style={{ padding: 10, borderRadius: 8, background: '#f8fafc', opacity: result && !won ? .62 : 1 }}><strong>Week {week}</strong><p>{castaway?.name || value}</p>{won && <span style={{ color: '#166534', fontWeight: 700 }}>+{result.bonus_points_awarded} points</span>}</div>
          })}
        </div>
      </article>
      </DetailNavigation>
    </div>
  )
}
