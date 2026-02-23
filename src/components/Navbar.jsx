import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

export default function Navbar({ session, profile }) {
  const navigate = useNavigate();
  const needsTeamSetup = session && (!profile?.player_name || !profile?.team_name);
  const hasCompletedInitialDraft = Array.isArray(profile?.team) && profile.team.length >= 5;

  async function signOut() {
    await supabase.auth.signOut();
    navigate('/login');
  }

  return (
    <>
      <nav
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          padding: '0.65rem 0.9rem',
          borderBottom: '1px solid rgba(15,23,42,0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
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

      {session && (
        <nav
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 110,
            display: 'grid',
            gridTemplateColumns: hasCompletedInitialDraft ? 'repeat(4, 1fr)' : 'repeat(3, 1fr)',
            gap: '0.3rem',
            padding: '0.55rem 0.55rem calc(0.55rem + env(safe-area-inset-bottom))',
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
      )}
    </>
  );
}
