import React, { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

function ContestantsGrid({ onSelect }) {
  const [contestants, setContestants] = useState([])

  useEffect(() => {
    fetchContestants()
  }, [])

  const fetchContestants = async () => {
    const { data, error } = await supabase
      .from('contestants')
      .select('*')
      .order('name')

    if (error) console.error(error)
    else setContestants(data)
  }

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Contestants</h1>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          gap: '1rem'
        }}
      >
        {contestants.map(c => (
          <div
            key={c.id}
            onClick={() => onSelect(c, contestants)}
            style={{
              cursor: 'pointer',
              textAlign: 'center'
            }}
          >
            <img
              src={c.picture_url}
              alt={c.name}
              style={{
                width: '140px',
                height: '180px',
                objectFit: 'cover',
                borderRadius: '8px'
              }}
            />
            <p>{c.name}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export default ContestantsGrid
