import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import siteLogo from '../assets/51/Logo.webp'

export default function ContestantsGrid() {
  const navigate = useNavigate()
  const [contestants, setContestants] = useState([])

  // Fetch all contestants
  async function fetchContestants() {
    const { data: seasonData, error: seasonError } = await supabase
      .from('seasons')
      .select('*')
      .in('status', ['draft', 'active', 'finale'])
      .single()

    if (seasonError) {
      console.error(seasonError)
      return
    }

    const { data, error } = await supabase
      .from('season_contestants')
      .select('*')
      .eq('season_id', seasonData.id)
      .order('name')

    if (error) console.error(error)
    else {
      const sorted = [...(data || [])].sort((a, b) => {
        const aElim = a.is_eliminated === true
        const bElim = b.is_eliminated === true

        if (aElim !== bElim) return aElim ? 1 : -1

        if (!aElim && !bElim) {
          return (a.name || '').localeCompare(b.name || '')
        }

        const aDay = Number(a.elim_day || 0)
        const bDay = Number(b.elim_day || 0)
        if (aDay !== bDay) return bDay - aDay
        return (a.name || '').localeCompare(b.name || '')
      })
      setContestants(sorted)
    }
  }

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchContestants()
    })

    // Keep list in sync when contestant elimination status changes elsewhere.
    const channel = supabase
      .channel('contestants-grid-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'season_contestants' },
        () => {
          fetchContestants()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return (
    <div style={{ padding: '1rem 1rem 6rem' }}>
      <img src={siteLogo} alt="Survivor Draft Logo" style={{ display: 'block', width: 'min(180px, 46vw)', margin: '0 auto 0.75rem auto' }} />
      <h1 style={{ color: 'white', textShadow: '0 2px 8px rgba(0,0,0,0.6)', marginBottom: '0.75rem' }}>Castaways</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
      {contestants.map(c => {
        const isEliminated = c.is_eliminated === true

        return (
          <div
            key={c.id}
            onClick={() => navigate(`/castaways/${c.id}`)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.75rem',
              borderRadius: '10px',
              cursor: 'pointer',
              background: 'linear-gradient(135deg, rgba(0,0,0,0.8), rgba(70,40,0,0.6))',
              border: '1px solid #fff',
              filter: isEliminated ? 'grayscale(100%)' : 'none',
              opacity: isEliminated ? 0.6 : 1
            }}
          >
            <img
              src={c.picture_url || '/fallback.png'}
              alt={c.name}
              style={{
                width: '80px',
                height: '80px',
                borderRadius: '10px',
                objectFit: 'cover',
                border: '2px solid #fff',
                objectPosition: 'center top'
              }}
            />
            <div style={{ flex: 1, color: 'white' }}>
              <p style={{ fontWeight: 'bold', textTransform: 'uppercase', margin: 0, fontSize: '1rem' }}>
                {c.name}
              </p>
              <p style={{ margin: '0.2rem 0', fontSize: '0.85rem', opacity: 0.8 }}>
                {c.age ? `Age ${c.age} · ${c.occupation}` : c.occupation || ''}
              </p>
              <span
                style={{
                  fontWeight: 'bold',
                  fontSize: '0.8rem',
                  color: '#FFD700'
                }}
              >
                Contestant Details
              </span>
            </div>
          </div>
        )
      })}
      </div>
    </div>
  )
}
