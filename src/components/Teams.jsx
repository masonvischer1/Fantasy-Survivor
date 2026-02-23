import React, { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

export default function Teams() {
  const [teams, setTeams] = useState([])

  const fetchAllTeams = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, team_name, player_name, avatar_url, team, team_points, bonus_points') // 'team' is JSONB array of picks
      .order('team_points', { ascending: false })

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
    const pointsDiff = (b.team_points || 0) - (a.team_points || 0)
    if (pointsDiff !== 0) return pointsDiff
    return (a.team_name || '').localeCompare(b.team_name || '')
  })

  return (
    <div style={{ padding: '2rem' }}>
      <h1>League Teams</h1>

      {teams.length === 0 && <p>No teams yet</p>}

      {sortedTeams.map((profile, index) => {
        const teamPoints = profile.team_points || 0
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
            marginBottom: '2rem',
            border: `2px solid ${rankBorder}`,
            padding: '1rem',
            borderRadius: '8px',
            background: rankBackground
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
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

            <div style={{ textAlign: 'right' }}>
              <p style={{ margin: 0, fontWeight: 'bold', fontSize: '1.1rem' }}>
                Points: {teamPoints}
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
              gap: '1rem',
              marginTop: '1rem',
              flexWrap: 'wrap'
            }}
          >
            {profile.team?.map((c) => (
              <div key={c.id} style={{ textAlign: 'center' }}>
                <img
                  src={c.is_eliminated ? c.elimPhoto_url : c.picture_url}
                  alt={c.name}
                  style={{
                    width: '100px',
                    height: '100px',
                    objectFit: 'cover',
                    borderRadius: '8px',
                    filter: c.is_eliminated ? 'grayscale(100%)' : 'none'
                  }}
                />
                <p>{c.name}</p>
              </div>
            ))}
          </div>
        </div>
        )
      })}
    </div>
  )
}
