import React, { useState } from 'react'
import { supabase } from '../supabaseClient.js'

function Login({ setUser }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSignIn = async () => {
    setLoading(true)
    setError('')
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) setError(error.message)
    else setUser(data.user)
  }

  const handleSignUp = async () => {
    setLoading(true)
    setError('')
    const { data, error } = await supabase.auth.signUp({ email, password })
    setLoading(false)
    if (error) setError(error.message)
    else alert('Check your email for the confirmation link!')
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '400px', margin: 'auto' }}>
      <h2>Login / Sign Up</h2>
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

      <button onClick={handleSignIn} disabled={loading} style={{ marginRight: '1rem' }}>
        {loading ? 'Signing in...' : 'Sign In'}
      </button>

      <button onClick={handleSignUp} disabled={loading}>
        {loading ? 'Signing up...' : 'Sign Up'}
      </button>
    </div>
  )
}

export default Login
