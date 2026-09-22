import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import siteLogo from '../assets/51/Logo.webp'
import { compareTeams } from '../utils/detailNavigation'
import idolImg from '../assets/idol.png'

const totalFor = entry => Number(entry.total_score ?? 0)

export default function Teams() {
  const navigate = useNavigate()
  const [entries, setEntries] = useState([])
  const [contestants, setContestants] = useState([])
  const [loading, setLoading] = useState(true)
  const [viewerCanSee, setViewerCanSee] = useState(false)
  const [viewerDraftCount, setViewerDraftCount] = useState(0)
  const [requiredDraftCount, setRequiredDraftCount] = useState(5)

  const loadLeaderboard = useCallback(async () => {
    const { data: activeSeason, error: seasonError } = await supabase
      .from('seasons')
      .select('*')
      .in('status', ['draft', 'active', 'finale'])
      .single()

    if (seasonError) {
      console.error(seasonError)
      setLoading(false)
      return
    }

    const [{ data: entryData, error: entryError }, { data: contestantData, error: contestantError }, { data: authData }] = await Promise.all([
      supabase.from('season_entries').select('*').eq('season_id', activeSeason.id).not('team_name', 'is', null),
      supabase.from('season_contestants').select('*').eq('season_id', activeSeason.id),
      supabase.auth.getUser()
    ])

    if (entryError || contestantError) console.error(entryError || contestantError)
    setEntries(entryData || [])
    setContestants(contestantData || [])
    const viewerEntry = (entryData || []).find(entry => String(entry.profile_id) === String(authData?.user?.id))
    const draftCount = Array.isArray(viewerEntry?.drafted_team) ? viewerEntry.drafted_team.length : 0
    setRequiredDraftCount(Number(activeSeason.initial_draft_size || 5))
    setViewerDraftCount(draftCount)
    setViewerCanSee(draftCount >= Number(activeSeason.initial_draft_size || 5))
    setLoading(false)
  }, [])

  useEffect(() => {
    Promise.resolve().then(loadLeaderboard)
    const channel = supabase
      .channel('season-51-leaderboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'season_entries' }, loadLeaderboard)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'season_contestants' }, loadLeaderboard)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [loadLeaderboard])

  const contestantMap = useMemo(() => new Map(contestants.map(c => [String(c.id), c])), [contestants])
  const rankedEntries = useMemo(() => {
    const sorted = [...entries].sort(compareTeams)
    return sorted.map(entry => {
      const rank = sorted.findIndex(item => totalFor(item) === totalFor(entry)) + 1
      return {
        ...entry,
        rank,
        roster: (entry.drafted_team || []).map(pick => contestantMap.get(String(pick?.id ?? pick))).filter(Boolean)
      }
    })
  }, [contestantMap, entries])

  return (
    <div style={{ padding: '0.75rem 0.75rem calc(6rem + env(safe-area-inset-bottom))', position: 'relative' }}>
      <img src={idolImg} alt="" aria-hidden="true" style={{ position: 'absolute', top: '-48px', right: 'calc(-104px + env(safe-area-inset-right))', width: 'clamp(200px, 46vw, 340px)', pointerEvents: 'none', transform: 'rotate(22deg)', transformOrigin: 'top right', filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.4))' }} />
      <img src={siteLogo} alt="Survivor Draft Logo" style={{ display: 'block', width: 'min(170px, 43vw)', margin: '0 auto 0.75rem' }} />
      <h1 style={{ color: 'white', textShadow: '0 2px 8px rgba(0,0,0,0.6)' }}>Leaderboard</h1>

      {loading && <p style={{ color: 'white' }}>Loading leaderboard…</p>}
      {!loading && !viewerCanSee && <div style={{ maxWidth: 620, margin: '1rem auto', padding: '1rem', borderRadius: 12, background: 'rgba(255,255,255,.9)', textAlign: 'center' }}><h2>Complete Your Draft</h2><p>Draft your five starting players before viewing the other teams.</p><p><strong>{viewerDraftCount} / {requiredDraftCount}</strong> selected</p><Link to="/castaways" style={{ display: 'inline-block', padding: '.7rem 1rem', borderRadius: 8, background: '#166534', color: 'white', fontWeight: 700 }}>Choose Castaways</Link></div>}
      {!loading && viewerCanSee && rankedEntries.length === 0 && <p style={{ color: 'white' }}>No Survivor 51 teams have been created yet.</p>}

      {viewerCanSee && rankedEntries.map(entry => (
        <article key={entry.id} onClick={() => navigate(`/teams/${entry.id}`)} role="button" tabIndex={0} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') navigate(`/teams/${entry.id}`) }} style={{ marginBottom: '0.6rem', border: entry.rank === 1 ? '2px solid #d4af37' : '1px solid #ddd', padding: '0.6rem', borderRadius: '10px', background: 'rgba(255,255,255,0.88)', cursor: 'pointer' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
            {entry.avatar_url && <img src={entry.avatar_url} alt="" style={{ width: 42, height: 42, borderRadius: '50%', objectFit: 'cover' }} />}
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 style={{ margin: 0, fontSize: '1.1rem', lineHeight: 1.2, overflowWrap: 'anywhere' }}>{entry.team_name}</h2>
              <p style={{ margin: '0.2rem 0 0', color: '#666', fontSize: '0.8rem' }}>{entry.player_name}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <strong style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}>{totalFor(entry)} Points</strong>
              <p style={{ margin: '0.2rem 0 0', color: '#555', fontSize: '0.85rem' }}>#{entry.rank}</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.45rem', overflowX: 'auto' }}>
            {entry.roster.length === 0 ? <span style={{ color: '#64748b', fontSize: '0.85rem' }}>Draft not submitted yet</span> : entry.roster.map(c => (
              <div key={c.id} style={{ width: 44, flex: '0 0 auto', textAlign: 'center' }}>
                <img src={c.picture_url || '/fallback.png'} alt={c.display_name || c.name} style={{ display: 'block', margin: '0 auto 0.2rem', width: 38, height: 38, objectFit: 'cover', objectPosition: 'center top', borderRadius: 6, filter: c.is_eliminated ? 'grayscale(1)' : 'none' }} />
                <small style={{ display: 'block', fontSize: '0.65rem', lineHeight: 1.15, overflowWrap: 'anywhere' }}>{c.display_name || c.name.split(' ')[0]}</small>
              </div>
            ))}
          </div>
          <p style={{ margin: '0.45rem 0 0', color: '#166534', fontSize: '0.8rem' }}>{entry.team_points || 0} Team · +{entry.bonus_points || 0} Bonus</p>
        </article>
      ))}
    </div>
  )
}
