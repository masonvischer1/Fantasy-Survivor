import React, { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

export default function Teams() {
  const [teams, setTeams] = useState([])

  const fetchAllTeams = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, team_name, player_name, avatar_url, team, team_points, bonus_points') // 'team' is JSONB array of picks
      .order('team_name', { ascending: true })  // optional, alphabetical

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

  const scores = teams.map(profile => ({
    id: profile.id,
    total: (profile.team_points || 0) + (profile.bonus_points || 0)
  }))
  const topScore = scores.length > 0 ? Math.max(...scores.map(s => s.total)) : null

  return (
    <div style={{ padding: '2rem' }}>
      <h1>League Teams</h1>

      {teams.length === 0 && <p>No teams yet</p>}

      {teams.map((profile) => {
        const teamPoints = profile.team_points || 0
        const bonusPoints = profile.bonus_points || 0
        const totalPoints = teamPoints + bonusPoints
        const isLeader = topScore !== null && totalPoints === topScore

        return (
        <div
          key={profile.id}
          style={{
            marginBottom: '2rem',
            border: isLeader ? '2px solid #1e8e3e' : '1px solid #ddd',
            padding: '1rem',
            borderRadius: '8px',
            background: isLeader ? '#f3fff6' : 'white'
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
                Points: {totalPoints}
              </p>
              <p style={{ margin: '0.25rem 0 0 0', color: '#0b7d2b' }}>
                +{bonusPoints} bonus points
              </p>
              {isLeader && (
                <p style={{ margin: '0.25rem 0 0 0', fontWeight: 'bold', color: '#0b7d2b' }}>
                  Leading Team
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
