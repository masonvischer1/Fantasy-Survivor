import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function CreateTeam({ onTeamCreated }) {
  const [teamName, setTeamName] = useState('')
  const [file, setFile] = useState(null)
  const navigate = useNavigate()

  async function handleSave() {
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
      team_name: teamName,
      avatar_url: avatarUrl
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
    <div style={{ padding: '2rem' }}>
      <h1>Create Your Team</h1>

      <input
        placeholder="Team Name"
        value={teamName}
        onChange={e => setTeamName(e.target.value)}
      />

      <input
        type="file"
        accept="image/*"
        onChange={e => setFile(e.target.files[0])}
      />

      <button onClick={handleSave}>
        Save Team
      </button>
    </div>
  )
}
