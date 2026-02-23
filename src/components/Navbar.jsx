import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export function TopNav({ session, profile }) {
  const navigate = useNavigate()
  const needsTeamSetup = session && (!profile?.player_name || !profile?.team_name)

  async function signOut() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <nav
      style={{
        height: 'var(--top-nav-height)',
        borderBottom: '1px solid rgba(15,23,42,0.12)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 0.9rem',
        boxSizing: 'border-box',
        backgroundColor: 'rgba(255,255,255,0.94)',
        backdropFilter: 'blur(8px)'
      }}
    >
      <span style={{ fontWeight: 700, color: '#0f172a' }}>Survivor Draft</span>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        {session && !needsTeamSetup ? (
          <>
            <Link to="/profile" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: '#0f172a' }}>
              {profile?.avatar_url && (
                <img
                  src={profile.avatar_url}
                  alt="Profile"
                  style={{ width: '34px', height: '34px', borderRadius: '50%', objectFit: 'cover' }}
                />
              )}
              <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{profile?.team_name || 'Profile'}</span>
            </Link>
            <button onClick={signOut} style={{ padding: '0.4rem 0.7rem', fontSize: '0.85rem' }}>Logout</button>
          </>
        ) : session ? (
          <>
            <Link to="/create-team" style={{ color: '#0f172a', fontWeight: 600, fontSize: '0.9rem' }}>Create Team</Link>
            <button onClick={signOut} style={{ padding: '0.4rem 0.7rem', fontSize: '0.85rem' }}>Logout</button>
          </>
        ) : (
          <Link to="/login" style={{ color: '#0f172a', fontWeight: 600 }}>Login</Link>
        )}
      </div>
    </nav>
  )
}

export function BottomNav({ session, profile }) {
  const hasCompletedInitialDraft = Array.isArray(profile?.team) && profile.team.length >= 5

  if (!session) return null

  return (
    <nav
      style={{
        height: 'var(--bottom-nav-height)',
        display: 'grid',
        gridTemplateColumns: hasCompletedInitialDraft ? 'repeat(4, 1fr)' : 'repeat(3, 1fr)',
        gap: '0.3rem',
        alignItems: 'center',
        padding: '0 0.55rem',
        boxSizing: 'border-box',
        backgroundColor: 'rgba(255,255,255,0.96)',
        borderTop: '1px solid rgba(15,23,42,0.14)',
        backdropFilter: 'blur(8px)'
      }}
    >
      <Link to="/" style={{ textAlign: 'center', fontSize: '0.78rem', color: '#0f172a', fontWeight: 600 }}>Castaways</Link>
      {hasCompletedInitialDraft && (
        <Link to="/teams" style={{ textAlign: 'center', fontSize: '0.78rem', color: '#0f172a', fontWeight: 600 }}>Leaderboard</Link>
      )}
      <Link to="/weekly-picks" style={{ textAlign: 'center', fontSize: '0.78rem', color: '#0f172a', fontWeight: 600 }}>Weekly Picks</Link>
      <Link to="/rules" style={{ textAlign: 'center', fontSize: '0.78rem', color: '#0f172a', fontWeight: 600 }}>Rules</Link>
    </nav>
  )
}

export default function Navbar({ session, profile }) {
  return (
    <>
      <TopNav session={session} profile={profile} />
      <BottomNav session={session} profile={profile} />
    </>
  )
}
