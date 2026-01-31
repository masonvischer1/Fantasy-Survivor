import React, { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import { supabase } from './supabaseClient'

import Login from './components/Login'
import ContestantsGrid from './components/contestantsGrid'
import ContestantDetail from './components/contestantDetail'
import MyTeam from './components/MyTeam'

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get current session
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    // Listen for login/logout
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
      }
    )

    return () => {
      listener.subscription.unsubscribe()
    }
  }, [])

  if (loading) return <div>Loading...</div>

  // Show login if not authenticated
  if (!session) {
    return <Login />
  }

  return (
    <BrowserRouter>
      <div style={{ padding: '1rem' }}>
        {/* Navigation */}
        <nav style={{ marginBottom: '1rem' }}>
          <Link to="/">Contestants</Link>{" | "}
          <Link to="/my-team">My Team</Link>{" | "}
          <button onClick={() => supabase.auth.signOut()}>
            Logout
          </button>
        </nav>

        {/* Routes */}
        <Routes>
          <Route path="/" element={<ContestantsGrid />} />

          {/* Detail page */}
          <Route
            path="/contestant/:id"
            element={<ContestantDetail />}
          />

          {/* My fantasy team */}
          <Route path="/my-team" element={<MyTeam />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

export default App
