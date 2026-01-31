import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function ContestantDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [contestant, setContestant] = useState(null)
  const [allContestants, setAllContestants] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    fetchContestants()
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

      // Find index of current contestant
      const index = data.findIndex(c => c.id.toString() === id)
      setCurrentIndex(index)
      setContestant(data[index])
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
