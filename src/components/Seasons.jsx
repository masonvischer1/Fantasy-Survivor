import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import siteLogo from '../assets/51/Logo.webp'

export default function Seasons() {
  const [seasons, setSeasons] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    async function loadSeasons() {
      const { data, error: loadError } = await supabase
        .from('seasons')
        .select('id, slug, name, season_number, status, episode_count')
        .eq('status', 'archived')
        .order('season_number', { ascending: false })

      if (!active) return
      if (loadError) setError(loadError.message)
      else setSeasons(data || [])
      setLoading(false)
    }

    loadSeasons()
    return () => { active = false }
  }, [])

  return (
    <div style={{ padding: '1rem 1rem 6rem' }}>
      <div style={{ width: 'min(820px, 100%)', margin: '0 auto' }}>
        <img src={siteLogo} alt="Survivor Draft Logo" style={{ display: 'block', width: 'min(190px, 48vw)', margin: '0 auto 0.75rem' }} />
        <div style={{ background: 'rgba(255,255,255,0.88)', border: '1px solid rgba(229,231,235,0.9)', borderRadius: '16px', padding: 'clamp(1rem, 4vw, 1.5rem)', backdropFilter: 'blur(4px)', boxShadow: '0 12px 28px rgba(15,23,42,0.18)' }}>
          <h1 style={{ textAlign: 'center', margin: '0 0 0.35rem' }}>Previous Seasons</h1>
          <p style={{ textAlign: 'center', margin: '0 0 1.25rem', color: '#475569' }}>Revisit final standings, drafted tribes, weekly picks, and finale wagers.</p>

          {loading && <p style={{ textAlign: 'center' }}>Loading seasons...</p>}
          {error && <p style={{ textAlign: 'center', color: '#b91c1c' }}>Unable to load previous seasons: {error}</p>}
          {!loading && !error && seasons.length === 0 && <p style={{ textAlign: 'center' }}>No archived seasons yet.</p>}

          <div style={{ display: 'grid', gap: '0.9rem' }}>
            {seasons.map(season => (
              <Link
                key={season.id}
                to={`/seasons/${season.slug}`}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '1rem', borderRadius: '14px', border: '2px solid #d4af37', background: 'linear-gradient(135deg, rgba(255,251,235,0.98), rgba(255,255,255,0.94))', color: '#111827', boxShadow: '0 6px 16px rgba(15,23,42,0.1)' }}
              >
                <div>
                  <p style={{ margin: 0, color: '#92400e', fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Archived Season</p>
                  <h2 style={{ margin: '0.15rem 0 0' }}>{season.name}</h2>
                  <p style={{ margin: '0.25rem 0 0', color: '#64748b', fontSize: '0.9rem' }}>{season.episode_count} weeks of results</p>
                </div>
                <span style={{ fontSize: '1.5rem', color: '#92400e' }} aria-hidden="true">›</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
