import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { buildContestantMap, hydrateTeamFromContestants } from '../utils/teamHydration'
import leftArrowIcon from '../assets/arrow-left-circle.svg'
import rightArrowIcon from '../assets/arrow-right-circle.svg'
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
  const [allTeams, setAllTeams] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [contestants, setContestants] = useState([])
  const [weeklyResults, setWeeklyResults] = useState([])
  const [loading, setLoading] = useState(true)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 640px)')
    const update = () => setIsMobile(mediaQuery.matches)
    update()
    mediaQuery.addEventListener('change', update)
    return () => mediaQuery.removeEventListener('change', update)
  }, [])

  const cardWidth = isMobile ? 'min(860px, calc(100vw - 24px))' : 'min(860px, calc(100vw - 190px))'
  const arrowSize = isMobile ? 42 : 48

  const fetchAll = async () => {
    setLoading(true)
    const [
      { data: profileData, error: profileError },
      { data: teamsData, error: teamsError },
      { data: contestantsData, error: contestantsError },
      { data: resultsData, error: resultsError }
    ] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, player_name, team_name, avatar_url, team, team_points, bonus_points, manual_points, total_score, weekly_picks')
        .eq('id', id)
        .single(),
      supabase
        .from('profiles')
        .select('id, team_name, total_score, team_points, bonus_points, manual_points')
        .order('total_score', { ascending: false }),
      supabase
        .from('contestants')
        .select('*'),
      supabase
        .from('weekly_immunity_results')
        .select('week, phase, winner_team, winner_contestant_id, players_remaining')
    ])

    if (profileError) console.error(profileError)
    if (teamsError) console.error(teamsError)
    if (contestantsError) console.error(contestantsError)
    if (resultsError) console.error(resultsError)

    setProfile(profileData || null)
    const sortedTeams = [...(teamsData || [])].sort((a, b) => {
      const aTotal = a.total_score ?? ((a.team_points || 0) + (a.bonus_points || 0) + (a.manual_points || 0))
      const bTotal = b.total_score ?? ((b.team_points || 0) + (b.bonus_points || 0) + (b.manual_points || 0))
      if (bTotal !== aTotal) return bTotal - aTotal
      return (a.team_name || '').localeCompare(b.team_name || '')
    })
    setAllTeams(sortedTeams)
    setCurrentIndex(sortedTeams.findIndex(team => String(team.id) === String(id)))
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

  const nextTeam = () => {
    if (allTeams.length === 0) return
    const newIndex = (currentIndex + 1) % allTeams.length
    const nextTeamId = allTeams[newIndex]?.id
    if (nextTeamId) navigate(`/teams/${nextTeamId}`)
  }

  const prevTeam = () => {
    if (allTeams.length === 0) return
    const newIndex = (currentIndex - 1 + allTeams.length) % allTeams.length
    const prevTeamId = allTeams[newIndex]?.id
    if (prevTeamId) navigate(`/teams/${prevTeamId}`)
  }

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
    <div style={{ padding: isMobile ? '0.45rem 0.5rem' : '1rem', paddingTop: isMobile ? '2.9rem' : '2.5rem', textAlign: 'center', position: 'relative' }}>
      <div style={{ width: cardWidth, maxWidth: '100%', margin: '0 auto', textAlign: 'center', backgroundColor: 'rgba(255,255,255,0.86)', borderRadius: '12px', padding: isMobile ? '0.82rem' : '0.95rem', backdropFilter: 'blur(2px)', position: 'relative', boxSizing: 'border-box', overflow: 'hidden' }}>
      <button
        onClick={prevTeam}
        aria-label="Previous team"
        style={{
          position: 'absolute',
          top: '50%',
          left: isMobile ? '4px' : '-58px',
          transform: 'translateY(-50%)',
          width: 'clamp(42px, 10vw, 56px)',
          height: 'clamp(42px, 10vw, 56px)',
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          padding: 0,
          zIndex: 20
        }}
      >
        <img src={leftArrowIcon} alt="Previous" width={arrowSize} height={arrowSize} style={{ display: 'block', filter: 'brightness(0)' }} />
      </button>

      <button
        onClick={nextTeam}
        aria-label="Next team"
        style={{
          position: 'absolute',
          top: '50%',
          right: isMobile ? '4px' : '-58px',
          transform: 'translateY(-50%)',
          width: 'clamp(42px, 10vw, 56px)',
          height: 'clamp(42px, 10vw, 56px)',
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          padding: 0,
          zIndex: 20
        }}
      >
        <img src={rightArrowIcon} alt="Next" width={arrowSize} height={arrowSize} style={{ display: 'block', filter: 'brightness(0)' }} />
      </button>

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

        <div style={{ paddingLeft: isMobile ? '34px' : 0, paddingRight: isMobile ? '34px' : 0 }}>
        <h1 style={{ marginTop: 0 }}>{profile.team_name || 'Unnamed Team'}</h1>

        <div style={{ margin: '0.75rem 0 0.5rem 0' }}>
          <img
            src={profile.avatar_url || '/fallback.png'}
            alt={profile.team_name || 'Team Avatar'}
            style={{ width: isMobile ? '92px' : '100px', height: isMobile ? '92px' : '100px', borderRadius: '50%', objectFit: 'cover' }}
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
            gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(auto-fit, minmax(112px, 1fr))',
            gap: isMobile ? '0.48rem' : '0.52rem',
            marginTop: '0.75rem',
            paddingLeft: isMobile ? '34px' : 0,
            paddingRight: isMobile ? '34px' : 0
          }}
        >
          {hydratedTeam.map((c, index) => {
            const isLastOddCard = isMobile && hydratedTeam.length % 2 === 1 && index === hydratedTeam.length - 1
            return (
            <div
              key={c.id}
              style={{
                border: '2px solid #9ca3af',
                borderRadius: '8px',
                padding: isMobile ? '0.32rem' : '0.36rem',
                background: 'rgba(255,255,255,0.88)',
                opacity: c.is_eliminated ? 0.58 : 1,
                display: 'grid',
                gridTemplateRows: isMobile ? '96px auto auto auto' : '112px auto auto auto',
                alignContent: 'start',
                gridColumn: isLastOddCard ? '1 / -1' : 'auto',
                width: isLastOddCard ? 'min(148px, 80%)' : 'auto',
                justifySelf: isLastOddCard ? 'center' : 'stretch'
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
                  height: isMobile ? '96px' : '112px',
                  objectFit: 'cover',
                  borderRadius: '6px',
                  filter: c.is_eliminated ? 'grayscale(100%)' : 'none'
                }}
              />
              <p style={{ margin: '0.24rem 0 0 0', fontWeight: 700, fontSize: isMobile ? '0.74rem' : '0.79rem', minHeight: '2.05em', lineHeight: 1.08 }}>{c.name}</p>
              <p style={{ margin: '0.1rem 0 0 0', color: '#4b5563', fontSize: isMobile ? '0.68rem' : '0.72rem', minHeight: '1.1em' }}>{c.tribe || c.starting_tribe || '-'}</p>
              <p style={{ margin: '0.14rem 0 0 0', fontWeight: 700, fontSize: isMobile ? '0.7rem' : '0.74rem', minHeight: '1.1em' }}>Points: {getContestantPoints(c)}</p>
            </div>
            )
          })}
        </div>

        <h2 style={{ marginTop: '1.2rem' }}>Weekly Picks</h2>
        {weeklyPickRows.length === 0 && <p>No weekly picks submitted yet.</p>}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(112px, 1fr))',
            gap: '0.52rem',
            marginTop: '0.75rem',
            paddingLeft: isMobile ? '34px' : 0,
            paddingRight: isMobile ? '34px' : 0
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
                padding: '0.44rem',
                background: row.status === 'loser' ? 'rgba(229,231,235,0.78)' : 'rgba(255,255,255,0.9)',
                opacity: row.status === 'loser' ? 0.62 : 1,
                filter: row.status === 'loser' ? 'grayscale(100%)' : 'none'
              }}
            >
              <p style={{ margin: 0, fontWeight: 700, fontSize: '0.76rem' }}>Week {row.week}</p>
              {buffSrc ? (
                <img
                  src={buffSrc}
                  alt={`${row.pickLabel} buff`}
                  style={{
                    width: '100%',
                    height: 'clamp(92px, 24vw, 130px)',
                    objectFit: 'cover',
                    borderRadius: '8px',
                    marginTop: '0.3rem'
                  }}
                />
              ) : (
                <div
                  style={{
                    width: '100%',
                    height: 'clamp(92px, 24vw, 130px)',
                    borderRadius: '8px',
                    marginTop: '0.3rem',
                    background: 'rgba(243,244,246,0.92)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#4b5563',
                    fontWeight: 700,
                    fontSize: '0.74rem'
                  }}
                >
                  {row.pickLabel}
                </div>
              )}
              <p style={{ margin: '0.3rem 0 0 0', fontWeight: 700, fontSize: '0.78rem' }}>{row.pickLabel}</p>
              {row.status === 'winner' && row.bonusLabel && (
                <p style={{ margin: '0.22rem 0 0 0', color: '#166534', fontWeight: 700, fontSize: '0.74rem' }}>{row.bonusLabel}</p>
              )}
            </div>
              )
            })()
          ))}
        </div>
        </div>
      </div>
    </div>
  )
}
