import React, { useState } from 'react'
import { supabase } from '../supabaseClient.js'

const USERNAME_DOMAIN = 'survivor.local'

function usernameToEmail(username) {
  return `${username.trim().toLowerCase()}@${USERNAME_DOMAIN}`
}

function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
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

    setLoading(true)
    setError('')

    const normalizedUsername = getNormalizedUsername()
    const { error } = await supabase.auth.signUp({
      email: usernameToEmail(normalizedUsername),
      password,
      options: { data: { username: normalizedUsername } }
    })

    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    alert('Account created. Sign in with your username and password.')
    setIsSignUp(false)
  }

  const inputStyle = {
    display: 'block',
    width: '100%',
    marginBottom: '0.9rem',
    fontSize: 'clamp(1.05rem, 4.3vw, 1.25rem)',
    padding: '0.82rem 0.95rem',
    borderRadius: '12px',
    border: '1px solid #d1d5db',
    boxSizing: 'border-box'
  }

  const actionButtonStyle = {
    width: '100%',
    minHeight: '56px',
    fontSize: 'clamp(1.02rem, 4.2vw, 1.18rem)',
    borderRadius: '14px'
  }

  return (
    <div style={{ padding: '1rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: '560px', margin: '0 auto', background: 'rgba(255,255,255,0.9)', borderRadius: '16px', border: '1px solid rgba(209,213,219,0.9)', padding: 'clamp(1rem, 4vw, 1.5rem)', backdropFilter: 'blur(2px)' }}>
      <h2 style={{ marginTop: 0, marginBottom: '0.85rem', textAlign: 'center', fontSize: 'clamp(1.8rem, 7vw, 2.4rem)' }}>{isSignUp ? 'Create Account' : 'Login'}</h2>
      {error && <p style={{ color: 'red', marginTop: 0, marginBottom: '0.75rem', textAlign: 'center' }}>{error}</p>}

      <input
        type="text"
        placeholder="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        style={inputStyle}
      />

      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={inputStyle}
      />

      <div style={{ display: 'grid', gap: '0.7rem', marginTop: '0.35rem' }}>
        <button
          onClick={isSignUp ? handleSignUp : handleSignIn}
          disabled={loading}
          style={actionButtonStyle}
        >
          {loading ? (isSignUp ? 'Creating account...' : 'Signing in...') : (isSignUp ? 'Create Account' : 'Sign In')}
        </button>

        <button
          onClick={() => {
            setIsSignUp(!isSignUp)
            setError('')
          }}
          disabled={loading}
          style={actionButtonStyle}
        >
          {isSignUp ? 'Sign In Instead' : 'Create Account Instead'}
        </button>
      </div>
      </div>
    </div>
  )
}

export default Login
