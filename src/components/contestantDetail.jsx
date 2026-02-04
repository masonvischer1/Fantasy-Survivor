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
  const [userProfile, setUserProfile] = useState(null)

  // Fetch contestant, all contestants, drafted picks, and admin status
  useEffect(() => {
    fetchAllContestants()
    fetchContestant()
    fetchUserProfile()
  }, [id])

  // Fetch all contestants for navigation
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

  // Fetch the current contestant
  async function fetchContestant() {
    const { data, error } = await supabase
      .from('contestants')
      .select('*')
      .eq('id', id)
      .single()

    if (error) console.error(error)
    else setContestant(data)
  }

  // Fetch current user's profile and picks
  async function fetchUserProfile() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase
      .from('profiles')
      .select('id, team, is_admin')
      .eq('id', user.id)
      .single()

    if (error) console.error(error)
    else {
      setUserProfile(data)
      setDraftedIds(data.team?.map(p => p.id) || [])
      setIsAdmin(data.is_admin || false)
    }
  }

  // Draft a player
  const draftPlayer = async () => {
    if (draftedIds.includes(contestant.id)) {
      alert("Player already drafted!")
      return
    }

    if (!userProfile) return

    const currentPicks = userProfile.team || []

    if (currentPicks.length >= 5) {
      alert("You have already drafted 5 players!")
      return
    }

    const newTeam = [
      ...currentPicks,
      {
        id: contestant.id,
        name: contestant.name,
        picture_url: contestant.picture_url,
        elimPhoto_url: contestant.elimPhoto_url,
        is_eliminated: contestant.is_eliminated || false
      }
    ]

    const { error } = await supabase
      .from('profiles')
      .update({ team: newTeam })
      .eq('id', userProfile.id)

    if (error) console.error(error)
    else {
      setUserProfile({ ...userProfile, team: newTeam })
      setDraftedIds(newTeam.map(p => p.id))
      alert(`${contestant.name} added to your team!`)
    }
  }

  // Admin eliminate logic
  const eliminatePlayer = async () => {
    const dayElim = prompt("Enter the day this player was eliminated (Cancel to abort)")
    if (!dayElim) return

    const { error } = await supabase
      .from('contestants')
      .update({
        is_eliminated: true,
        elim_day: parseInt(dayElim)
      })
      .eq('id', contestant.id)

    if (error) console.error(error)
    else {
      fetchContestant()
      alert(`${contestant.name} has been eliminated (Day ${dayElim})`)
    }
  }

  // Navigation
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
          src={contestant.is_eliminated ? contestant.elimPhoto_url : contestant.picture_url}
          alt={contestant.name}
          style={{ width: '250px', borderRadius: '10px' }}
        />
        <h2>{contestant.name}</h2>
        <p><b>Season:</b> {contestant.season}</p>
        <p><b>Tribe:</b> {contestant.tribe}</p>
        <p><b>Score:</b> {contestant.score}</p>
        <p style={{ maxWidth: '600px', margin: '1rem auto' }}>{contestant.bio}</p>

        <button
          onClick={draftPlayer}
          disabled={draftedIds.includes(contestant.id)}
          style={{
            backgroundColor: draftedIds.includes(contestant.id) ? 'gray' : 'green',
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
          <button onClick={next} style={{ marginLeft: '1rem' }}>Next →</button>
        </div>
      </div>
    </div>
  )
}
