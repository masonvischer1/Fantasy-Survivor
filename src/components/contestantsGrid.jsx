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
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', padding: '2rem' }}>
      {contestants.map(c => (
        <div
          key={c.id}
          onClick={() => navigate(`/contestant/${c.id}`)}
          style={{
            position: 'relative',
            width: '150px',
            cursor: 'pointer',
            textAlign: 'center'
          }}
        >
          <img
            src={c.picture_url || '/fallback.png'}
            alt={c.name}
            style={{
              width: '150px',
              height: '150px',
              objectFit: 'cover',
              borderRadius: '10px',
              border: draftedIds.includes(c.id) ? '3px solid green' : 'none',
              filter: c.is_eliminated ? 'grayscale(100%)' : 'none'  // Grey out eliminated contestants
            }}
          />

          <p style={{ marginTop: '0.5rem', fontWeight: 'bold' }}>{c.name}</p>
        </div>
      ))}
    </div>
  )
}
