import React, { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import profileBg from '../assets/sand - profile.png'
import siteLogo from '../assets/Logo.png'
import { buildContestantMap, hydrateTeamFromContestants } from '../utils/teamHydration'

export default function Profile({ session, setProfile }) {
  const [playerName, setPlayerName] = useState('')
  const [teamName, setTeamName] = useState('')
  const [team, setTeam] = useState([])
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarUrl, setAvatarUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [contestantMap, setContestantMap] = useState(new Map())
  const userId = session?.user?.id

  async function fetchContestants() {
    const { data, error } = await supabase
      .from('contestants')
      .select('id, name, picture_url, elimPhoto_url, elim_photo_url, is_eliminated, tribe, season')

    if (error) {
      console.error(error)
      return
    }

    setContestantMap(buildContestantMap(data))
  }

  async function fetchProfile() {
    if (!userId) {
      setLoading(false)
      return
    }

    setLoading(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('player_name, team_name, avatar_url, team')
      .eq('id', userId)
      .single()

    if (error) {
      console.error(error)
    } else {
      setPlayerName(data.player_name || '')
      setTeamName(data.team_name || '')
      setAvatarUrl(data.avatar_url || '')
      setTeam(Array.isArray(data.team) ? data.team : [])
    }
    setLoading(false)
  }

  useEffect(() => {
    Promise.resolve().then(async () => {
      await Promise.all([fetchProfile(), fetchContestants()])
    })

    const channel = supabase
      .channel('profile-contestant-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'contestants' },
        () => {
          fetchContestants()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

  // Handle avatar file selection
  const handleFileChange = e => {
    if (e.target.files.length > 0) setAvatarFile(e.target.files[0])
  }

  // Upload avatar to Supabase Storage and get URL
  async function uploadAvatar() {
    if (!avatarFile) return avatarUrl

    const fileExt = avatarFile.name.split('.').pop()
    const fileName = `${session.user.id}.${fileExt}`
    const filePath = `avatars/${fileName}`

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, avatarFile, { upsert: true })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      return avatarUrl
    }

    // Get public URL
    const { data } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath)

    return data.publicUrl
  }

  // Save profile updates
  const handleSave = async () => {
    setSaving(true)
    const url = await uploadAvatar()

    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: session.user.id,
        player_name: playerName,
        team_name: teamName,
        avatar_url: url,
        team
      }, { onConflict: 'id' })

    if (error) console.error('Update error:', error)
    else {
      alert('Profile updated successfully!')
      setAvatarUrl(url)
      if (typeof setProfile === 'function') {
        setProfile(prev => ({
          ...(prev || {}),
          id: session.user.id,
          player_name: playerName,
          team_name: teamName,
          avatar_url: url,
          team
        }))
      }
    }
    setSaving(false)
  }

  if (loading) return <div style={{ padding: '1rem' }}>Loading profile...</div>
  const hydratedTeam = hydrateTeamFromContestants(team, contestantMap)

  return (
    <div style={{ padding: '1rem', minHeight: '100dvh', backgroundImage: `url(${profileBg})`, backgroundSize: 'cover', backgroundPosition: 'center center', backgroundAttachment: 'fixed', backgroundRepeat: 'no-repeat' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto', textAlign: 'center', backgroundColor: 'rgba(255,255,255,0.86)', borderRadius: '12px', padding: '1rem', backdropFilter: 'blur(2px)' }}>
      <img src={siteLogo} alt="Survivor Draft Logo" style={{ display: 'block', width: 'min(220px, 55vw)', margin: '0 auto 0.75rem auto' }} />
      <h1>My Profile</h1>

      <div style={{ margin: '1rem 0' }}>
        <img
          src={avatarUrl || '/fallback.png'}
          alt="Avatar"
          style={{ width: '120px', height: '120px', borderRadius: '50%', objectFit: 'cover' }}
        />
      </div>

      <input type="file" accept="image/*" onChange={handleFileChange} />

      <div style={{ margin: '1rem 0' }}>
        <input
          type="text"
          value={playerName}
          onChange={e => setPlayerName(e.target.value)}
          placeholder="Your Name"
          style={{
            width: '100%',
            padding: '0.5rem',
            borderRadius: '5px',
            border: '1px solid #ccc',
            marginBottom: '1rem'
          }}
        />

        <input
          type="text"
          value={teamName}
          onChange={e => setTeamName(e.target.value)}
          placeholder="Team Name"
          style={{
            width: '100%',
            padding: '0.5rem',
            borderRadius: '5px',
            border: '1px solid #ccc'
          }}
        />
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          backgroundColor: '#0070f3',
          color: 'white',
          padding: '0.5rem 1rem',
          border: 'none',
          borderRadius: '5px',
          cursor: saving ? 'not-allowed' : 'pointer'
        }}
      >
        {saving ? 'Saving...' : 'Save Profile'}
      </button>

      <h2 style={{ marginTop: '1.25rem' }}>Your Drafted Contestants</h2>
      {team.length === 0 && <p>You haven't drafted any players yet.</p>}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: '0.75rem',
          marginTop: '1rem'
        }}
      >
        {hydratedTeam.map(c => (
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
                borderRadius: '5px',
                filter: c.is_eliminated ? 'grayscale(100%)' : 'none'
              }}
            />
            <p><b>{c.name}</b></p>
            <p>{c.tribe}</p>
            <p>{c.season}</p>
          </div>
        ))}
      </div>
      </div>
    </div>
  )
}


