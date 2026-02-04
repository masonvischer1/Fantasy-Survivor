import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function ContestantsGrid() {
  const navigate = useNavigate()
  const [contestants, setContestants] = useState([])
  const [draftedIds, setDraftedIds] = useState([])

  useEffect(() => {
    fetchContestants()
    fetchDrafted()
  }, [])

  // Fetch all contestants
  async function fetchContestants() {
    const { data, error } = await supabase
      .from('contestants')
      .select('*')
      .order('name')

    if (error) console.error(error)
    else setContestants(data)
  }

  // Fetch drafted contestants for the current user
  async function fetchDrafted() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('fantasy_teams')
      .select('contestant_id')
      .eq('user_id', user.id)

    if (data) setDraftedIds(data.map(d => d.contestant_id))
  }

  return (
    <div style={{ padding: '2rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
      {contestants.map(c => {
        const isDrafted = draftedIds.includes(c.id)
        const isEliminated = c.is_eliminated

        return (
          <div
            key={c.id}
            onClick={() => navigate(`/contestant/${c.id}`)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              padding: '1rem',
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
                borderRadius: '50%',
                objectFit: 'cover',
                border: isDrafted ? '3px solid #00FF00' : '2px solid #fff'
              }}
            />
            <div style={{ flex: 1, color: 'white' }}>
              <p style={{ fontWeight: 'bold', textTransform: 'uppercase', margin: 0, fontSize: '1rem' }}>
                {c.name}
              </p>
              <p style={{ margin: '0.2rem 0', fontSize: '0.85rem', opacity: 0.8 }}>
                {c.city ? `${c.city}, ${c.state}` : ''}
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
  )
}
