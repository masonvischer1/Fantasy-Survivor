import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

import Navbar from './components/Navbar'

import Login from './components/Login'
import Contestants from './components/contestantsGrid'
import ContestantDetail from './components/contestantDetail'
import MyTeam from './components/MyTeam'
import Teams from './components/Teams'
import CreateTeam from './components/CreateTeam'

function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loadingProfile, setLoadingProfile] = useState(true)

  // Get auth session
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
    })

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
      }
    )

    return () => listener.subscription.unsubscribe()
  }, [])

  // Fetch profile once session exists
  useEffect(() => {
    if (!session) {
      setProfile(null)
      setLoadingProfile(false)
      return
    }

    fetchProfile()
  }, [session])

  async function fetchProfile() {
    setLoadingProfile(true)

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()

    setProfile(data)
    setLoadingProfile(false)
  }

  if (loadingProfile) {
    return <div style={{ padding: '2rem' }}>Loading...</div>
  }

  return (
    <Router>
      <Navbar session={session} profile={profile} />

      <Routes>
        {/* Login */}
        <Route path="/login" element={<Login />} />

        {/* Create team required after signup */}
        <Route
          path="/create-team"
          element={
            session ? <CreateTeam /> : <Navigate to="/login" />
          }
        />

        {/* Contestants */}
        <Route
          path="/"
          element={
            session && !profile
              ? <Navigate to="/create-team" />
              : <Contestants />
          }
        />

        {/* Contestant Detail */}
        <Route
          path="/contestant/:id"
          element={
            session && !profile
              ? <Navigate to="/create-team" />
              : <ContestantDetail />
          }
        />

        {/* My Team */}
        <Route
          path="/my-team"
          element={
            session ? (
              profile ? <MyTeam /> : <Navigate to="/create-team" />
            ) : (
              <Navigate to="/login" />
            )
          }
        />

        {/* League Teams */}
        <Route
          path="/teams"
          element={
            session ? (
              profile ? <Teams /> : <Navigate to="/create-team" />
            ) : (
              <Navigate to="/login" />
            )
          }
        />
      </Routes>
    </Router>
  )
}

export default App
