import React, { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

export default function MyTeam() {
  const [team, setTeam] = useState([])
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    fetchProfileAndTeam()
  }, [])

  const fetchProfileAndTeam = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Fetch profile including the team
    const { data, error } = await supabase
      .from('profiles')
      .select('team_name, avatar_url, team')
      .eq('id', user.id)
      .single()

    if (error) {
      console.error(error)
      return
    }

    setProfile(data)
    setTeam(data.team || []) // 'team' is JSONB array of drafted contestants
  }

  if (!profile) return <div>Loading profile...</div>

  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      {/* Profile header */}
      <div style={{ marginBottom: '2rem' }}>
        {profile.avatar_url && (
          <img
            src={profile.avatar_url}
            alt="Profile"
            style={{ width: '100px', borderRadius: '50%' }}
          />
        )}
        <h1 style={{ marginTop: '1rem' }}>{profile.team_name || "My Fantasy Team"}</h1>
      </div>

      {/* Team roster */}
      <h2>Your Drafted Contestants</h2>
      {team.length === 0 && <p>You haven't drafted any players yet.</p>}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '1rem',
          marginTop: '1rem'
        }}
      >
        {team.map(c => (
          <div
            key={c.id}
            style={{
              border: '2px solid gray',
              borderRadius: '8px',
              padding: '0.5rem',
              opacity: c.is_eliminated ? 0.5 : 1
            }}
          >
            <img
              src={c.is_eliminated ? c.elimPhoto_url : c.picture_url}
              alt={c.name}
              style={{ width: '100%', borderRadius: '5px' }}
            />
            <p><b>{c.name}</b></p>
            <p>{c.tribe}</p>
            <p>{c.season}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
