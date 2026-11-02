import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { MERGE_CLOSE_AT } from '../utils/mergeWindow'

export default function MergeGate({ children, guest = false }) {
  const [allowed, setAllowed] = useState(false)
  useEffect(() => {
    let active = true
    async function check() {
      if (Date.now() >= MERGE_CLOSE_AT) { if (active) setAllowed(true); return }
      if (guest) return
      const { data: auth } = await supabase.auth.getUser()
      const { data: season } = await supabase.from('seasons').select('id, slug').in('status', ['draft', 'active', 'finale']).single()
      const { data: entry } = await supabase.from('season_entries').select('drafted_team').eq('season_id', season?.id).eq('profile_id', auth.user?.id).maybeSingle()
      if (active) setAllowed((entry?.drafted_team?.length || 0) >= 6)
    }
    check()
    const timer = setInterval(check, 10000)
    return () => { active = false; clearInterval(timer) }
  }, [guest])
  return allowed ? children : <div className="merge-locked-page">
    <div className="merge-blurred-content" inert aria-hidden="true">{children}</div>
    <div className="merge-lock-overlay">
      <section className="merge-lock-message" role="status">
        <h1>Make your merge pick</h1>
        <p>Pick your final castaway to see the leaderboard.</p>
        <p className="merge-lock-deadline">Closes Nov. 4 at 8:20 PM EST.</p>
        <Link to={guest ? '/login' : '/castaways'}>Choose castaway →</Link>
      </section>
    </div>
  </div>
}
