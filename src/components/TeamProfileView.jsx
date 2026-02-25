import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { buildContestantMap, hydrateTeamFromContestants } from '../utils/teamHydration'
import leftArrowIcon from '../assets/arrow-left-circle.svg'
import kaloBuff from '../assets/Survivor_50_Kalo_Buff.png'
import cilaBuff from '../assets/Survivor_50_Cila_Buff.png'
import vatuBuff from '../assets/Survivor_50_Vatu_Buff.png'

const TEAM_BUFFS = {
  Kalo: kaloBuff,
  Cila: cilaBuff,
  Vatu: vatuBuff
}

export default function TeamProfileView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [contestants, setContestants] = useState([])
  const [weeklyResults, setWeeklyResults] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchAll = async () => {
    setLoading(true)
    const [
      { data: profileData, error: profileError },
      { data: contestantsData, error: contestantsError },
      { data: resultsData, error: resultsError }
    ] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, player_name, team_name, avatar_url, team, team_points, bonus_points, manual_points, total_score, weekly_picks')
        .eq('id', id)
        .single(),
      supabase
        .from('contestants')
        .select('*'),
      supabase
        .from('weekly_immunity_results')
        .select('week, phase, winner_team, winner_contestant_id, players_remaining')
    ])

    if (profileError) console.error(profileError)
    if (contestantsError) console.error(contestantsError)
    if (resultsError) console.error(resultsError)

    setProfile(profileData || null)
    setContestants(contestantsData || [])
    setWeeklyResults(resultsData || [])
    setLoading(false)
  }

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchAll()
    })

    const channel = supabase
      .channel(`team-profile-view-${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'contestants' },
        () => {
          fetchAll()
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        payload => {
          if (!payload?.new || payload?.new?.id === id) {
            fetchAll()
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'weekly_immunity_results' },
        () => {
          fetchAll()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [id])

  const contestantMap = useMemo(() => buildContestantMap(contestants), [contestants])
  const hydratedTeam = useMemo(
    () => hydrateTeamFromContestants(profile?.team, contestantMap),
    [profile?.team, contestantMap]
  )
  const currentGameDay = useMemo(() => contestants.reduce((max, c) => Math.max(max, c.elim_day || 0), 0), [contestants])
  const weeklyResultsByWeek = useMemo(() => {
    const map = new Map()
    weeklyResults.forEach(result => {
      map.set(String(result.week), result)
    })
    return map
  }, [weeklyResults])

  const getContestantPoints = contestant => {
    const basePoints = contestant?.is_eliminated
      ? Math.max(contestant?.elim_day || 0, 0)
      : Math.max(currentGameDay, 0)
    const juryVotes = Number(contestant?.jury_votes_received || 0)
    return basePoints + juryVotes
  }

  const weeklyPickRows = useMemo(() => {
    const picks = profile?.weekly_picks || {}
    return Object.entries(picks)
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([weekKey, pickedValue]) => {
        const result = weeklyResultsByWeek.get(String(weekKey))
        const resolved = !!result

        if (!resolved) {
          return {
            week: Number(weekKey),
            pickLabel: String(pickedValue),
            status: 'pending',
            bonusLabel: null
          }
        }

        if (result.phase === 'tribal') {
          const isWinner = String(pickedValue) === String(result.winner_team)
          return {
            week: Number(weekKey),
            pickLabel: String(pickedValue),
            status: isWinner ? 'winner' : 'loser',
            bonusLabel: isWinner ? '+5 Points' : null
          }
        }

        const winnerById = String(pickedValue) === String(result.winner_contestant_id)
        const winnerByName = contestants.find(c => String(c.id) === String(result.winner_contestant_id))?.name === String(pickedValue)
        const isWinner = winnerById || winnerByName
        const individualBonus = result.players_remaining || 0
        return {
          week: Number(weekKey),
          pickLabel: String(pickedValue),
          status: isWinner ? 'winner' : 'loser',
          bonusLabel: isWinner ? `+${individualBonus} Points` : null
        }
      })
  }, [contestants, profile?.weekly_picks, weeklyResultsByWeek])

  const getBuffImage = pickLabel => TEAM_BUFFS[pickLabel] || null

  if (loading) return <div style={{ padding: '1rem' }}>Loading team profile...</div>
  if (!profile) return <div style={{ padding: '1rem' }}>Team not found.</div>

  return (
    <div style={{ padding: '1rem' }}>
      <div style={{ maxWidth: '920px', margin: '0 auto', textAlign: 'center', backgroundColor: 'rgba(255,255,255,0.86)', borderRadius: '12px', padding: '1rem', backdropFilter: 'blur(2px)', position: 'relative' }}>
        <button
          onClick={() => navigate('/teams')}
          style={{
            position: 'absolute',
            top: '0.65rem',
            left: '0.65rem',
            padding: 0,
            borderRadius: '999px',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer'
          }}
          aria-label="Back to leaderboard"
        >
          <img
            src={leftArrowIcon}
            alt=""
            aria-hidden="true"
            width="44"
            height="44"
            style={{ display: 'block', filter: 'brightness(0)' }}
          />
        </button>

        <h1 style={{ marginTop: 0 }}>{profile.team_name || 'Unnamed Team'}</h1>

        <div style={{ margin: '0.75rem 0 0.5rem 0' }}>
          <img
            src={profile.avatar_url || '/fallback.png'}
            alt={profile.team_name || 'Team Avatar'}
            style={{ width: '110px', height: '110px', borderRadius: '50%', objectFit: 'cover' }}
          />
        </div>

        <p style={{ margin: '0.25rem 0 0.75rem 0', color: '#374151' }}>
          Name: <b>{profile.player_name || 'Unknown Player'}</b>
        </p>

        <p style={{ margin: '0.25rem 0', color: '#111827' }}>
          Team Points: <b>{profile.team_points || 0}</b> | Bonus Points: <b>{profile.bonus_points || 0}</b> | Total: <b>{profile.total_score || 0}</b>
        </p>

        <h2 style={{ marginTop: '1.2rem' }}>Drafted Contestants</h2>
        {hydratedTeam.length === 0 && <p>No drafted contestants.</p>}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(122px, 1fr))',
            gap: '0.6rem',
            marginTop: '0.75rem'
          }}
        >
          {hydratedTeam.map(c => (
            <div
              key={c.id}
              style={{
                border: '2px solid #9ca3af',
                borderRadius: '8px',
                padding: '0.42rem',
                background: 'rgba(255,255,255,0.88)',
                opacity: c.is_eliminated ? 0.58 : 1,
                display: 'grid',
                gridTemplateRows: '132px auto auto auto',
                alignContent: 'start'
              }}
            >
              <img
                src={
                  (c.is_eliminated
                    ? (c.elimPhoto_url || c.elim_photo_url)
                    : c.picture_url) ||
                  c.picture_url ||
                  c.elimPhoto_url ||
                  c.elim_photo_url ||
                  '/fallback.png'
                }
                alt={c.name}
                style={{
                  width: '100%',
                  height: '132px',
                  objectFit: 'cover',
                  borderRadius: '6px',
                  filter: c.is_eliminated ? 'grayscale(100%)' : 'none'
                }}
              />
              <p style={{ margin: '0.32rem 0 0 0', fontWeight: 700, fontSize: '0.86rem', minHeight: '2.1em', lineHeight: 1.1 }}>{c.name}</p>
              <p style={{ margin: '0.16rem 0 0 0', color: '#4b5563', fontSize: '0.79rem', minHeight: '1.2em' }}>{c.tribe || c.starting_tribe || '-'}</p>
              <p style={{ margin: '0.2rem 0 0 0', fontWeight: 700, fontSize: '0.82rem', minHeight: '1.2em' }}>Points: {getContestantPoints(c)}</p>
            </div>
          ))}
        </div>

        <h2 style={{ marginTop: '1.2rem' }}>Weekly Picks</h2>
        {weeklyPickRows.length === 0 && <p>No weekly picks submitted yet.</p>}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
            gap: '0.6rem',
            marginTop: '0.75rem'
          }}
        >
          {weeklyPickRows.map(row => (
            (() => {
              const buffSrc = getBuffImage(row.pickLabel)
              return (
            <div
              key={`week-${row.week}`}
              style={{
                border: '1px solid rgba(156,163,175,0.9)',
                borderRadius: '10px',
                padding: '0.5rem',
                background: row.status === 'loser' ? 'rgba(229,231,235,0.78)' : 'rgba(255,255,255,0.9)',
                opacity: row.status === 'loser' ? 0.62 : 1,
                filter: row.status === 'loser' ? 'grayscale(100%)' : 'none'
              }}
            >
              <p style={{ margin: 0, fontWeight: 700, fontSize: '0.84rem' }}>Week {row.week}</p>
              {buffSrc ? (
                <img
                  src={buffSrc}
                  alt={`${row.pickLabel} buff`}
                  style={{
                    width: '100%',
                    height: 'clamp(112px, 28vw, 156px)',
                    objectFit: 'cover',
                    borderRadius: '8px',
                    marginTop: '0.38rem'
                  }}
                />
              ) : (
                <div
                  style={{
                    width: '100%',
                    height: 'clamp(112px, 28vw, 156px)',
                    borderRadius: '8px',
                    marginTop: '0.38rem',
                    background: 'rgba(243,244,246,0.92)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#4b5563',
                    fontWeight: 700,
                    fontSize: '0.82rem'
                  }}
                >
                  {row.pickLabel}
                </div>
              )}
              <p style={{ margin: '0.38rem 0 0 0', fontWeight: 700 }}>{row.pickLabel}</p>
              {row.status === 'winner' && row.bonusLabel && (
                <p style={{ margin: '0.3rem 0 0 0', color: '#166534', fontWeight: 700, fontSize: '0.82rem' }}>{row.bonusLabel}</p>
              )}
            </div>
              )
            })()
          ))}
        </div>
      </div>
    </div>
  )
}
