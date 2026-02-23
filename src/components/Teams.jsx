import React, { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import leaderboardBg from '../assets/Island Life - Leaderboard.png'

export default function Teams() {
  const [teams, setTeams] = useState([])

  const fetchAllTeams = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, team_name, player_name, avatar_url, team, team_points, bonus_points, manual_points, total_score') // 'team' is JSONB array of picks
      .order('total_score', { ascending: false })

    if (error) {
      console.error('Error fetching teams:', error)
      return
    }

    setTeams(data)
  }

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchAllTeams()
    })
  }, [])

  const sortedTeams = [...teams].sort((a, b) => {
    const aTotal = a.total_score ?? ((a.team_points || 0) + (a.bonus_points || 0) + (a.manual_points || 0))
    const bTotal = b.total_score ?? ((b.team_points || 0) + (b.bonus_points || 0) + (b.manual_points || 0))
    const totalDiff = bTotal - aTotal
    if (totalDiff !== 0) return totalDiff
    return (a.team_name || '').localeCompare(b.team_name || '')
  })

  return (
    <div style={{ padding: '1rem', minHeight: '100dvh', backgroundImage: `url(${leaderboardBg})`, backgroundSize: 'cover', backgroundPosition: 'center center', backgroundAttachment: 'fixed', backgroundRepeat: 'no-repeat' }}>
      <h1 style={{ color: 'white', textShadow: '0 2px 8px rgba(0,0,0,0.6)' }}>Leaderboard</h1>

      {teams.length === 0 && <p style={{ color: 'white', textShadow: '0 2px 8px rgba(0,0,0,0.6)' }}>No teams yet</p>}

      {sortedTeams.map((profile, index) => {
        const teamPoints = profile.team_points || 0
        const bonusPoints = profile.bonus_points || 0
        const rank = index + 1
        const isGold = rank === 1
        const isSilver = rank === 2
        const isBronze = rank === 3
        const rankBorder = isGold ? '#d4af37' : isSilver ? '#c0c0c0' : isBronze ? '#cd7f32' : '#ddd'
        const rankBackground = isGold ? '#fff9e6' : isSilver ? '#f8f8f8' : isBronze ? '#fff4ec' : 'white'
        const rankLabel = isGold ? '1st Place' : isSilver ? '2nd Place' : isBronze ? '3rd Place' : null

        return (
        <div
          key={profile.id}
          style={{
            marginBottom: '1rem',
            border: `2px solid ${rankBorder}`,
            padding: '0.75rem',
            borderRadius: '8px',
            background: rankBackground
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            {profile.avatar_url && (
              <img
                src={profile.avatar_url}
                alt={profile.team_name || 'avatar'}
                style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  objectFit: 'cover'
                }}
              />
            )}
            <div style={{ flex: 1 }}>
              <h2 style={{ margin: 0 }}>{profile.team_name || 'Unnamed Team'}</h2>
              <p style={{ margin: '0.25rem 0 0 0', color: '#666' }}>
                {profile.player_name || 'Unknown Player'}
              </p>
            </div>

            <div style={{ textAlign: 'right', marginLeft: 'auto' }}>
              <p style={{ margin: 0, fontWeight: 'bold', fontSize: '1.1rem' }}>
                Points: {teamPoints}
              </p>
              <p style={{ margin: '0.25rem 0 0 0', color: '#0b7d2b' }}>
                +{bonusPoints} bonus points
              </p>
              {rankLabel && (
                <p style={{ margin: '0.25rem 0 0 0', fontWeight: 'bold', color: '#555' }}>
                  {rankLabel}
                </p>
              )}
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              gap: '0.35rem',
              marginTop: '0.75rem',
              flexWrap: 'nowrap',
              overflowX: 'auto',
              paddingBottom: '0.25rem'
            }}
          >
            {profile.team?.map((c) => (
              <div key={c.id} style={{ textAlign: 'center', width: '54px', flex: '0 0 auto' }}>
                <img
                  src={c.is_eliminated ? c.elimPhoto_url : c.picture_url}
                  alt={c.name}
                  style={{
                    width: '46px',
                    height: '46px',
                    objectFit: 'cover',
                    borderRadius: '6px',
                    filter: c.is_eliminated ? 'grayscale(100%)' : 'none'
                  }}
                />
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.62rem', lineHeight: '1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</p>
              </div>
            ))}
          </div>
        </div>
        )
      })}
    </div>
  )
}
