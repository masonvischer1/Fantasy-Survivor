import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import siteLogo from '../assets/51/Logo.webp'
import { compareTeams, withRemainingCastaways } from '../utils/detailNavigation'
import { ordinalPlace } from '../utils/leaderboardStats'
import './RankHistory.css'
import idolImg from '../assets/idol.png'

const totalFor = entry => Number(entry.total_score ?? 0)

export default function Teams({ guestData = null }) {
  const navigate = useNavigate()
  const prefix = guestData ? '/guest' : ''
  const [isAdmin, setIsAdmin] = useState(false)
  const [currentWeek, setCurrentWeek] = useState(1)
  const [episodeCount, setEpisodeCount] = useState(15)
  const [seasonId, setSeasonId] = useState(null)
  const [rankSnapshot, setRankSnapshot] = useState({ changes: {} })
  const [updatingRanks, setUpdatingRanks] = useState(false)
  const [rankMessage, setRankMessage] = useState('')
  const [entries, setEntries] = useState([])
  const [contestants, setContestants] = useState([])
  const [loading, setLoading] = useState(true)
  const [viewerCanSee, setViewerCanSee] = useState(false)
  const [viewerDraftCount, setViewerDraftCount] = useState(0)
  const [requiredDraftCount, setRequiredDraftCount] = useState(5)

  const loadLeaderboard = useCallback(async () => {
    if (guestData) {
      setRankSnapshot(guestData.rank_snapshot || { changes: {} })
      setEntries(guestData.teams)
      setContestants(guestData.castaways)
      setViewerCanSee(true)
      setLoading(false)
      return
    }
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

    setSeasonId(activeSeason.id)
    setCurrentWeek(activeSeason.current_week)
    setEpisodeCount(activeSeason.episode_count)
    const [{ data: account }, { data: snapshot, error: rankError }] = await Promise.all([
      supabase.from('profiles').select('is_admin').eq('id', authData?.user?.id).single(),
      supabase.rpc('get_season_rank_changes', { p_season_id: activeSeason.id })
    ])
    setIsAdmin(!!account?.is_admin)
    if (!rankError) setRankSnapshot(snapshot || { changes: {} })
    if (entryError || contestantError) console.error(entryError || contestantError)
    setEntries(entryData || [])
    setContestants(contestantData || [])
    const viewerEntry = (entryData || []).find(entry => String(entry.profile_id) === String(authData?.user?.id))
    const draftCount = Array.isArray(viewerEntry?.drafted_team) ? viewerEntry.drafted_team.length : 0
    setRequiredDraftCount(Number(activeSeason.initial_draft_size || 5))
    setViewerDraftCount(draftCount)
    setViewerCanSee(draftCount >= Number(activeSeason.initial_draft_size || 5))
    setLoading(false)
  }, [guestData])

  useEffect(() => {
    Promise.resolve().then(loadLeaderboard)
    if (guestData) return
    const channel = supabase
      .channel('season-51-leaderboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'season_entries' }, loadLeaderboard)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'season_contestants' }, loadLeaderboard)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [loadLeaderboard, guestData])

  const contestantMap = useMemo(() => new Map(contestants.map(c => [String(c.id), c])), [contestants])
  const rankedEntries = useMemo(() => {
    const sorted = withRemainingCastaways(entries, contestants).sort(compareTeams)
    return sorted.map(entry => {
      const rank = sorted.findIndex(item => totalFor(item) === totalFor(entry) && item.remaining_castaways === entry.remaining_castaways) + 1
      return {
        ...entry,
        rank,
        roster: (entry.drafted_team || []).map(pick => contestantMap.get(String(pick?.id ?? pick))).filter(Boolean)
      }
    })
  }, [contestantMap, entries, contestants])

  async function updateWeekRanks() {
    if (!isAdmin || guestData || updatingRanks || !seasonId) return
    const input = window.prompt(`Week number to shift to (1–${episodeCount}). Current week: ${currentWeek}. This also saves the current rankings.`, String(Math.min(currentWeek + 1, episodeCount)))
    if (input === null) return
    const targetWeek = Number(input.trim())
    if (!input.trim() || !Number.isInteger(targetWeek) || targetWeek < 1 || targetWeek > episodeCount) {
      window.alert(`Enter a whole week number from 1 to ${episodeCount}.`)
      return
    }
    setUpdatingRanks(true)
    setRankMessage('')
    try {
      const { data, error } = await supabase.rpc('admin_update_week_ranks', { p_season_id: seasonId, p_target_week: targetWeek })
      if (error) throw error
      setRankSnapshot(data)
      setRankMessage(`Rankings saved. Season is now on Week ${targetWeek}.`)
      await loadLeaderboard()
    } catch (error) { setRankMessage(`Could not update ranks: ${error.message}`) }
    finally { setUpdatingRanks(false) }
  }

  return (
    <div style={{ padding: '0.75rem 0.75rem calc(6rem + env(safe-area-inset-bottom))', position: 'relative' }}>
      <img src={idolImg} alt="" aria-hidden="true" style={{ position: 'absolute', top: '-48px', right: 'calc(-104px + env(safe-area-inset-right))', width: 'clamp(200px, 46vw, 340px)', pointerEvents: 'none', transform: 'rotate(22deg)', transformOrigin: 'top right', filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.4))' }} />
      <img src={siteLogo} alt="Survivor Draft Logo" style={{ display: 'block', width: 'min(170px, 43vw)', margin: '0 auto 0.75rem' }} />
      <h1 style={{ color: 'white', textShadow: '0 2px 8px rgba(0,0,0,0.6)' }}>Leaderboard</h1>

      {loading && <p style={{ color: 'white' }}>Loading leaderboard…</p>}
      {!loading && !viewerCanSee && <div style={{ maxWidth: 620, margin: '1rem auto', padding: '1rem', borderRadius: 12, background: 'rgba(255,255,255,.9)', textAlign: 'center' }}><h2>Complete Your Draft</h2><p>Draft your five starting players before viewing the other teams.</p><p><strong>{viewerDraftCount} / {requiredDraftCount}</strong> selected</p><Link to="/castaways" style={{ display: 'inline-block', padding: '.7rem 1rem', borderRadius: 8, background: '#166534', color: 'white', fontWeight: 700 }}>Choose Castaways</Link></div>}
      {!loading && viewerCanSee && rankedEntries.length === 0 && <p style={{ color: 'white' }}>No Survivor 51 teams have been created yet.</p>}

      {viewerCanSee && rankedEntries.map(entry => (
        <article key={entry.id} onClick={() => navigate(`${prefix}/teams/${entry.id}`)} role="button" tabIndex={0} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') navigate(`${prefix}/teams/${entry.id}`) }} style={{ marginBottom: '0.6rem', border: entry.rank === 1 ? '2px solid #d4af37' : '1px solid #ddd', padding: '0.6rem', borderRadius: '10px', background: 'rgba(255,255,255,0.88)', cursor: 'pointer' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
            {entry.avatar_url && <img src={entry.avatar_url} alt="" style={{ width: 42, height: 42, flex: '0 0 42px', aspectRatio: 1, borderRadius: '50%', objectFit: 'cover' }} />}
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 style={{ margin: 0, fontSize: '1.1rem', lineHeight: 1.2, overflowWrap: 'anywhere' }}>{entry.team_name}</h2>
              <p style={{ margin: '0.2rem 0 0', color: '#666', fontSize: '0.8rem' }}>{entry.player_name}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <strong style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}>{totalFor(entry)} Points</strong>
              <p style={{ margin: '0.2rem 0 0', color: '#555', fontSize: '0.85rem' }}>{ordinalPlace(entry.rank)}</p>
            </div>
          </div>
          <div className="leaderboard-roster">
            {entry.roster.length === 0 ? <span className="leaderboard-roster-empty">Draft not submitted yet</span> : entry.roster.map(c => (
              <div key={c.id} className="leaderboard-roster-player">
                <img src={c.picture_url || '/fallback.png'} alt={c.display_name || c.name} style={{ filter: c.is_eliminated ? 'grayscale(1)' : 'none' }} />
                <small title={c.display_name || c.name}>{c.display_name || c.name.split(' ')[0]}</small>
              </div>
            ))}
          </div>
          <div className="leaderboard-card-footer">
            <span className={`rank-change ${Number(rankSnapshot.changes?.[entry.id]) > 0 ? 'rank-up' : Number(rankSnapshot.changes?.[entry.id]) < 0 ? 'rank-down' : ''}`} title="Change between the last two saved week rankings" aria-label={rankSnapshot.changes?.[entry.id] == null ? 'No previous week ranking' : `Rank change: ${rankSnapshot.changes[entry.id] > 0 ? 'up' : rankSnapshot.changes[entry.id] < 0 ? 'down' : 'unchanged'} ${Math.abs(rankSnapshot.changes[entry.id])}`}>
              {rankSnapshot.changes?.[entry.id] == null ? '—' : rankSnapshot.changes[entry.id] > 0 ? `▲ +${rankSnapshot.changes[entry.id]}` : rankSnapshot.changes[entry.id] < 0 ? `▼ ${rankSnapshot.changes[entry.id]}` : '— 0'}
            </span>
            <span>{entry.team_points || 0} Tribe · +{entry.bonus_points || 0} Bonus</span>
          </div>
        </article>
      ))}
      {viewerCanSee && <div className="rank-history-entry"><Link to={`${prefix}/rank-history`}>Rank History ↗</Link></div>}
      {!guestData && isAdmin && <div className="rank-admin-actions">
        <button onClick={updateWeekRanks} disabled={updatingRanks || loading}>{updatingRanks ? 'Updating…' : 'Update week ranks'}</button>
        {rankMessage && <p role="status">{rankMessage}</p>}
      </div>}
    </div>
  )
}
