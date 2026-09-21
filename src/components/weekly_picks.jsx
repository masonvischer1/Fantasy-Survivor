import { useCallback, useEffect, useMemo, useState } from 'react'
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

export default function WeeklyPicks() {
  const [season, setSeason] = useState(null)
  const [entry, setEntry] = useState(null)
  const [contestants, setContestants] = useState([])
  const [leagueEntries, setLeagueEntries] = useState([])
  const [result, setResult] = useState(null)
  const [selectedWeek, setSelectedWeek] = useState(1)
  const [isAdmin, setIsAdmin] = useState(false)
  const [adminWinnerIds, setAdminWinnerIds] = useState([])
  const [adminWinnerTeam, setAdminWinnerTeam] = useState('')
  const [adminBonus, setAdminBonus] = useState('')
  const [adminMergeWeek, setAdminMergeWeek] = useState('7')
  const [adminCurrentWeek, setAdminCurrentWeek] = useState('1')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const { data: authData } = await supabase.auth.getUser()
    const user = authData.user
    if (!user) return

    const [{ data: activeSeason, error: seasonError }, { data: account }] = await Promise.all([
      supabase.from('seasons').select('*').in('status', ['draft', 'active', 'finale']).single(),
      supabase.from('profiles').select('is_admin').eq('id', user.id).single()
    ])
    if (seasonError) return console.error(seasonError)

    const [entryResult, contestantsResult, resultData, leagueResult] = await Promise.all([
      supabase.from('season_entries').select('*').eq('season_id', activeSeason.id).eq('profile_id', user.id).single(),
      supabase.from('season_contestants').select('*').eq('season_id', activeSeason.id).order('name'),
      supabase.from('season_weekly_results').select('*').eq('season_id', activeSeason.id).eq('week', selectedWeek).maybeSingle(),
      supabase.from('season_entries').select('id, team_name, player_name, weekly_picks').eq('season_id', activeSeason.id).not('team_name', 'is', null)
    ])

    const firstError = entryResult.error || contestantsResult.error || resultData.error || leagueResult.error
    if (firstError) console.error(firstError)
    setSeason(activeSeason)
    setAdminMergeWeek(String(activeSeason.merge_week || 7))
    setAdminCurrentWeek(String(activeSeason.current_week || 1))
    setSelectedWeek(week => week || activeSeason.current_week || 1)
    setEntry(entryResult.data)
    setContestants(contestantsResult.data || [])
    setResult(resultData.data || null)
    setLeagueEntries((leagueResult.data || []).filter(item => item.weekly_picks?.[selectedWeek]))
    setIsAdmin(!!account?.is_admin)
    const winnerIds = resultData.data?.winner_original_contestant_ids || (resultData.data?.winner_original_contestant_id ? [resultData.data.winner_original_contestant_id] : [])
    setAdminWinnerIds(winnerIds.map(String))
    setAdminWinnerTeam(resultData.data?.winner_team || '')
    setAdminBonus(String(resultData.data?.bonus_points_awarded || ''))
  }, [selectedWeek])

  useEffect(() => {
    Promise.resolve().then(load)
  }, [load])

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

  async function saveCurrentWeek() {
    const currentWeek = Number(adminCurrentWeek)
    if (!season || currentWeek < 1 || currentWeek > Number(season.episode_count || 15)) return alert('Enter a valid current week.')
    setSaving(true)
    const { error } = await supabase.rpc('admin_update_current_week', { p_season_id: season.id, p_current_week: currentWeek })
    if (error) alert(error.message)
    setSaving(false)
    await load()
  }

  return (
    <div style={{ padding: 12 }}>
      <img src={siteLogo} alt="Survivor Draft Logo" style={{ display: 'block', width: 'min(180px, 46vw)', margin: '0 auto 0.75rem' }} />
      <h1 style={{ color: 'white', textAlign: 'center', textShadow: '0 2px 8px #000' }}>Weekly Picks</h1>
      <p style={{ color: 'white', textAlign: 'center', textShadow: '0 2px 8px #000' }}>Pick the tribal/individual immunity winner for this week for a chance to earn bonus points!</p>

      <div style={{ display: 'grid', gridTemplateColumns: '52px minmax(140px,220px) 52px', justifyContent: 'center', alignItems: 'center', gap: 10, margin: '1rem auto' }}>
        <button onClick={() => setSelectedWeek(w => Math.max(1, w - 1))} disabled={selectedWeek === 1} style={{ border: 0, background: 'transparent' }}><img src={leftArrowIcon} alt="Previous week" width="48" /></button>
        <div style={{ background: 'rgba(255,255,255,.9)', borderRadius: 10, padding: 12, textAlign: 'center', fontWeight: 800 }}>Week {selectedWeek}</div>
        <button onClick={() => setSelectedWeek(w => Math.min(season?.episode_count || 15, w + 1))} disabled={selectedWeek === (season?.episode_count || 15)} style={{ border: 0, background: 'transparent' }}><img src={rightArrowIcon} alt="Next week" width="48" /></button>
      </div>

      <section style={{ maxWidth: 980, margin: '0 auto', background: 'rgba(255,255,255,.9)', padding: 14, borderRadius: 12 }}>
        {currentPick ? (
          <div style={{ textAlign: 'center' }}>
            <p>Your Week {selectedWeek} pick is locked in:</p>
            <strong>{currentPickLabel || 'Unknown pick'}</strong>
          </div>
        ) : isPickOpen ? (
          <>
            <h2 style={{ marginTop: 0 }}>Make your pick</h2>
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
      </section>

      {currentPick && (
        <section style={{ maxWidth: 980, margin: '1rem auto 0' }}>
          <h2 style={{ color: 'white', textShadow: '0 2px 8px #000' }}>League picks</h2>
          {leagueEntries.length === 0 && <p style={{ color: 'white' }}>No other submitted picks yet.</p>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
            {leagueEntries.map(team => {
              const pickValue = team.weekly_picks?.[selectedWeek]
              const pick = contestantMap.get(String(pickValue))
              const pickedTribe = TRIBES.find(tribe => tribe.name === pickValue)
              const won = result?.phase === 'tribal' ? result.winner_team === pickValue : winnerIds.includes(String(pick?.id))
              return <article key={team.id} style={{ background: 'rgba(255,255,255,.9)', borderRadius: 10, padding: 10, opacity: result && !won ? .6 : 1 }}>
                <strong>{team.team_name}</strong>
                {(pick || pickedTribe) && <img src={pick?.picture_url || pickedTribe.image} alt={pick?.name || pickedTribe.name} style={{ display: 'block', width: '100%', aspectRatio: 1, objectFit: 'cover', objectPosition: 'center top', borderRadius: 8, marginTop: 8, filter: result && !won ? 'grayscale(1)' : 'none' }} />}
                <p>{pickedTribe?.name || pick?.display_name || pick?.name || 'No pick'} {won ? `· +${result.bonus_points_awarded}` : ''}</p>
              </article>
            })}
          </div>
        </section>
      )}

      {isAdmin && (
        <section style={{ maxWidth: 980, margin: '1rem auto 5rem', background: 'rgba(255,255,255,.92)', padding: 14, borderRadius: 12 }}>
          <h2>Admin: Week {selectedWeek} result</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {pickPhase === 'tribal' ? TRIBES.map(tribe => <button key={tribe.name} onClick={() => setAdminWinnerTeam(tribe.name)} style={{ background: adminWinnerTeam === tribe.name ? '#166534' : '#e5e7eb', color: adminWinnerTeam === tribe.name ? 'white' : '#111' }}>{tribe.name}</button>) : activeContestants.map(c => <button key={c.id} onClick={() => setAdminWinnerIds(ids => ids.includes(String(c.id)) ? ids.filter(id => id !== String(c.id)) : [...ids, String(c.id)])} style={{ background: adminWinnerIds.includes(String(c.id)) ? '#166534' : '#e5e7eb', color: adminWinnerIds.includes(String(c.id)) ? 'white' : '#111' }}>{c.display_name || c.name}</button>)}
          </div>
          {pickPhase === 'individual' && <label style={{ display: 'block', marginTop: 12 }}>Bonus points <input type="number" min="1" value={adminBonus} onChange={e => setAdminBonus(e.target.value)} style={{ marginLeft: 8, width: 80 }} /></label>}
          <button onClick={saveResult} disabled={saving} style={{ marginTop: 12 }}>Save result and recalculate scores</button>
          <hr style={{ margin: '1.25rem 0' }} />
          <h2>Admin: Season settings</h2>
          <label>Individual picks begin in week <input type="number" min="2" max={season?.episode_count || 15} value={adminMergeWeek} onChange={event => setAdminMergeWeek(event.target.value)} style={{ marginLeft: 8, width: 70 }} /></label>
          <p style={{ color: '#475569', fontSize: '.85rem' }}>Weeks before this use Savu/Toka tribal picks. This setting is currently Week {season?.merge_week || 7}.</p>
          <button onClick={saveSeasonSettings} disabled={saving}>Update merge week</button>
          <div style={{ marginTop: '1rem' }}>
            <label>Current season week <input type="number" min="1" max={season?.episode_count || 15} value={adminCurrentWeek} onChange={event => setAdminCurrentWeek(event.target.value)} style={{ marginLeft: 8, width: 70 }} /></label>
            <p style={{ color: '#475569', fontSize: '.85rem' }}>Saving the result for the current week advances this automatically. Use this only to correct the week.</p>
            <button onClick={saveCurrentWeek} disabled={saving}>Update current week</button>
          </div>
        </section>
      )}
    </div>
  )
}
