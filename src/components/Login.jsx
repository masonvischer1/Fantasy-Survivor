import React, { useState } from 'react'
import { supabase } from '../supabaseClient.js'
import siteLogo from '../assets/Logo.png'
import createTeamBg from '../assets/Logo - Create Team.png'

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

  return (
    <div style={{ minHeight: '100vh', padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundImage: `url(${createTeamBg})`, backgroundSize: 'cover', backgroundPosition: 'center center', backgroundAttachment: 'fixed', backgroundRepeat: 'no-repeat' }}>
      <div style={{ width: '100%', maxWidth: '420px', margin: '0 auto', background: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '1rem' }}>
      <img src={siteLogo} alt="Survivor Draft Logo" style={{ display: 'block', width: 'min(220px, 55vw)', margin: '0 auto 0.75rem auto' }} />
      <h2 style={{ marginTop: 0 }}>{isSignUp ? 'Create Account' : 'Login'}</h2>
      {error && <p style={{ color: 'red', marginTop: 0 }}>{error}</p>}

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
    </div>
  )
}

export default Login
