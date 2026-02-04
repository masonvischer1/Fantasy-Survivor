import React, { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

export default function Teams() {
  const [teams, setTeams] = useState([])

  useEffect(() => {
    fetchAllTeams()
  }, [])

  const fetchAllTeams = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, team_name, avatar_url, team') // 'team' is JSONB array of picks
      .order('team_name', { ascending: true })  // optional, alphabetical

    if (error) {
      console.error('Error fetching teams:', error)
      return
    }

    setTeams(data)
  }

  return (
    <div style={{ padding: '2rem' }}>
      <h1>League Teams</h1>

      {teams.length === 0 && <p>No teams yet</p>}

      {teams.map((profile) => (
        <div
          key={profile.id}
          style={{
            marginBottom: '2rem',
            border: '1px solid #ddd',
            padding: '1rem',
            borderRadius: '8px'
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
            <h2>{profile.team_name || 'Unnamed Team'}</h2>
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
      ))}
    </div>
  )
}
