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
  const [loading, setLoading] = useState(true)

  // Listen to auth state changes
  useEffect(() => {
    const getSession = async () => {
      const { data } = await supabase.auth.getSession()
      setSession(data.session)
    }

    getSession()

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  // Fetch profile when session exists
  useEffect(() => {
    const fetchProfile = async () => {
      if (!session?.user) {
        setProfile(null)
        setLoading(false)
        return
      }

      setLoading(true)
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single()

      if (error) console.error(error)
      setProfile(data)
      setLoading(false)
    }

    fetchProfile()
  }, [session])

  // Show loading screen while fetching profile
  if (loading) {
    return <div style={{ padding: '2rem' }}>Loading...</div>
  }

  // ProtectedRoute wrapper
  const ProtectedRoute = ({ children, requireProfile = false }) => {
    if (!session) return <Navigate to="/login" />
    if (requireProfile && !profile) return <Navigate to="/create-team" />
    return children
  }

  return (
    <Router>
      <Navbar session={session} profile={profile} />

      <Routes>
        {/* Login */}
        <Route path="/login" element={session ? <Navigate to="/my-team" /> : <Login />} />

        {/* Create team */}
        <Route
          path="/create-team"
          element={
            <ProtectedRoute>
              <CreateTeam />
            </ProtectedRoute>
          }
        />

        {/* Contestants grid */}
        <Route
          path="/"
          element={
            <ProtectedRoute requireProfile={false}>
              <Contestants />
            </ProtectedRoute>
          }
        />

        {/* Contestant detail */}
        <Route
          path="/contestant/:id"
          element={
            <ProtectedRoute requireProfile={false}>
              <ContestantDetail />
            </ProtectedRoute>
          }
        />

        {/* My Team */}
        <Route
          path="/my-team"
          element={
            <ProtectedRoute requireProfile={true}>
              <MyTeam />
            </ProtectedRoute>
          }
        />

        {/* League Teams */}
        <Route
          path="/teams"
          element={
            <ProtectedRoute requireProfile={true}>
              <Teams />
            </ProtectedRoute>
          }
        />

        {/* Catch-all */}
        <Route
          path="*"
          element={<Navigate to={session ? "/my-team" : "/login"} />}
        />
      </Routes>
    </Router>
  )
}

export default App
