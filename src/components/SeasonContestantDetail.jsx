import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import DraftedByTeams from './DraftedByTeams'
import DetailNavigation from './DetailNavigation'
import { compareCastaways } from '../utils/detailNavigation'
import { supabase } from '../supabaseClient'

export default function SeasonContestantDetail({ guestData = null }) {
  const { id } = useParams()
  const prefix = guestData ? '/guest' : ''
  const [castaways, setCastaways] = useState([])
  const [contestant, setContestant] = useState(null)
  const [season, setSeason] = useState(null)
  const [entry, setEntry] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [eliminating, setEliminating] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true
    async function load() {
      if (guestData) {
        if (!active) return
        setContestant(guestData.castaways.find(c => String(c.id) === id) || null)
        setCastaways([...guestData.castaways].sort(compareCastaways))
        setSeason(guestData.season)
        setLoading(false)
        return
      }
      const [{ data: castaway, error }, { data: authData }] = await Promise.all([
        supabase.from('season_contestants').select('*, seasons(*)').eq('id', id).single(),
        supabase.auth.getUser()
      ])
      if (!active) return
      if (error) console.error(error)
      else {
        setContestant(castaway)
        setSeason(castaway.seasons)
        const [{ data: seasonEntry, error: entryError }, { data: cast, error: castError }, { data: account }] = await Promise.all([
          supabase.from('season_entries').select('*').eq('season_id', castaway.season_id).eq('profile_id', authData?.user?.id).single(),
          supabase.from('season_contestants').select('id, name, display_name, picture_url, is_eliminated, elimination_day').eq('season_id', castaway.season_id),
          supabase.from('profiles').select('is_admin').eq('id', authData?.user?.id).single()
        ])
        if (!active) return
        setIsAdmin(!!account?.is_admin)
        if (castError) console.error(castError)
        setCastaways([...(cast || [])].sort(compareCastaways))
        if (entryError) console.error(entryError)
        else setEntry(seasonEntry)
      }
      setLoading(false)
    }
    Promise.resolve().then(load)
    return () => { active = false }
  }, [id, guestData])

  if (loading) return <div style={{ padding: '2rem', color: 'white' }}>Loading castaway...</div>
  if (!contestant) return <div style={{ padding: '2rem' }}><Link to={`${prefix}/castaways`}>Back to Castaways</Link></div>

  const rosterIds = (entry?.drafted_team || []).map(pick => String(pick?.id ?? pick))
  const isDrafted = rosterIds.includes(String(contestant.id))
  const draftLimit = Number(season?.current_week || 1) >= Number(season?.merge_week || 7) ? Number(season?.merge_draft_size || 6) : Number(season?.initial_draft_size || 5)

  async function draftPlayer() {
    if (!entry || saving || isDrafted || contestant.is_eliminated || rosterIds.length >= draftLimit) return
    setSaving(true)
    const { data, error } = await supabase.rpc('set_season_draft_pick', {
      p_season_id: contestant.season_id,
      p_contestant_id: contestant.id,
      p_add: true
    })
    if (error) alert(error.message)
    else setEntry(previous => ({ ...previous, drafted_team: data || [] }))
    setSaving(false)
  }

  async function eliminatePlayer() {
    if (!isAdmin || eliminating || saving || contestant.is_eliminated) return
    const input = window.prompt(`How many days did ${contestant.display_name || contestant.name} last?`)
    if (input === null) return
    const days = Number(input.trim())
    if (!input.trim() || !Number.isInteger(days) || days < 1 || days > 32767) {
      window.alert('Enter a positive whole number of days (1–32767).')
      return
    }
    setEliminating(true)
    try {
      const { error } = await supabase.rpc('admin_eliminate_season_contestant', {
        p_season_id: contestant.season_id,
        p_contestant_id: contestant.id,
        p_days: days
      })
      if (error) throw error
      setContestant(previous => ({ ...previous, is_eliminated: true, elimination_day: days }))
      setCastaways(previous => previous.map(c => String(c.id) === String(contestant.id) ? { ...c, is_eliminated: true, elimination_day: days } : c).sort(compareCastaways))
      window.alert(`${contestant.name} eliminated after ${days} days. All team scores have been updated.`)
    } catch (error) {
      window.alert(`Could not eliminate castaway: ${error.message}`)
    } finally {
      setEliminating(false)
    }
  }

  return (
    <div className="castaway-detail">
      <Link to={`${prefix}/castaways`} className="castaway-back" aria-label="Back to Castaways">← Back</Link>
      <DetailNavigation items={castaways} id={id} basePath={`${prefix}/castaways`} label="castaway" previews disabled={saving || eliminating}>
      <article style={{ width: 'min(620px, 100%)', margin: '0 auto', background: 'rgba(255,255,255,0.9)', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 12px 30px rgba(15,23,42,0.25)' }}>
        <img src={contestant.picture_url} alt={contestant.name} style={{ width: '100%', aspectRatio: '1', display: 'block', objectFit: 'cover', objectPosition: 'center top', filter: contestant.is_eliminated ? 'grayscale(1)' : 'none' }} />
        <div style={{ padding: '1rem' }}>
          <p style={{ margin: 0, color: '#92400e', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.78rem' }}>Survivor 51 Castaway</p>
          <h1 style={{ margin: '0.2rem 0' }}>{contestant.display_name || contestant.name}</h1>
          {contestant.display_name && contestant.display_name !== contestant.name && <p style={{ margin: '0 0 0.6rem', color: '#64748b' }}>{contestant.name}</p>}
          {contestant.is_eliminated && <p><b>Eliminated:</b> Day {contestant.elimination_day}</p>}
          <p className="castaway-tribe"><b>Tribe:</b> <span className={`tribe-${(contestant.tribe || '').toLowerCase()}`}>{contestant.tribe || 'Unknown'}</span></p>
          <p><b>Age:</b> {contestant.age}</p>
          <p><b>Occupation:</b> {contestant.occupation}</p>
          <p><b>Hometown:</b> {contestant.hometown}</p>
          <p><b>Current residence:</b> {contestant.current_residence}</p>
          <p style={{ lineHeight: 1.6 }}>{contestant.bio}</p>
          <DraftedByTeams seasonId={contestant.season_id} contestantId={contestant.id} guestData={guestData} canView={!!guestData || rosterIds.length >= Number(season?.initial_draft_size || 5)} />
        </div>
      </article>
      </DetailNavigation>
      {!guestData && <div className="castaway-draft-bar">
        {isAdmin && <button className="castaway-elim-button" onClick={eliminatePlayer} disabled={eliminating || saving || contestant.is_eliminated} aria-label="Eliminate castaway">{eliminating ? 'Saving…' : 'Elim'}</button>}
        <button
          onClick={draftPlayer}
          disabled={!entry || saving || eliminating || isDrafted || contestant.is_eliminated || rosterIds.length >= draftLimit}
          className={`castaway-draft-button${isDrafted ? ' is-drafted' : rosterIds.length >= draftLimit ? ' is-full' : ''}`}
          aria-label={isDrafted ? 'Drafted. Pick locked' : rosterIds.length >= draftLimit ? 'Draft unavailable: your tribe is full' : 'Draft'}
          aria-pressed={isDrafted}
          aria-busy={saving}
        >
          {saving ? 'Saving…' : isDrafted ? 'Drafted' : 'Draft'}
        </button>
      </div>}
    </div>
  )
}
