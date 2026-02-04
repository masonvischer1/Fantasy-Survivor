import React, { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

export default function Profile({ session }) {
  const [profile, setProfile] = useState(null)
  const [teamName, setTeamName] = useState('')
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarUrl, setAvatarUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchProfile()
  }, [])

  // Fetch current user's profile
  async function fetchProfile() {
    if (!session?.user) return
    setLoading(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('team_name, avatar_url')
      .eq('id', session.user.id)
      .single()

    if (error) console.error(error)
    else {
      setProfile(data)
      setTeamName(data.team_name || '')
      setAvatarUrl(data.avatar_url || '')
    }
    setLoading(false)
  }

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
      .update({ team_name: teamName, avatar_url: url })
      .eq('id', session.user.id)

    if (error) console.error('Update error:', error)
    else {
      alert('Profile updated successfully!')
      setAvatarUrl(url)
    }
    setSaving(false)
  }

  if (loading) return <div style={{ padding: '2rem' }}>Loading profile...</div>

  return (
    <div style={{ padding: '2rem', maxWidth: '400px', margin: '0 auto', textAlign: 'center' }}>
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
    </div>
  )
}
