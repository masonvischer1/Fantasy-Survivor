import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import siteLogo from '../assets/Logo.png'

export default function CreateTeam({ onTeamCreated }) {
  const [playerName, setPlayerName] = useState('')
  const [teamName, setTeamName] = useState('')
  const [file, setFile] = useState(null)
  const navigate = useNavigate()

  async function handleSave() {
    if (!playerName.trim()) return alert('Your name is required')
    if (!teamName) return alert('Team name required')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      alert('You must be logged in to create a team')
      return
    }

    let avatarUrl = null

    // upload avatar
    if (file) {
      const filePath = `${user.id}-${Date.now()}`
      const { error } = await supabase.storage
        .from('avatars')
        .upload(filePath, file)

      if (error) return alert(error.message)

      const { data } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)

      avatarUrl = data.publicUrl
    }

    const profilePayload = {
      id: user.id,
      player_name: playerName.trim(),
      team_name: teamName.trim(),
      avatar_url: avatarUrl,
      team: []
    }

    const { data, error } = await supabase
      .from('profiles')
      .upsert(profilePayload, { onConflict: 'id' })
      .select('*')
      .single()

    if (error) {
      alert(error.message)
    } else {
      if (onTeamCreated) onTeamCreated(data)
      navigate('/')
    }
  }

  return (
    <div style={{ padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: '430px', margin: '0 auto', background: 'rgba(255,255,255,0.86)', borderRadius: '12px', padding: '1rem', backdropFilter: 'blur(2px)' }}>
      <img src={siteLogo} alt="Survivor Draft Logo" style={{ display: 'block', width: 'min(220px, 55vw)', margin: '0 auto 0.75rem auto' }} />
      <h1 style={{ color: '#111827', marginTop: 0 }}>Create Your Team</h1>

      <input
        placeholder="Your Name"
        value={playerName}
        onChange={e => setPlayerName(e.target.value)}
        style={{ display: 'block', width: '100%', marginBottom: '0.75rem' }}
      />

      <input
        placeholder="Team Name"
        value={teamName}
        onChange={e => setTeamName(e.target.value)}
        style={{ display: 'block', width: '100%', marginBottom: '0.75rem' }}
      />

      <input
        type="file"
        accept="image/*"
        onChange={e => setFile(e.target.files[0])}
        style={{ display: 'block', width: '100%' }}
      />
      <p style={{ marginTop: '0.5rem', color: '#666', fontSize: '0.85rem' }}>
        Upload a profile picture so your team is recognizable in the league.
      </p>

      <button onClick={handleSave}>
        Save Team
      </button>
      </div>
    </div>
  )
}


