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
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    fetchAllContestants()
    fetchContestant()
    fetchDrafted()
    checkAdmin()
  }, [id])

  async function fetchAllContestants() {
    const { data, error } = await supabase
      .from('contestants')
      .select('*')
      .order('name')

    if (error) console.error(error)
    else {
      setAllContestants(data)
      const index = data.findIndex(c => c.id.toString() === id)
      setCurrentIndex(index)
    }
  }

  async function fetchContestant() {
    const { data, error } = await supabase
      .from('contestants')
      .select('*')
      .eq('id', id)
      .single()

    if (error) console.error(error)
    else setContestant(data)
  }

  async function fetchDrafted() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('fantasy_teams')
      .select('contestant_id')
      .eq('user_id', user.id)

    if (data) setDraftedIds(data.map(d => d.contestant_id))
  }

  async function checkAdmin() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    if (data?.is_admin) setIsAdmin(true)
  }

  const draftPlayer = async () => {
    if (!contestant || contestant.is_eliminated) return

    if (draftedIds.includes(contestant.id)) {
      alert("Player already drafted!")
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: currentPicks } = await supabase
      .from('fantasy_teams')
      .select('*')
      .eq('user_id', user.id)

    if (!Array.isArray(currentPicks)) {
      alert("Couldn't verify your existing picks. Please try again.")
      return
    }

    if (currentPicks.length >= 5) {
      alert("You have already drafted 5 players!")
      return
    }

    const { error } = await supabase
      .from('fantasy_teams')
      .insert([{ user_id: user.id, contestant_id: contestant.id, pick_type: 'initial' }])

    if (error) console.error(error)
    else setDraftedIds([...draftedIds, contestant.id])
  }

  const eliminatePlayer = async () => {
    const dayElim = prompt("Enter the day this player was eliminated (Cancel to abort)")
    if (!dayElim) return
    const parsedDay = Number.parseInt(dayElim, 10)
    if (Number.isNaN(parsedDay)) {
      alert('Please enter a valid number for elimination day.')
      return
    }

    const { error } = await supabase
      .from('contestants')
      .update({ is_eliminated: true, elim_day: parsedDay })
      .eq('id', contestant.id)

    if (error) console.error(error)
    else {
      fetchContestant()
      alert(`${contestant.name} has been eliminated (Day ${dayElim})`)
    }
  }

  const next = () => {
    if (allContestants.length === 0) return
    const newIndex = (currentIndex + 1) % allContestants.length
    setCurrentIndex(newIndex)
    setContestant(allContestants[newIndex])
  }

  const prev = () => {
    if (allContestants.length === 0) return
    const newIndex = (currentIndex - 1 + allContestants.length) % allContestants.length
    setCurrentIndex(newIndex)
    setContestant(allContestants[newIndex])
  }

  if (!contestant) return <div>Loading contestant...</div>

  return (
    <div style={{ padding: '2rem', textAlign: 'center', position: 'relative' }}>
      <button onClick={() => navigate(-1)}>← Back</button>

      {isAdmin && !contestant.is_eliminated && (
        <button
          onClick={eliminatePlayer}
          style={{
            position: 'absolute',
            top: '2rem',
            right: '2rem',
            backgroundColor: 'red',
            color: 'white',
            padding: '0.5rem 1rem',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          Eliminate Player
        </button>
      )}

      <p>Picks remaining: {Math.max(0, 5 - draftedIds.length)}</p>

      <div style={{ marginTop: '1rem' }}>
        <img
          src={contestant.picture_url || '/fallback.png'}
          alt={contestant.name}
          style={{
            width: '250px',
            borderRadius: '10px',
            filter: contestant.is_eliminated ? 'grayscale(100%)' : 'none' // Grey out eliminated
          }}
        />
        <h2>{contestant.name}</h2>
        <p><b>Season:</b> {contestant.season}</p>
        <p><b>Tribe:</b> {contestant.tribe}</p>
        <p><b>Score:</b> {contestant.score}</p>
        <p style={{ maxWidth: '600px', margin: '1rem auto' }}>{contestant.bio}</p>

        <button
          onClick={draftPlayer}
          disabled={draftedIds.includes(contestant.id) || contestant.is_eliminated}
          style={{
            backgroundColor: draftedIds.includes(contestant.id) || contestant.is_eliminated ? 'gray' : 'green',
            color: 'white',
            padding: '0.5rem 1rem',
            marginTop: '1rem',
            border: 'none',
            borderRadius: '5px',
            cursor: draftedIds.includes(contestant.id) || contestant.is_eliminated ? 'not-allowed' : 'pointer'
          }}
        >
          {contestant.is_eliminated ? 'Eliminated' : draftedIds.includes(contestant.id) ? 'Drafted' : 'Draft Player'}
        </button>

        <div style={{ marginTop: '1rem' }}>
          <button onClick={prev}>← Prev</button>
          <button onClick={next} style={{ marginLeft: '1rem' }}>Next →</button>
        </div>
      </div>
    </div>
  )
}
