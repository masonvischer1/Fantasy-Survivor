import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function Navbar({ session, profile }) {
  const navigate = useNavigate()

  async function signOut() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <nav
      style={{
        padding: '1rem',
        borderBottom: '1px solid #ddd',
        display: 'flex',
        alignItems: 'center',
        gap: '1rem'
      }}
    >
      {/* Navigation Links */}
      <Link to="/">Contestants</Link>
      <Link to="/my-team">My Team</Link>
      <Link to="/teams">League Teams</Link>

      {/* Right Side */}
      <div
        style={{
          marginLeft: 'auto',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem'
        }}
      >
        {session && profile ? (
          <>
            {/* Inside your navbar */}
    {profile?.avatar_url && (
        <Link to="/profile">
            <img
                src={profile.avatar_url}
                alt="Profile"
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  cursor: 'pointer'
      }}
    />
  </Link>
)}

            {/* Team name */}
            <span style={{ fontWeight: 'bold' }}>
              {profile.team_name}
            </span>

            <button onClick={signOut}>
              Logout
            </button>
          </>
        ) : session ? (
          <>
            {/* Logged in but no profile yet */}
            <Link to="/create-team">Create Team</Link>
            <button onClick={signOut}>Logout</button>
          </>
        ) : (
          <Link to="/login">Login</Link>
        )}
      </div>
    </nav>
  )
}
