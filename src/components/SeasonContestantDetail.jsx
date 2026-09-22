import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import DetailNavigation from './DetailNavigation'
import { compareCastaways } from '../utils/detailNavigation'
import { supabase } from '../supabaseClient'

export default function SeasonContestantDetail() {
  const { id } = useParams()
  const [castaways, setCastaways] = useState([])
  const [contestant, setContestant] = useState(null)
  const [season, setSeason] = useState(null)
  const [entry, setEntry] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true
    async function load() {
      const [{ data: castaway, error }, { data: authData }] = await Promise.all([
        supabase.from('season_contestants').select('*, seasons(*)').eq('id', id).single(),
        supabase.auth.getUser()
      ])
      if (!active) return
      if (error) console.error(error)
      else {
        setContestant(castaway)
        setSeason(castaway.seasons)
        const [{ data: seasonEntry, error: entryError }, { data: cast, error: castError }] = await Promise.all([
          supabase.from('season_entries').select('*').eq('season_id', castaway.season_id).eq('profile_id', authData?.user?.id).single(),
          supabase.from('season_contestants').select('id, name, is_eliminated, elim_day').eq('season_id', castaway.season_id)
        ])
        if (!active) return
        if (castError) console.error(castError)
        setCastaways([...(cast || [])].sort(compareCastaways))
        if (entryError) console.error(entryError)
        else setEntry(seasonEntry)
      }
      setLoading(false)
    }
    Promise.resolve().then(load)
    return () => { active = false }
  }, [id])

  if (loading) return <div style={{ padding: '2rem', color: 'white' }}>Loading castaway...</div>
  if (!contestant) return <div style={{ padding: '2rem' }}><Link to="/castaways">Back to Castaways</Link></div>

  const rosterIds = (entry?.drafted_team || []).map(pick => String(pick?.id ?? pick))
  const isDrafted = rosterIds.includes(String(contestant.id))
  const draftLimit = Number(season?.current_week || 1) >= Number(season?.merge_week || 7) ? Number(season?.merge_draft_size || 6) : Number(season?.initial_draft_size || 5)

  async function toggleDraft() {
    if (!entry || saving || contestant.is_eliminated || (!isDrafted && rosterIds.length >= draftLimit)) return
    setSaving(true)
    const { data, error } = await supabase.rpc('set_season_draft_pick', {
      p_season_id: contestant.season_id,
      p_contestant_id: contestant.id,
      p_add: !isDrafted
    })
    if (error) alert(error.message)
    else setEntry(previous => ({ ...previous, drafted_team: data || [] }))
    setSaving(false)
  }

  return (
    <div className="castaway-detail">
      <Link to="/castaways" className="castaway-back" aria-label="Back to Castaways">← Back</Link>
      <DetailNavigation items={castaways} id={id} basePath="/castaways" label="castaway" disabled={saving}>
      <article style={{ width: 'min(620px, 100%)', margin: '0 auto', background: 'rgba(255,255,255,0.9)', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 12px 30px rgba(15,23,42,0.25)' }}>
        <img src={contestant.picture_url} alt={contestant.name} style={{ width: '100%', aspectRatio: '1', display: 'block', objectFit: 'cover', objectPosition: 'center top' }} />
        <div style={{ padding: '1rem' }}>
          <p style={{ margin: 0, color: '#92400e', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.78rem' }}>Survivor 51 Castaway</p>
          <h1 style={{ margin: '0.2rem 0' }}>{contestant.display_name || contestant.name}</h1>
          {contestant.display_name && contestant.display_name !== contestant.name && <p style={{ margin: '0 0 0.6rem', color: '#64748b' }}>{contestant.name}</p>}
          <p><b>Tribe:</b> {contestant.tribe || 'Unknown'}</p>
          <p><b>Age:</b> {contestant.age}</p>
          <p><b>Occupation:</b> {contestant.occupation}</p>
          <p><b>Hometown:</b> {contestant.hometown}</p>
          <p><b>Current residence:</b> {contestant.current_residence}</p>
          <p style={{ lineHeight: 1.6 }}>{contestant.bio}</p>
          <div style={{ margin: '1rem 0', padding: '0.85rem', borderRadius: 10, background: '#f8fafc', border: '1px solid #cbd5e1' }}>
            <p style={{ margin: '0 0 0.6rem', fontWeight: 700 }}>Your tribe: {rosterIds.length} / {draftLimit}</p>

          </div>

        </div>
      </article>
      </DetailNavigation>
      <div className="castaway-draft-bar">
        <button
          onClick={toggleDraft}
          disabled={!entry || saving || contestant.is_eliminated || (!isDrafted && rosterIds.length >= draftLimit)}
          className={`castaway-draft-button${isDrafted ? ' is-drafted' : rosterIds.length >= draftLimit ? ' is-full' : ''}`}
          aria-label={isDrafted ? 'Drafted. Remove from My Tribe' : rosterIds.length >= draftLimit ? 'Draft unavailable: your tribe is full' : 'Draft'}
          aria-pressed={isDrafted}
          aria-busy={saving}
        >
          {saving ? 'Saving…' : isDrafted ? 'Drafted' : 'Draft'}
        </button>
      </div>
    </div>
  )
}
