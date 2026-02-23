import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import castawaysBg from '../assets/Tribe Flags - Castaways.png'

export default function ContestantsGrid() {
  const navigate = useNavigate()
  const [contestants, setContestants] = useState([])
  const [draftedIds, setDraftedIds] = useState([])

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

    const { data, error } = await supabase
      .from('profiles')
      .select('team')
      .eq('id', user.id)
      .single()

    if (error) {
      console.error(error)
      return
    }

    const team = data?.team || []
    setDraftedIds(team.map(c => c.id))
  }

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchContestants()
      fetchDrafted()
    })
  }, [])

  return (
    <div style={{ padding: '1rem', minHeight: '100vh', backgroundImage: `url(${castawaysBg})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
      <h1 style={{ color: 'white', textShadow: '0 2px 8px rgba(0,0,0,0.6)', marginBottom: '0.75rem' }}>Castaways</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
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
    </div>
  )
}
