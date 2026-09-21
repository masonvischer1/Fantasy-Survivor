import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import siteLogo from '../assets/51/Logo.webp'

export default function CreateTeam({ onTeamCreated }) {
  const [playerName, setPlayerName] = useState('')
  const [teamName, setTeamName] = useState('')
  const [file, setFile] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('player_name')
        .eq('id', data.user.id)
        .single()
      if (existingProfile?.player_name) setPlayerName(existingProfile.player_name)
    })
  }, [])

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

    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('player_name, avatar_url')
      .eq('id', user.id)
      .single()

    const resolvedPlayerName = playerName.trim() || existingProfile?.player_name
    const resolvedAvatarUrl = avatarUrl || existingProfile?.avatar_url || null

    const { error: profileError } = await supabase
      .from('profiles')
      .update({ player_name: resolvedPlayerName, avatar_url: resolvedAvatarUrl })
      .eq('id', user.id)

    const { data: activeSeason, error: seasonError } = await supabase
      .from('seasons')
      .select('id, name')
      .in('status', ['draft', 'active', 'finale'])
      .single()

    if (profileError || seasonError) return alert((profileError || seasonError).message)

    const { data, error } = await supabase
      .from('season_entries')
      .upsert({
        season_id: activeSeason.id,
        profile_id: user.id,
        player_name: resolvedPlayerName,
        team_name: teamName.trim(),
        avatar_url: resolvedAvatarUrl
      }, { onConflict: 'season_id,profile_id' })
      .select('*')
      .single()

    if (error) {
      alert(error.message)
    } else {
      if (onTeamCreated) onTeamCreated({ ...data, id: user.id, entry_id: data.id, season_name: activeSeason.name })
      navigate('/')
    }
  }

  return (
    <div style={{ padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: '430px', margin: '0 auto', background: 'rgba(255,255,255,0.86)', borderRadius: '12px', padding: '1rem', backdropFilter: 'blur(2px)' }}>
      <img src={siteLogo} alt="Survivor Draft Logo" style={{ display: 'block', width: 'min(180px, 46vw)', margin: '0 auto 0.75rem auto' }} />
      <h1 style={{ color: '#111827', marginTop: 0 }}>Create Your Survivor 51 Team</h1>

      <input
        placeholder="Your Name (returning players can reuse theirs)"
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
