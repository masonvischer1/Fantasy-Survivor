import React, { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useNavigate } from 'react-router-dom'

export default function ContestantsGrid() {
  const [contestants, setContestants] = useState([])
  const navigate = useNavigate()

  useEffect(() => {
    fetchContestants()
  }, [])

  async function fetchContestants() {
    const { data, error } = await supabase
      .from('contestants')
      .select('*')

    if (error) console.error(error)
    else setContestants(data)
  }

  return (
    <div>
      <h1>Contestants</h1>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
        {contestants.map(c => (
          <div
            key={c.id}
            onClick={() => navigate(`/contestant/${c.id}`)}
            style={{
              cursor: 'pointer',
              border: '1px solid #ccc',
              padding: '1rem',
              width: '150px'
            }}
          >
            <img
              src={c.picture_url}
              alt={c.name}
              width="100%"
            />

            <h3>{c.name}</h3>
          </div>
        ))}
      </div>
    </div>
  )
}
