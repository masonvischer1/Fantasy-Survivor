import { Link, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import castawaysIcon from '../assets/castaways_icon.webp'
import leaderboardIcon from '../assets/leaderboard_icon.webp'
import weeklyIcon from '../assets/weekly_icon.png'
import rulesIcon from '../assets/rules_icon.png'
import accountIcon from '../assets/account-icon.webp'

export function TopNav({ session }) {
  const navigate = useNavigate()

  async function signOut() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  if (!session) return null

  return (
    <button
      onClick={signOut}
      style={{
        position: 'fixed',
        top: 'max(8px, env(safe-area-inset-top))',
        right: 'max(10px, env(safe-area-inset-right))',
        zIndex: 140,
        padding: '0.4rem 0.7rem',
        fontSize: '0.85rem'
      }}
    >
      Logout
    </button>
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
    width: '100%',
    gap: '0.12rem',
    color: '#0f172a',
    opacity: isActive ? 1 : 0.78,
    textAlign: 'center'
  })

  const labelStyle = {
    fontSize: '0.68rem',
    lineHeight: 1,
    fontWeight: 600
  }

  return (
    <nav
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 120,
        height: '64px',
        display: 'grid',
        gridTemplateColumns: hasCompletedInitialDraft ? 'repeat(5, 1fr)' : 'repeat(4, 1fr)',
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
        <img src={castawaysIcon} alt="" aria-hidden="true" style={{ width: '22px', height: '22px', objectFit: 'contain', filter: 'brightness(0)' }} />
        <span style={labelStyle}>Castaways</span>
      </Link>
      {hasCompletedInitialDraft && (
        <Link to="/teams" style={tabStyle(location.pathname === '/teams')}>
          <img src={leaderboardIcon} alt="" aria-hidden="true" style={{ width: '22px', height: '22px', objectFit: 'contain', filter: 'brightness(0)' }} />
          <span style={labelStyle}>Leaderboard</span>
        </Link>
      )}
      <Link to="/weekly-picks" style={tabStyle(location.pathname === '/weekly-picks')}>
        <img src={weeklyIcon} alt="" aria-hidden="true" style={{ width: '18px', height: '18px', objectFit: 'contain', display: 'block', margin: '0 auto' }} />
        <span style={labelStyle}>Weekly Picks</span>
      </Link>
      <Link to="/rules" style={tabStyle(location.pathname === '/rules')}>
        <img src={rulesIcon} alt="" aria-hidden="true" style={{ width: '22px', height: '22px', objectFit: 'contain' }} />
        <span style={labelStyle}>Rules</span>
      </Link>
      <Link to="/profile" style={tabStyle(location.pathname === '/profile')}>
        <img src={accountIcon} alt="" aria-hidden="true" style={{ width: '22px', height: '22px', objectFit: 'contain', filter: 'brightness(0)' }} />
        <span style={labelStyle}>My Tribe</span>
      </Link>
    </nav>
  )
}

export default function Navbar({ session, profile }) {
  return (
    <>
      <TopNav session={session} />
      <BottomNav session={session} profile={profile} />
    </>
  )
}
