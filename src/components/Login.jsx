import React, { useState } from 'react'
import { supabase } from '../supabaseClient.js'

const USERNAME_DOMAIN = 'survivor.local'

function usernameToEmail(username) {
  return `${username.trim().toLowerCase()}@${USERNAME_DOMAIN}`
}

function Login({ onProfileCreated }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [playerName, setPlayerName] = useState('')
  const [teamName, setTeamName] = useState('')
  const [avatarFile, setAvatarFile] = useState(null)
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const getNormalizedUsername = () => username.trim().toLowerCase()

  const validateUsername = () => {
    const normalized = getNormalizedUsername()
    if (!normalized) return 'Username is required.'
    if (!/^[a-z0-9_]{3,20}$/.test(normalized)) {
      return 'Username must be 3-20 chars and use only letters, numbers, or underscores.'
    }
    return ''
  }

  const handleSignIn = async () => {
    const usernameError = validateUsername()
    if (usernameError) {
      setError(usernameError)
      return
    }

    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({
      email: usernameToEmail(getNormalizedUsername()),
      password
    })
    setLoading(false)
    if (error) setError(error.message)
  }

  const handleSignUp = async () => {
    const usernameError = validateUsername()
    if (usernameError) {
      setError(usernameError)
      return
    }

    if (!playerName.trim()) {
      setError('Your name is required.')
      return
    }

    if (!teamName.trim()) {
      setError('Team name is required.')
      return
    }

    setLoading(true)
    setError('')

    const normalizedUsername = getNormalizedUsername()
    const internalEmail = usernameToEmail(normalizedUsername)
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: internalEmail,
      password,
      options: {
        data: {
          username: normalizedUsername,
          player_name: playerName.trim(),
          team_name: teamName.trim()
        }
      }
    })
    if (signUpError) {
      setLoading(false)
      setError(signUpError.message)
      return
    }

    const user = signUpData?.user
    if (!user) {
      setLoading(false)
      setError('Sign up succeeded, but no user was returned. Please try signing in.')
      return
    }

    // Ensure we have an authenticated session before writing profile/storage data.
    if (!signUpData?.session) {
      const { error: signInAfterSignUpError } = await supabase.auth.signInWithPassword({
        email: internalEmail,
        password
      })
      if (signInAfterSignUpError) {
        setLoading(false)
        setError(`Account created, but automatic sign-in failed: ${signInAfterSignUpError.message}`)
        return
      }
    }

    let avatarUrl = null
    let avatarWarning = ''
    if (avatarFile) {
      const filePath = `${user.id}-${Date.now()}`
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, avatarFile)

      if (uploadError) {
        avatarWarning = ` Avatar upload failed: ${uploadError.message}`
      } else {
        const { data } = supabase.storage
          .from('avatars')
          .getPublicUrl(filePath)
        avatarUrl = data.publicUrl
      }
    }

    const profilePayload = {
      id: user.id,
      player_name: playerName.trim(),
      team_name: teamName.trim(),
      avatar_url: avatarUrl,
      team: []
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .upsert(profilePayload, { onConflict: 'id' })

    setLoading(false)

    if (profileError) {
      setError(`Account created, but team profile setup failed: ${profileError.message}`)
      return
    }

    if (onProfileCreated) onProfileCreated(profilePayload)
    alert(`Account and profile created successfully.${avatarWarning}`)
    setIsSignUp(false)
    setUsername('')
    setPlayerName('')
    setTeamName('')
    setAvatarFile(null)
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '420px', margin: 'auto' }}>
      <h2>{isSignUp ? 'Create Account' : 'Login'}</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}

      <input
        type="text"
        placeholder="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        style={{ display: 'block', width: '100%', marginBottom: '1rem' }}
      />

      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={{ display: 'block', width: '100%', marginBottom: '1rem' }}
      />

      {isSignUp && (
        <>
          <input
            type="text"
            placeholder="Your Name"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            style={{ display: 'block', width: '100%', marginBottom: '1rem' }}
          />

          <input
            type="text"
            placeholder="Team Name"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            style={{ display: 'block', width: '100%', marginBottom: '1rem' }}
          />

          <input
            type="file"
            accept="image/*"
            onChange={(e) => setAvatarFile(e.target.files?.[0] || null)}
            style={{ display: 'block', width: '100%', marginBottom: '0.25rem' }}
          />
          <p style={{ margin: '0 0 1rem 0', fontSize: '0.85rem', color: '#666' }}>
            Upload a profile picture so your team is recognizable in the league.
          </p>
        </>
      )}

      <button
        onClick={isSignUp ? handleSignUp : handleSignIn}
        disabled={loading}
        style={{ marginRight: '1rem' }}
      >
        {loading ? (isSignUp ? 'Creating account...' : 'Signing in...') : (isSignUp ? 'Create Account' : 'Sign In')}
      </button>

      <button
        onClick={() => {
          setIsSignUp(!isSignUp)
          setError('')
        }}
        disabled={loading}
      >
        {isSignUp ? 'Sign In' : 'Create Account'}
      </button>
    </div>
  )
}

export default Login
