import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { guestPickReleaseMessage, isGuestPickWeekReleased } from '../utils/guestPickVisibility'
import { supabase } from '../supabaseClient'
import siteLogo from '../assets/51/Logo.webp'
import leftArrowIcon from '../assets/arrow-left-circle.svg'
import rightArrowIcon from '../assets/arrow-right-circle.svg'
import tokaBuff from '../assets/51/Toka.png'

const savuBuff = new URL('../assets/51/Savu.png', import.meta.url).href
const TRIBES = [
  { name: 'Savu', image: savuBuff },
  { name: 'Toka', image: tokaBuff }
]

export default function WeeklyPicks({ guestData = null }) {
  const [season, setSeason] = useState(null)
  const [entry, setEntry] = useState(null)
  const [contestants, setContestants] = useState([])
  const [leagueEntries, setLeagueEntries] = useState([])
  const [result, setResult] = useState(null)
  const [tribalResults, setTribalResults] = useState(null)
  const [selectedWeek, setSelectedWeek] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [adminWinnerIds, setAdminWinnerIds] = useState([])
  const [adminWinnerTeam, setAdminWinnerTeam] = useState('')
  const [adminBonus, setAdminBonus] = useState('')
  const [adminMergeWeek, setAdminMergeWeek] = useState('7')
  const currentSeasonWeek = useRef(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (guestData) {
      const seasonWeek = `${guestData.season.id}:${guestData.season.current_week}`
      if (currentSeasonWeek.current !== seasonWeek) {
        currentSeasonWeek.current = seasonWeek
        setSelectedWeek(Number(guestData.season.current_week || 1))
        setSeason(guestData.season)
        return
      }
      setSeason(guestData.season)
      setContestants(guestData.castaways)
      setResult(guestData.results.find(r => Number(r.week) === selectedWeek) || null)
      setTribalResults(guestData.results.filter(r => r.phase === 'tribal' && Number(r.week) < selectedWeek))
      setLeagueEntries([...guestData.teams].sort((a, b) => (a.team_name || '').localeCompare(b.team_name || '')))
      return
    }
    const { data: authData } = await supabase.auth.getUser()
    const user = authData.user
    if (!user) return

    const [{ data: activeSeason, error: seasonError }, { data: account }] = await Promise.all([
      supabase.from('seasons').select('*').in('status', ['draft', 'active', 'finale']).single(),
      supabase.from('profiles').select('is_admin').eq('id', user.id).single()
    ])
    if (seasonError) return console.error(seasonError)

    const seasonWeek = `${activeSeason.id}:${activeSeason.current_week}`
    if (currentSeasonWeek.current !== seasonWeek) {
      currentSeasonWeek.current = seasonWeek
      setSelectedWeek(Number(activeSeason.current_week || 1))
      setSeason(activeSeason)
      return
    }

    const [entryResult, contestantsResult, resultData, leagueResult, tribalResultsData] = await Promise.all([
      supabase.from('season_entries').select('*').eq('season_id', activeSeason.id).eq('profile_id', user.id).single(),
      supabase.from('season_contestants').select('*').eq('season_id', activeSeason.id).order('name'),
      supabase.from('season_weekly_results').select('*').eq('season_id', activeSeason.id).eq('week', selectedWeek).maybeSingle(),
      supabase.from('season_entries').select('id, team_name, player_name, avatar_url, weekly_picks').eq('season_id', activeSeason.id).not('team_name', 'is', null).order('team_name'),
      supabase.from('season_weekly_results').select('winner_team').eq('season_id', activeSeason.id).eq('phase', 'tribal').lt('week', selectedWeek)
    ])

    const firstError = entryResult.error || contestantsResult.error || resultData.error || leagueResult.error || tribalResultsData.error
    if (firstError) console.error(firstError)
    setSeason(activeSeason)
    setAdminMergeWeek(String(activeSeason.merge_week || 7))
    setEntry(entryResult.data)
    setContestants(contestantsResult.data || [])
    setResult(resultData.data || null)
    setTribalResults(tribalResultsData.error ? null : tribalResultsData.data || [])
    setLeagueEntries(leagueResult.data || [])
    setIsAdmin(!!account?.is_admin)
    const winnerIds = resultData.data?.winner_original_contestant_ids || (resultData.data?.winner_original_contestant_id ? [resultData.data.winner_original_contestant_id] : [])
    setAdminWinnerIds(winnerIds.map(String))
    setAdminWinnerTeam(resultData.data?.winner_team || '')
    setAdminBonus(String(resultData.data?.bonus_points_awarded || ''))
  }, [selectedWeek, guestData])

  useEffect(() => {
    Promise.resolve().then(load)
    if (guestData) return
    const channel = supabase.channel('weekly-picks-current-season')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'seasons' }, load).subscribe()
    window.addEventListener('focus', load)
    return () => { supabase.removeChannel(channel); window.removeEventListener('focus', load) }
  }, [load, guestData])

  const activeContestants = useMemo(() => contestants.filter(c => !c.is_eliminated), [contestants])
  const contestantMap = useMemo(() => new Map(contestants.map(c => [String(c.id), c])), [contestants])
  const currentPick = entry?.weekly_picks?.[selectedWeek]
  const winnerIds = (result?.winner_original_contestant_ids || []).map(String)
  const pickPhase = result?.phase || (selectedWeek < Number(season?.merge_week || 7) ? 'tribal' : 'individual')
  const picksStartWeek = Number(season?.picks_start_week || 1)
  const isBeforePickStart = selectedWeek < picksStartWeek
  const isPickOpen = !result && !isBeforePickStart
  const currentPickContestant = contestantMap.get(String(currentPick))
  const currentPickLabel = TRIBES.find(tribe => tribe.name === currentPick)?.name || currentPickContestant?.display_name || currentPickContestant?.name
  // Distribution and cards must share the same per-week visibility rule.
  const canViewLeaguePicks = guestData ? isGuestPickWeekReleased(guestData.season, selectedWeek) : !!currentPick
  const submittedPicks = canViewLeaguePicks ? leagueEntries.map(team => team.weekly_picks?.[selectedWeek]).filter(Boolean).map(String) : []
  const distributionOptions = pickPhase === 'tribal'
    ? TRIBES.map(tribe => ({ value: tribe.name, label: tribe.name }))
    : [...new Set(submittedPicks)].map(value => ({ value, label: contestantMap.get(value)?.display_name || contestantMap.get(value)?.name || 'Unknown pick' }))
  const pickDistribution = distributionOptions.map(option => ({
    ...option,
    count: submittedPicks.filter(value => value === option.value).length
  }))
  const distributionColors = ['#166534', '#2563eb', '#be123c', '#7e22ce', '#b45309', '#0e7490']
  const distributionColor = (option, index) => option.value === 'Savu' ? '#7e22ce' : option.value === 'Toka' ? '#f8e51c' : distributionColors[index % distributionColors.length]

  async function savePick(pickValue, pickLabel) {
    if (!entry || currentPick) return
    if (!window.confirm(`Lock in ${pickLabel} for Week ${selectedWeek}?`)) return
    setSaving(true)
    const { data, error } = await supabase.rpc('submit_season_weekly_pick', {
      p_season_id: season.id,
      p_week: selectedWeek,
      p_pick: String(pickValue)
    })
    if (error) alert(error.message)
    else setEntry({ ...entry, weekly_picks: data || entry.weekly_picks })
    setSaving(false)
    await load()
  }

  async function saveResult() {
    if (!season) return
    if (pickPhase === 'tribal' && !adminWinnerTeam) return alert('Choose the winning tribe.')
    if (pickPhase === 'individual' && (adminWinnerIds.length === 0 || Number(adminBonus) < 1)) return alert('Choose at least one winner and a bonus value.')
    setSaving(true)
    const { error } = await supabase.rpc('admin_set_season_weekly_result', {
      p_season_id: season.id,
      p_week: selectedWeek,
      p_phase: pickPhase,
      p_winner_team: pickPhase === 'tribal' ? adminWinnerTeam : null,
      p_winner_contestant_ids: pickPhase === 'individual' ? adminWinnerIds.map(Number) : [],
      p_players_remaining: activeContestants.length,
      p_bonus_points_awarded: pickPhase === 'tribal' ? 3 : Number(adminBonus)
    })
    if (error) alert(error.message)
    setSaving(false)
    await load()
  }

  async function saveSeasonSettings() {
    const mergeWeek = Number(adminMergeWeek)
    if (!season || mergeWeek < 2 || mergeWeek > Number(season.episode_count || 15)) return alert('Enter a valid merge week.')
    setSaving(true)
    const { error } = await supabase.rpc('admin_update_season_settings', { p_season_id: season.id, p_merge_week: mergeWeek })
    if (error) alert(error.message)
    setSaving(false)
    await load()
  }

  if (!season || selectedWeek === null) return <p style={{ color: 'white', padding: '1rem' }}>Loading weekly picks…</p>

  return (
    <div style={{ padding: '12px 12px calc(6rem + env(safe-area-inset-bottom))' }}>
      <img src={siteLogo} alt="Survivor Draft Logo" style={{ display: 'block', width: 'min(180px, 46vw)', margin: '0 auto 0.75rem' }} />
      <h1 style={{ color: 'white', textAlign: 'center', textShadow: '0 2px 8px #000' }}>Weekly Picks</h1>
      <p style={{ color: 'white', textAlign: 'center', textShadow: '0 2px 8px #000' }}>{guestData ? 'View each team’s weekly immunity pick.' : 'Pick the tribal/individual immunity winner for this week for a chance to earn bonus points!'}</p>

      <div className="weekly-week-navigation">
        <button onClick={() => setSelectedWeek(w => Math.max(1, w - 1))} disabled={selectedWeek === 1} className="weekly-week-arrow"><img src={leftArrowIcon} alt="Previous week" width="48" /></button>
        <div style={{ background: 'rgba(255,255,255,.9)', borderRadius: 10, padding: 12, textAlign: 'center', fontWeight: 800 }}>Week {selectedWeek}</div>
        <button onClick={() => setSelectedWeek(w => Math.min(season?.episode_count || 15, w + 1))} disabled={selectedWeek === (season?.episode_count || 15)} className="weekly-week-arrow"><img src={rightArrowIcon} alt="Next week" width="48" /></button>
      </div>

      {!guestData && <section style={{ maxWidth: 980, margin: '0 auto', background: 'rgba(255,255,255,.9)', padding: currentPick ? '8px 12px' : 14, borderRadius: 12 }}>
        {currentPick ? (
          <div className="weekly-locked-pick">
            <span>Week {selectedWeek} pick locked:</span>
            <strong>{currentPickLabel || 'Unknown pick'}</strong>
          </div>
        ) : isPickOpen ? (
          <>
            <h2 style={{ marginTop: 0 }}>Make your pick</h2>
            {pickPhase === 'tribal' && <details key={selectedWeek} className="weekly-tribe-breakdowns">
              <summary>View tribe breakdowns</summary>
              <div className="weekly-tribe-lists">
                {TRIBES.map(tribe => {
                  const members = activeContestants.filter(contestant => contestant.tribe?.trim().toLowerCase() === tribe.name.toLowerCase())
                  const wins = tribalResults?.filter(weeklyResult => weeklyResult.winner_team === tribe.name).length
                  return <section key={tribe.name} aria-label={`${tribe.name} surviving castaways`}>
                    <h3 className={`weekly-tribe-${tribe.name.toLowerCase()}`}>{tribe.name} <span>{members.length} remaining</span></h3>
                    <p className="weekly-tribe-wins" title={`Recorded immunity wins before Week ${selectedWeek}`}>{wins == null ? 'Wins unavailable' : `${wins} immunity ${wins === 1 ? 'win' : 'wins'}`}</p>
                    {members.length ? <ul>
                      {members.map(contestant => <li key={contestant.id}>
                        <img src={contestant.picture_url || '/fallback.png'} alt="" loading="lazy" />
                        <span>{contestant.display_name || contestant.name}</span>
                      </li>)}
                    </ul> : <p>No surviving castaways listed.</p>}
                  </section>
                })}
              </div>
            </details>}
            <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 8, justifyContent: pickPhase === 'tribal' ? 'center' : 'flex-start' }}>
              {pickPhase === 'tribal' ? TRIBES.map(tribe => (
                <button key={tribe.name} onClick={() => savePick(tribe.name, tribe.name)} disabled={saving} style={{ flex: '0 0 min(230px,42vw)', border: '1px solid #d1d5db', borderRadius: 10, padding: 8, background: 'white' }}>
                  <img src={tribe.image} alt={`${tribe.name} buff`} style={{ width: '100%', aspectRatio: 1, objectFit: 'cover', objectPosition: 'center top', borderRadius: 8 }} />
                  <strong>{tribe.name}</strong>
                </button>
              )) : activeContestants.map(contestant => (
                <button key={contestant.id} onClick={() => savePick(contestant.id, contestant.display_name || contestant.name)} disabled={saving} style={{ flex: '0 0 min(190px,58vw)', border: '1px solid #d1d5db', borderRadius: 10, padding: 8, background: 'white' }}>
                  <img src={contestant.picture_url} alt={contestant.name} style={{ width: '100%', aspectRatio: 1, objectFit: 'cover', objectPosition: 'center top', borderRadius: 8 }} />
                  <strong>{contestant.display_name || contestant.name}</strong>
                </button>
              ))}
            </div>
          </>
        ) : <div style={{ textAlign: 'center' }}><strong>{isBeforePickStart ? `Weekly Picks will begin in Week ${picksStartWeek}.` : `Week ${selectedWeek} is locked.`}</strong>{!isBeforePickStart && <p>A result has already been recorded for this week.</p>}</div>}
      </section>}

      {guestData && !canViewLeaguePicks && <p className="guest-card" style={{ maxWidth: 980, margin: '1rem auto' }} role="status">{guestPickReleaseMessage(guestData.season, selectedWeek)}</p>}

      {canViewLeaguePicks && (
        <section style={{ maxWidth: 980, margin: '1rem auto 0' }}>
          <h2 style={{ color: 'white', textShadow: '0 2px 8px #000' }}>League picks</h2>
          <div className="weekly-pick-percentages" aria-label="Percentage of submitted picks">
            {submittedPicks.length > 0 ? pickDistribution.map(option => <span key={option.value} className={option.value === 'Savu' ? 'percentage-savu' : option.value === 'Toka' ? 'percentage-toka' : 'percentage-individual'}><strong>{Math.round(option.count / submittedPicks.length * 100)}%</strong> {option.label}</span>) : <p>{isBeforePickStart ? 'Picks not open yet.' : 'No picks submitted yet.'}</p>}
            {submittedPicks.length > 0 && <div className="weekly-pick-split">
              <div className="weekly-pick-split-bar" role="img" aria-label={pickDistribution.map(option => `${option.label}: ${Math.round(option.count / submittedPicks.length * 100)}%`).join(', ')}>
                {pickDistribution.filter(option => option.count > 0).map(option => {
                  const index = pickDistribution.indexOf(option)
                  return <span key={option.value} style={{ width: `${option.count / submittedPicks.length * 100}%`, background: distributionColor(option, index) }} />
                })}
              </div>
            </div>}
          </div>
          <div className="weekly-picks-grid">
            {leagueEntries.map(team => {
              const pickValue = team.weekly_picks?.[selectedWeek]
              const pick = contestantMap.get(String(pickValue))
              const pickedTribe = TRIBES.find(tribe => tribe.name === pickValue)
              const won = result?.phase === 'tribal' ? result.winner_team === pickValue : winnerIds.includes(String(pick?.id))
              return <Link key={team.id} className="weekly-pick-card" to={`${guestData ? '/guest' : ''}/teams/${team.id}`} aria-label={`View ${team.team_name}`} style={{ background: 'rgba(255,255,255,.9)', borderRadius: 10, padding: 10, opacity: result && pickValue && !won ? .6 : 1 }}>
                <div className="weekly-pick-team">
                  {team.avatar_url ? <img src={team.avatar_url} alt="" /> : <span className="weekly-pick-avatar-placeholder" aria-hidden="true">{(team.team_name || 'T').charAt(0)}</span>}
                  <strong title={team.team_name}>{team.team_name}</strong>
                </div>
                {(pick || pickedTribe) ? <img src={pick?.picture_url || pickedTribe?.image || '/fallback.png'} alt={pick?.name || pickedTribe.name} style={{ display: 'block', width: '100%', aspectRatio: 1, objectFit: 'cover', objectPosition: 'center top', borderRadius: 8, marginTop: 8, filter: result && !won ? 'grayscale(1)' : 'none' }} /> : <div className="weekly-pick-placeholder">{pickValue ? 'Unknown pick' : 'TBD'}</div>}
                <p>{pickedTribe?.name || pick?.display_name || pick?.name || (pickValue ? 'Unknown pick' : isBeforePickStart ? 'Picks not open yet' : 'No pick submitted')} {won ? `· +${result.bonus_points_awarded}` : ''}</p>
              </Link>
            })}
          </div>
        </section>
      )}

      {isAdmin && (
        <section className="admin-panel" style={{ maxWidth: 980, margin: '1rem auto 5rem' }}>
          <h2>Admin: Week {selectedWeek} result</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {pickPhase === 'tribal' ? TRIBES.map(tribe => <button key={tribe.name} onClick={() => setAdminWinnerTeam(tribe.name)} style={{ background: adminWinnerTeam === tribe.name ? '#166534' : '#e5e7eb', color: adminWinnerTeam === tribe.name ? 'white' : '#111' }}>{tribe.name}</button>) : activeContestants.map(c => <button key={c.id} onClick={() => setAdminWinnerIds(ids => ids.includes(String(c.id)) ? ids.filter(id => id !== String(c.id)) : [...ids, String(c.id)])} style={{ background: adminWinnerIds.includes(String(c.id)) ? '#166534' : '#e5e7eb', color: adminWinnerIds.includes(String(c.id)) ? 'white' : '#111' }}>{c.display_name || c.name}</button>)}
          </div>
          {pickPhase === 'individual' && <label style={{ display: 'block', marginTop: 12 }}>Bonus points <input type="number" min="1" value={adminBonus} onChange={e => setAdminBonus(e.target.value)} style={{ marginLeft: 8, width: 80 }} /></label>}
          <button onClick={saveResult} disabled={saving} style={{ marginTop: 12 }}>Save result and recalculate scores</button>
          <hr style={{ margin: '1.25rem 0' }} />
          <h2>Admin: Season settings</h2>
          <label>Individual picks begin in week <input type="number" min="2" max={season?.episode_count || 15} value={adminMergeWeek} onChange={event => setAdminMergeWeek(event.target.value)} style={{ marginLeft: 8, width: 70 }} /></label>
          <p className="admin-panel-note">Weeks before this use Savu/Toka tribal picks. This setting is currently Week {season?.merge_week || 7}.</p>
          <button onClick={saveSeasonSettings} disabled={saving}>Update merge week</button>

        </section>
      )}
    </div>
  )
}
