import React, { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useNavigate } from 'react-router-dom'

export default function ContestantsGrid() {
  const [contestants, setContestants] = useState([])
  const [draftedIds, setDraftedIds] = useState([])
  const navigate = useNavigate()

  useEffect(() => {
    fetchContestants()
    fetchDrafted()
  }, [])

  async function fetchContestants() {
    const { data, error } = await supabase.from('contestants').select('*')
    if (error) console.error(error)
    else setContestants(data)
  }

  async function fetchDrafted() {
    const user = (await supabase.auth.getUser()).data.user
    const { data } = await supabase
      .from('fantasy_teams')
      .select('contestant_id')
      .eq('user_id', user.id)

    if (data) setDraftedIds(data.map(d => d.contestant_id))
  }

  return (
    <div>
      <h1>Contestants</h1>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
        {contestants.map(c => {
          const drafted = draftedIds.includes(c.id)
          return (
            <div
              key={c.id}
              onClick={() => navigate(`/contestant/${c.id}`)}
              style={{
                cursor: 'pointer',
                border: drafted ? '3px solid green' : '1px solid #ccc',
                padding: '1rem',
                width: '150px',
                opacity: drafted ? 0.7 : 1
              }}
            >
              <img src={c.picture_url} alt={c.name} width="100%" />
              <h3>{c.name}</h3>
            </div>
          )
        })}
      </div>
    </div>
  )
}
