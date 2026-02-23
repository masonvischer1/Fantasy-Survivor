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
      .from('profiles')
      .select('team')
      .eq('id', user.id)
      .single()

    if (error) console.error(error)
    else {
      const team = data?.team || []
      setUserPicks(team.map(c => ({ id: c.id, type: 'initial' })))
    }
    setLoading(false)
  }

  const handlePick = async (contestant) => {
    if (!user?.id) return
    if (userPicks.some(p => p.id === contestant.id)) return

    const { data, error: profileError } = await supabase
      .from('profiles')
      .select('team')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.error(profileError)
      return
    }

    const currentTeam = data?.team || []
    if (!Array.isArray(currentTeam)) return

    if (currentTeam.length >= 5) {
      alert('You already drafted 5 contestants.')
      return
    }

    const updatedTeam = [...currentTeam, contestant]
    const { error } = await supabase
      .from('profiles')
      .update({ team: updatedTeam })
      .eq('id', user.id)

    if (error) console.error(error)
    else {
      setUserPicks(updatedTeam.map(c => ({ id: c.id, type: 'initial' })))
      if (onPick) onPick(contestant, 'initial')
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
                {alreadyPicked ? 'Drafted' : 'Draft'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default ContestantsScreen
