import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function TeamProfileView() {
  const { id } = useParams()
  const [entry, setEntry] = useState(null)
  const [contestants, setContestants] = useState([])
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(true)
  const [viewerCanSee, setViewerCanSee] = useState(false)

  useEffect(() => {
    let active = true
    async function load() {
      const [{ data: team, error }, { data: authData }] = await Promise.all([
        supabase.from('season_entries').select('*').eq('id', id).single(),
        supabase.auth.getUser()
      ])
      if (error || !active) {
        if (error) console.error(error)
        setLoading(false)
        return
      }
      const [{ data: cast }, { data: weekly }, { data: season }, { data: viewer }] = await Promise.all([
        supabase.from('season_contestants').select('*').eq('season_id', team.season_id),
        supabase.from('season_weekly_results').select('*').eq('season_id', team.season_id).order('week'),
        supabase.from('seasons').select('initial_draft_size').eq('id', team.season_id).single(),
        supabase.from('season_entries').select('drafted_team').eq('season_id', team.season_id).eq('profile_id', authData.user.id).single()
      ])
      if (!active) return
      setEntry(team)
      setContestants(cast || [])
      setResults(weekly || [])
      setViewerCanSee((viewer?.drafted_team || []).length >= Number(season?.initial_draft_size || 5))
      setLoading(false)
    }
    Promise.resolve().then(load)
    return () => { active = false }
  }, [id])

  const contestantMap = useMemo(() => new Map(contestants.map(c => [String(c.id), c])), [contestants])
  const roster = useMemo(() => (entry?.drafted_team || []).map(pick => contestantMap.get(String(pick?.id ?? pick))).filter(Boolean), [contestantMap, entry])
  const resultMap = useMemo(() => new Map(results.map(result => [String(result.week), result])), [results])

  if (loading) return <div style={{ padding: '1rem' }}>Loading team…</div>
  if (!entry) return <div style={{ padding: '1rem' }}>Team not found.</div>
  if (!viewerCanSee) return <div style={{ maxWidth: 620, margin: '2rem auto', padding: '1rem', borderRadius: 12, background: 'rgba(255,255,255,.9)', textAlign: 'center' }}><h1>Complete Your Draft</h1><p>Draft your five starting players before viewing other teams.</p><Link to="/castaways">Choose Castaways</Link></div>

  return (
    <div style={{ padding: '1rem 1rem 6rem' }}>
      <article style={{ maxWidth: 880, margin: '0 auto', background: 'rgba(255,255,255,.9)', borderRadius: 14, padding: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {entry.avatar_url && <img src={entry.avatar_url} alt="" style={{ width: 76, height: 76, borderRadius: '50%', objectFit: 'cover' }} />}
          <div><h1 style={{ margin: 0 }}>{entry.team_name}</h1><p style={{ margin: '0.25rem 0 0' }}>{entry.player_name}</p></div>
          <strong style={{ marginLeft: 'auto' }}>{entry.total_score || 0} Points</strong>
        </div>

        <h2>Drafted Tribe</h2>
        {roster.length === 0 && <p>No castaways drafted yet.</p>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(125px,1fr))', gap: 10 }}>
          {roster.map(c => <div key={c.id} style={{ textAlign: 'center' }}><img src={c.picture_url} alt={c.name} style={{ width: '100%', aspectRatio: 1, objectFit: 'cover', objectPosition: 'center top', borderRadius: 8, filter: c.is_eliminated ? 'grayscale(1)' : 'none' }} /><strong>{c.name}</strong></div>)}
        </div>

        <h2>Weekly Picks</h2>
        {Object.keys(entry.weekly_picks || {}).length === 0 && <p>No weekly picks submitted yet.</p>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 8 }}>
          {Object.entries(entry.weekly_picks || {}).sort((a, b) => Number(a[0]) - Number(b[0])).map(([week, value]) => {
            const result = resultMap.get(String(week))
            const castaway = contestantMap.get(String(value))
            const won = result?.phase === 'tribal' ? String(result.winner_team) === String(value) : (result?.winner_original_contestant_ids || []).map(String).includes(String(value))
            return <div key={week} style={{ padding: 10, borderRadius: 8, background: '#f8fafc', opacity: result && !won ? .62 : 1 }}><strong>Week {week}</strong><p>{castaway?.name || value}</p>{won && <span style={{ color: '#166534', fontWeight: 700 }}>+{result.bonus_points_awarded} points</span>}</div>
          })}
        </div>
        <Link to="/teams" style={{ display: 'inline-block', marginTop: 18 }}>← Back to Leaderboard</Link>
      </article>
    </div>
  )
}
