import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function ContestantDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [contestant, setContestant] = useState(null)
  const [allContestants, setAllContestants] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [draftedIds, setDraftedIds] = useState([])

  useEffect(() => {
    fetchContestants()
    fetchDrafted()
  }, [])

  // Load all contestants to enable next/prev
  async function fetchContestants() {
    const { data, error } = await supabase
      .from('contestants')
      .select('*')
      .order('name')

    if (error) console.error(error)
    else {
      setAllContestants(data)
      const index = data.findIndex(c => c.id.toString() === id)
      setCurrentIndex(index)
      setContestant(data[index])
    }
  }

  // Load drafted players for current user
  async function fetchDrafted() {
    const user = (await supabase.auth.getUser()).data.user
    const { data } = await supabase
      .from('fantasy_teams')
      .select('contestant_id')
      .eq('user_id', user.id)

    if (data) setDraftedIds(data.map(d => d.contestant_id))
  }

  // Draft current contestant
  const draftPlayer = async () => {
    if (draftedIds.includes(contestant.id)) {
      alert("Player already drafted!")
      return
    }

    const user = (await supabase.auth.getUser()).data.user

    // Check current picks
    const { data: currentPicks, error: fetchError } = await supabase
      .from('fantasy_teams')
      .select('*')
      .eq('user_id', user.id)

    if (fetchError) {
      console.error(fetchError)
      return
    }

    if (currentPicks.length >= 5) {
      alert("You have already drafted 5 players!")
      return
    }

    // Insert new pick
    const { error } = await supabase
      .from('fantasy_teams')
      .insert([
        {
          user_id: user.id,
          contestant_id: contestant.id,
          pick_type: 'initial'
        }
      ])

    if (error) console.error(error)
    else {
      alert(`${contestant.name} added to your team!`)
      setDraftedIds([...draftedIds, contestant.id])
    }
  }

  const next = () => {
    const newIndex = (currentIndex + 1) % allContestants.length
    setCurrentIndex(newIndex)
    setContestant(allContestants[newIndex])
  }

  const prev = () => {
    const newIndex =
      (currentIndex - 1 + allContestants.length) % allContestants.length
    setCurrentIndex(newIndex)
    setContestant(allContestants[newIndex])
  }

  if (!contestant) return <div>Loading contestant...</div>

  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <button onClick={() => navigate(-1)}>← Back</button>

      <p>
        Picks remaining: {Math.max(0, 5 - draftedIds.length)}
      </p>

      <div style={{ marginTop: '1rem' }}>
        <img
          src={contestant.picture_url}
          alt={contestant.name}
          style={{ width: '250px', borderRadius: '10px' }}
        />
        <h2>{contestant.name}</h2>
        <p><b>Season:</b> {contestant.season}</p>
        <p><b>Tribe:</b> {contestant.tribe}</p>
        <p><b>Score:</b> {contestant.score}</p>
        <p style={{ maxWidth: '600px', margin: '1rem auto' }}>
          {contestant.bio}
        </p>

        <button
          onClick={draftPlayer}
          disabled={draftedIds.includes(contestant.id)}
          style={{
            backgroundColor: draftedIds.includes(contestant.id)
              ? 'gray'
              : 'green',
            color: 'white',
            padding: '0.5rem 1rem',
            marginTop: '1rem',
            border: 'none',
            borderRadius: '5px',
            cursor: draftedIds.includes(contestant.id) ? 'not-allowed' : 'pointer'
          }}
        >
          {draftedIds.includes(contestant.id) ? 'Drafted' : 'Draft Player'}
        </button>

        <div style={{ marginTop: '1rem' }}>
          <button onClick={prev}>← Prev</button>
          <button onClick={next} style={{ marginLeft: '1rem' }}>
            Next →
          </button>
        </div>
      </div>
    </div>
  )
}
