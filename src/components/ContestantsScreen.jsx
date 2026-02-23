import React, { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient.js'

function ContestantsScreen({ user, onPick }) {
  const [contestants, setContestants] = useState([])
  const [userPicks, setUserPicks] = useState([]) // contestant_ids already drafted
  const [loading, setLoading] = useState(true)

  // Fetch all contestants
  useEffect(() => {
    fetchContestants()
    if (user?.id) fetchUserPicks()
    else setUserPicks([])
  }, [user?.id])

  const fetchContestants = async () => {
    const { data, error } = await supabase.from('contestants').select('*').order('name', { ascending: true })
    if (error) console.error(error)
    else setContestants(data)
  }

  // Fetch the current user's picks
  const fetchUserPicks = async () => {
    if (!user?.id) {
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('fantasy_teams')
      .select('contestant_id, pick_type')
      .eq('user_id', user.id)
    if (error) console.error(error)
    else setUserPicks(data.map(p => ({ id: p.contestant_id, type: p.pick_type })))
    setLoading(false)
  }

  const handlePick = async (contestant) => {
    if (!user?.id) return
    if (userPicks.some(p => p.id === contestant.id)) return

    // Determine pick type
    const initialPicksCount = userPicks.filter(p => p.type === 'initial').length
    const mergePickExists = userPicks.some(p => p.type === 'merge')
    let pick_type = 'initial'

    if (initialPicksCount >= 5 && !mergePickExists) {
      pick_type = 'merge'
    } else if (initialPicksCount >= 5) {
      alert('You already drafted 5 contestants and your merge pick.')
      return
    }

    // Insert pick into fantasy_teams table
    const { data, error } = await supabase.from('fantasy_teams').insert([
      { user_id: user.id, contestant_id: contestant.id, pick_type }
    ])
    if (error) console.error(error)
    else {
      setUserPicks([...userPicks, { id: contestant.id, type: pick_type }])
      if (onPick) onPick(contestant, pick_type)
    }
  }

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Contestants</h1>
      {loading && <p>Loading contestants...</p>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
        {contestants.map(c => {
          const alreadyPicked = userPicks.find(p => p.id === c.id)
          return (
            <div key={c.id} style={{ border: '1px solid #ccc', padding: '1rem', borderRadius: '8px', textAlign: 'center', opacity: alreadyPicked ? 0.5 : 1 }}>
              <img src={c.picture_url} alt={c.name} style={{ width: '150px', borderRadius: '8px' }} />
              <h3>{c.name}</h3>
              <p><strong>Tribe:</strong> {c.tribe}</p>
              <p><strong>Season:</strong> {c.season}</p>
              <p>{c.bio}</p>
              <p><strong>Score:</strong> {c.score}</p>
              <button onClick={() => handlePick(c)} disabled={!!alreadyPicked}>
                {alreadyPicked ? (alreadyPicked.type === 'merge' ? 'Merge Pick' : 'Drafted') : 'Draft'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default ContestantsScreen
