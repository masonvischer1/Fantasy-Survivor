import { Link, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import castawaysIcon from '../assets/castaways_icon.webp'
import leaderboardIcon from '../assets/leaderboard_icon.webp'
import weeklyIcon from '../assets/weekly_icon.png'
import rulesIcon from '../assets/rules_icon.png'

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
  const location = useLocation()
  const hasCompletedInitialDraft = Array.isArray(profile?.team) && profile.team.length >= 5

  if (!session) return null

  const tabStyle = (isActive) => ({
    display: 'inline-flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.12rem',
    color: '#0f172a',
    opacity: isActive ? 1 : 0.78
  })

  const labelStyle = {
    fontSize: '0.68rem',
    lineHeight: 1,
    fontWeight: 600
  }

  return (
    <nav
      style={{
        height: '64px',
        display: 'grid',
        gridTemplateColumns: hasCompletedInitialDraft ? 'repeat(4, 1fr)' : 'repeat(3, 1fr)',
        gap: '0.2rem',
        alignItems: 'center',
        padding: '0.2rem 0.55rem',
        margin: '0 0.6rem calc(0.5rem + env(safe-area-inset-bottom))',
        boxSizing: 'border-box',
        backgroundColor: 'rgba(255,255,255,0.78)',
        border: '1px solid rgba(15,23,42,0.16)',
        borderRadius: '16px',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 8px 22px rgba(2,6,23,0.22)',
        alignSelf: 'end'
      }}
    >
      <Link to="/" style={tabStyle(location.pathname === '/' || location.pathname.startsWith('/contestant/'))}>
        <img src={castawaysIcon} alt="" aria-hidden="true" style={{ width: '22px', height: '22px', objectFit: 'contain' }} />
        <span style={labelStyle}>Castaways</span>
      </Link>
      {hasCompletedInitialDraft && (
        <Link to="/teams" style={tabStyle(location.pathname === '/teams')}>
          <img src={leaderboardIcon} alt="" aria-hidden="true" style={{ width: '22px', height: '22px', objectFit: 'contain' }} />
          <span style={labelStyle}>Leaderboard</span>
        </Link>
      )}
      <Link to="/weekly-picks" style={tabStyle(location.pathname === '/weekly-picks')}>
        <img src={weeklyIcon} alt="" aria-hidden="true" style={{ width: '18px', height: '18px', objectFit: 'contain' }} />
        <span style={labelStyle}>Weekly Picks</span>
      </Link>
      <Link to="/rules" style={tabStyle(location.pathname === '/rules')}>
        <img src={rulesIcon} alt="" aria-hidden="true" style={{ width: '22px', height: '22px', objectFit: 'contain' }} />
        <span style={labelStyle}>Rules</span>
      </Link>
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
