import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import leftArrowIcon from '../assets/arrow-left-circle.svg'
import rightArrowIcon from '../assets/arrow-right-circle.svg'
import closeIcon from '../assets/x-circle.svg'

export default function ContestantDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [contestant, setContestant] = useState(null)
  const [allContestants, setAllContestants] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [draftedIds, setDraftedIds] = useState([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 640px)')
    const update = () => setIsMobile(mediaQuery.matches)
    update()
    mediaQuery.addEventListener('change', update)
    return () => mediaQuery.removeEventListener('change', update)
  }, [])

  const cardWidth = isMobile ? 'min(520px, calc(100vw - 116px))' : 'min(620px, calc(100vw - 220px))'
  const sideArrowOffset = isMobile ? '50px' : '90px'
  const arrowSize = isMobile ? 44 : 48

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
    <div style={{ padding: isMobile ? '0.45rem' : '0.7rem', paddingTop: isMobile ? '3.4rem' : '3rem', textAlign: 'center', position: 'relative' }}>
      <button
        onClick={() => navigate(-1)}
        aria-label="Back"
        style={{
          position: 'fixed',
          top: 'calc(var(--top-nav-height, 56px) + 8px)',
          left: isMobile ? 'max(8px, env(safe-area-inset-left))' : 'max(10px, env(safe-area-inset-left))',
          zIndex: 30,
          width: isMobile ? '42px' : '46px',
          height: isMobile ? '42px' : '46px',
          border: 'none',
          background: 'transparent',
          padding: 0,
          cursor: 'pointer'
        }}
      >
        <img
          src={closeIcon}
          alt="Back"
          width={isMobile ? 42 : 46}
          height={isMobile ? 42 : 46}
          style={{ display: 'block', filter: 'brightness(0) invert(1) drop-shadow(0 2px 6px rgba(0,0,0,0.5))' }}
        />
      </button>

      <button
        onClick={prev}
        aria-label="Previous contestant"
        style={{
          position: 'fixed',
          top: '50%',
          left: `max(${isMobile ? '4px' : '10px'}, calc(50vw - (${cardWidth}) / 2 - ${sideArrowOffset}))`,
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
        <img src={leftArrowIcon} alt="Previous" width={arrowSize} height={arrowSize} style={{ display: 'block', filter: 'brightness(0) invert(1) drop-shadow(0 2px 6px rgba(0,0,0,0.5))' }} />
      </button>

      <button
        onClick={next}
        aria-label="Next contestant"
        style={{
          position: 'fixed',
          top: '50%',
          right: `max(${isMobile ? '4px' : '10px'}, calc(50vw - (${cardWidth}) / 2 - ${sideArrowOffset}))`,
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
        <img src={rightArrowIcon} alt="Next" width={arrowSize} height={arrowSize} style={{ display: 'block', filter: 'brightness(0) invert(1) drop-shadow(0 2px 6px rgba(0,0,0,0.5))' }} />
      </button>

      <div style={{ width: cardWidth, margin: '0 auto', backgroundColor: 'rgba(255,255,255,0.86)', border: '1px solid rgba(209,213,219,0.9)', borderRadius: '12px', padding: isMobile ? '0.7rem' : '0.95rem', backdropFilter: 'blur(2px)', position: 'relative' }}>
        <p style={{ marginTop: 0, fontSize: isMobile ? '1rem' : '1.1rem' }}>Picks remaining: {Math.max(0, 5 - draftedIds.length)}</p>

        <div style={{ marginTop: isMobile ? '0.65rem' : '1rem' }}>
          <img
            src={contestant.picture_url || '/fallback.png'}
            alt={contestant.name}
            style={{
              display: 'block',
              margin: '0 auto',
              width: isMobile ? 'min(190px, 60vw)' : 'min(220px, 64vw)',
              borderRadius: '10px',
              filter: contestant.is_eliminated ? 'grayscale(100%)' : 'none'
            }}
          />
          <h2 style={{ fontSize: isMobile ? 'clamp(1.8rem, 8vw, 2.3rem)' : 'clamp(2.2rem, 6vw, 2.8rem)', margin: isMobile ? '0.6rem 0 0.4rem 0' : '0.8rem 0 0.55rem 0' }}>{contestant.name}</h2>
          <p style={{ margin: isMobile ? '0.35rem 0' : '0.45rem 0', fontSize: isMobile ? '1rem' : '1.08rem' }}><b>Season:</b> {contestant.season}</p>
          <p style={{ margin: isMobile ? '0.35rem 0' : '0.45rem 0', fontSize: isMobile ? '1rem' : '1.08rem' }}><b>Tribe:</b> {contestant.tribe}</p>
          <p style={{ margin: isMobile ? '0.35rem 0' : '0.45rem 0', fontSize: isMobile ? '1rem' : '1.08rem' }}><b>Score:</b> {contestant.score}</p>
          <p style={{ maxWidth: '600px', margin: isMobile ? '0.65rem auto' : '0.85rem auto', fontSize: isMobile ? '1.02rem' : '1.1rem', lineHeight: isMobile ? 1.45 : 1.5 }}>{contestant.bio}</p>

          <button
            onClick={draftPlayer}
            disabled={draftedIds.includes(contestant.id) || contestant.is_eliminated}
            style={{
              backgroundColor: draftedIds.includes(contestant.id) || contestant.is_eliminated ? 'gray' : 'green',
              color: 'white',
              minWidth: isMobile ? '70%' : 'auto',
              padding: isMobile ? '0.62rem 1rem' : '0.6rem 1.2rem',
              marginTop: isMobile ? '0.8rem' : '1rem',
              border: 'none',
              borderRadius: '999px',
              cursor: draftedIds.includes(contestant.id) || contestant.is_eliminated ? 'not-allowed' : 'pointer',
              fontFamily: 'Survivant, system-ui, sans-serif',
              fontSize: isMobile ? '1.05rem' : '1.1rem'
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
                minWidth: isMobile ? '70%' : 'auto',
                padding: isMobile ? '0.56rem 0.95rem' : '0.5rem 1rem',
                border: 'none',
                borderRadius: '999px',
                cursor: 'pointer',
                fontFamily: 'Survivant, system-ui, sans-serif',
                fontSize: isMobile ? '1.02rem' : '1.08rem'
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
