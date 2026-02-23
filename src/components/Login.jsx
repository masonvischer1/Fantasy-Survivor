import React, { useState } from 'react'
import { supabase } from '../supabaseClient.js'

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [teamName, setTeamName] = useState('')
  const [avatarFile, setAvatarFile] = useState(null)
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSignIn = async () => {
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) setError(error.message)
  }

  const handleSignUp = async () => {
    if (!teamName.trim()) {
      setError('Team name is required.')
      return
    }

    setLoading(true)
    setError('')

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password })
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

    let avatarUrl = null
    if (avatarFile) {
      const filePath = `${user.id}-${Date.now()}`
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, avatarFile)

      if (uploadError) {
        setLoading(false)
        setError(`Account created, but avatar upload failed: ${uploadError.message}`)
        return
      }

      const { data } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)

      avatarUrl = data.publicUrl
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        team_name: teamName.trim(),
        avatar_url: avatarUrl,
        team: []
      }, { onConflict: 'id' })

    setLoading(false)

    if (profileError) {
      setError(`Account created, but team profile setup failed: ${profileError.message}`)
      return
    }

    alert('Sign up complete. If email confirmation is enabled, confirm your email before signing in.')
    setIsSignUp(false)
    setTeamName('')
    setAvatarFile(null)
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '420px', margin: 'auto' }}>
      <h2>{isSignUp ? 'Create Account' : 'Login'}</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}

      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
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
            placeholder="Team Name"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            style={{ display: 'block', width: '100%', marginBottom: '1rem' }}
          />

          <input
            type="file"
            accept="image/*"
            onChange={(e) => setAvatarFile(e.target.files?.[0] || null)}
            style={{ display: 'block', width: '100%', marginBottom: '1rem' }}
          />
        </>
      )}

      <button
        onClick={isSignUp ? handleSignUp : handleSignIn}
        disabled={loading}
        style={{ marginRight: '1rem' }}
      >
        {loading ? (isSignUp ? 'Signing up...' : 'Signing in...') : (isSignUp ? 'Sign Up' : 'Sign In')}
      </button>

      <button
        onClick={() => {
          setIsSignUp(!isSignUp)
          setError('')
        }}
        disabled={loading}
      >
        {isSignUp ? 'Use Sign In' : 'Use Sign Up'}
      </button>
    </div>
  )
}

export default Login
