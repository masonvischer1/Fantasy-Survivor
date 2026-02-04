import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function CreateTeam() {
  const [teamName, setTeamName] = useState('')
  const [file, setFile] = useState(null)
  const navigate = useNavigate()

  async function handleSave() {
    console.log('User UUID:', (await supabase.auth.getUser()).data.user.id)

    if (!teamName) return alert('Team name required')

    const user = (await supabase.auth.getUser()).data.user
    let avatarUrl = null

    // upload avatar
    if (file) {
      const filePath = `${user.id}-${Date.now()}`
      const { error } = await supabase.storage
        .from('Avatars')
        .upload(filePath, file)

      if (error) return alert(error.message)

      const { data } = supabase.storage
        .from('Avatars')
        .getPublicUrl(filePath)

      avatarUrl = data.publicUrl
    }

    const { error } = await supabase.from('profiles').insert({
      id: user.id,
      team_name: teamName,
      avatar_url: avatarUrl
    })

    if (error) {
      alert(error.message)
    } else {
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
