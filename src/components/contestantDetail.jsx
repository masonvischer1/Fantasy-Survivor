import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import leftArrowIcon from '../assets/arrow-left-circle.svg'
import rightArrowIcon from '../assets/arrow-right-circle.svg'

export default function ContestantDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [contestant, setContestant] = useState(null)
  const [allContestants, setAllContestants] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [draftedIds, setDraftedIds] = useState([])
  const [isAdmin, setIsAdmin] = useState(false)
  const cardWidth = 'min(580px, calc(100vw - 200px))'
  const sideArrowOffset = '66px'

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

    const { data, error } = await supabase
      .from('profiles')
      .select('team')
      .eq('id', user.id)
      .single()

    if (error) {
      console.error(error)
      return
    }

    const team = data?.team || []
    setDraftedIds(team.map(c => c.id))
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
      alert('Player already drafted!')
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('team')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.error(profileError)
      alert("Couldn't verify your existing picks. Please try again.")
      return
    }

    const currentTeam = profileData?.team || []

    if (!Array.isArray(currentTeam)) {
      alert("Couldn't verify your existing picks. Please try again.")
      return
    }

    if (currentTeam.some(c => c.id === contestant.id)) {
      alert('Player already drafted!')
      return
    }

    if (currentTeam.length >= 5) {
      alert('You have already drafted 5 players!')
      return
    }

    const updatedTeam = [...currentTeam, contestant]
    const { error } = await supabase
      .from('profiles')
      .update({ team: updatedTeam })
      .eq('id', user.id)

    if (error) {
      console.error(error)
      alert(`Draft failed: ${error.message}`)
      return
    }

    setDraftedIds(updatedTeam.map(c => c.id))
  }

  const eliminatePlayer = async () => {
    const dayElim = prompt('Enter the day this player was eliminated (Cancel to abort)')
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
    <div style={{ padding: '0.6rem', textAlign: 'center', position: 'relative' }}>
      <button
        onClick={() => navigate(-1)}
        style={{
          position: 'fixed',
          top: 'calc(var(--top-nav-height, 56px) + 10px)',
          left: 'max(10px, env(safe-area-inset-left))',
          zIndex: 30,
          borderRadius: '12px',
          padding: '0.45rem 0.9rem',
          border: '1px solid rgba(209,213,219,0.9)',
          backgroundColor: 'rgba(255,255,255,0.92)'
        }}
      >
        Back
      </button>

      <button
        onClick={prev}
        aria-label="Previous contestant"
        style={{
          position: 'fixed',
          top: '50%',
          left: `max(10px, calc(50vw - (${cardWidth}) / 2 - ${sideArrowOffset}))`,
          transform: 'translateY(-50%)',
          width: 'clamp(42px, 10vw, 56px)',
          height: 'clamp(42px, 10vw, 56px)',
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          padding: 0,
          zIndex: 20
        }}
      >
        <img src={leftArrowIcon} alt="Previous" width="48" height="48" style={{ display: 'block', filter: 'brightness(0) invert(1) drop-shadow(0 2px 6px rgba(0,0,0,0.5))' }} />
      </button>

      <button
        onClick={next}
        aria-label="Next contestant"
        style={{
          position: 'fixed',
          top: '50%',
          right: `max(10px, calc(50vw - (${cardWidth}) / 2 - ${sideArrowOffset}))`,
          transform: 'translateY(-50%)',
          width: 'clamp(42px, 10vw, 56px)',
          height: 'clamp(42px, 10vw, 56px)',
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          padding: 0,
          zIndex: 20
        }}
      >
        <img src={rightArrowIcon} alt="Next" width="48" height="48" style={{ display: 'block', filter: 'brightness(0) invert(1) drop-shadow(0 2px 6px rgba(0,0,0,0.5))' }} />
      </button>

      <div style={{ width: cardWidth, margin: '0 auto', backgroundColor: 'rgba(255,255,255,0.86)', border: '1px solid rgba(209,213,219,0.9)', borderRadius: '12px', padding: '0.85rem', backdropFilter: 'blur(2px)', position: 'relative' }}>
        <p>Picks remaining: {Math.max(0, 5 - draftedIds.length)}</p>

        <div style={{ marginTop: '1rem' }}>
          <img
            src={contestant.picture_url || '/fallback.png'}
            alt={contestant.name}
            style={{
              width: 'min(220px, 64vw)',
              borderRadius: '10px',
              filter: contestant.is_eliminated ? 'grayscale(100%)' : 'none'
            }}
          />
          <h2>{contestant.name}</h2>
          <p><b>Season:</b> {contestant.season}</p>
          <p><b>Tribe:</b> {contestant.tribe}</p>
          <p><b>Score:</b> {contestant.score}</p>
          <p style={{ maxWidth: '600px', margin: '0.75rem auto' }}>{contestant.bio}</p>

          <button
            onClick={draftPlayer}
            disabled={draftedIds.includes(contestant.id) || contestant.is_eliminated}
            style={{
              backgroundColor: draftedIds.includes(contestant.id) || contestant.is_eliminated ? 'gray' : 'green',
              color: 'white',
              padding: '0.6rem 1.2rem',
              marginTop: '1rem',
              border: 'none',
              borderRadius: '999px',
              cursor: draftedIds.includes(contestant.id) || contestant.is_eliminated ? 'not-allowed' : 'pointer',
              fontFamily: 'Survivant, system-ui, sans-serif'
            }}
          >
            {contestant.is_eliminated ? 'Eliminated' : draftedIds.includes(contestant.id) ? 'Drafted' : 'Draft Player'}
          </button>

          {isAdmin && !contestant.is_eliminated && (
            <button
              onClick={eliminatePlayer}
              style={{
                marginTop: '0.7rem',
                backgroundColor: 'red',
                color: 'white',
                padding: '0.5rem 1rem',
                border: 'none',
                borderRadius: '999px',
                cursor: 'pointer',
                fontFamily: 'Survivant, system-ui, sans-serif'
              }}
            >
              Eliminate Player
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
