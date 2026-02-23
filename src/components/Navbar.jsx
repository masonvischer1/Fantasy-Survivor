import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

export default function Navbar({ session, profile }) {
  const navigate = useNavigate();

  async function signOut() {
    await supabase.auth.signOut();
    navigate('/login');
  }

  return (
    <nav
      style={{
        padding: '1rem',
        borderBottom: '1px solid #ddd',
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
      }}
    >
      {/* Navigation Links */}
      <Link to="/">Contestants</Link>
      <Link to="/my-team">My Team</Link>
      <Link to="/teams">League Teams</Link>
      <Link to="/weekly-picks">Weekly Picks</Link> {/* <-- Added Weekly Picks link */}

      {/* Right Side */}
      <div
        style={{
          marginLeft: 'auto',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
        }}
      >
        {session && profile ? (
          <>
            {/* Profile Avatar */}
            {profile?.avatar_url && (
              <Link to="/profile">
                <img
                  src={profile.avatar_url}
                  alt="Profile"
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    cursor: 'pointer',
                  }}
                />
              </Link>
            )}

            {/* Team name */}
            <span style={{ fontWeight: 'bold' }}>{profile.team_name}</span>

            {/* Logout */}
            <button onClick={signOut}>Logout</button>
          </>
        ) : session ? (
          <>
            <Link to="/profile">Profile</Link>
            <button onClick={signOut}>Logout</button>
          </>
        ) : (
          <Link to="/login">Login</Link>
        )}
      </div>
    </nav>
  );
}
