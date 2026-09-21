import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import siteLogo from '../assets/51/Logo.webp'

const imageFor = contestant => contestant?.picture_url || contestant?.elimPhoto_url || contestant?.elim_photo_url || '/fallback.png'

export default function SeasonArchive() {
  const { slug } = useParams()
  const [season, setSeason] = useState(null)
  const [entries, setEntries] = useState([])
  const [contestants, setContestants] = useState([])
  const [weeklyResults, setWeeklyResults] = useState([])
  const [expandedEntry, setExpandedEntry] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    async function loadArchive() {
      setLoading(true)
      setError('')

      const { data: seasonData, error: seasonError } = await supabase
        .from('seasons')
        .select('*')
        .eq('slug', slug)
        .eq('status', 'archived')
        .single()

      if (!active) return
      if (seasonError) {
        setError(seasonError.message)
        setLoading(false)
        return
      }

      const [entriesResult, contestantsResult, resultsResult] = await Promise.all([
        supabase.from('season_entries').select('*').eq('season_id', seasonData.id).order('final_rank', { ascending: true }),
        supabase.from('season_contestants').select('*').eq('season_id', seasonData.id),
        supabase.from('season_weekly_results').select('*').eq('season_id', seasonData.id).order('week', { ascending: true })
      ])

      if (!active) return
      const firstError = entriesResult.error || contestantsResult.error || resultsResult.error
      if (firstError) setError(firstError.message)
      else {
        setSeason(seasonData)
        setEntries(entriesResult.data || [])
        setContestants(contestantsResult.data || [])
        setWeeklyResults(resultsResult.data || [])
      }
      setLoading(false)
    }

    loadArchive()
    return () => { active = false }
  }, [slug])

  const contestantsByOriginalId = useMemo(() => {
    const map = new Map()
    contestants.forEach(contestant => map.set(String(contestant.original_contestant_id), contestant))
    return map
  }, [contestants])

  const winner = useMemo(() => [...contestants]
    .sort((a, b) => Number(b.jury_votes_received || 0) - Number(a.jury_votes_received || 0))[0], [contestants])

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center', color: 'white' }}>Loading season archive...</div>
  if (error || !season) return <div style={{ padding: '2rem', textAlign: 'center' }}><div style={{ background: 'rgba(255,255,255,0.9)', padding: '1rem', borderRadius: '12px' }}><p>Unable to load this season.</p><Link to="/seasons">Back to Previous Seasons</Link></div></div>

  return (
    <div style={{ padding: '1rem 1rem 6rem' }}>
      <div style={{ width: 'min(920px, 100%)', margin: '0 auto' }}>
        <img src={siteLogo} alt="Survivor Draft Logo" style={{ display: 'block', width: 'min(190px, 48vw)', margin: '0 auto 0.5rem' }} />
        <div style={{ textAlign: 'center', color: 'white', textShadow: '0 2px 8px rgba(0,0,0,0.7)', marginBottom: '1rem' }}>
          <p style={{ margin: 0, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', fontSize: '0.78rem' }}>Season Archive</p>
          <h1 style={{ margin: '0.2rem 0' }}>{season.name}</h1>
          {winner?.jury_votes_received > 0 && <p style={{ margin: 0 }}>Sole Survivor: <b>{winner.name}</b> · {winner.jury_votes_received} jury votes</p>}
        </div>

        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {entries.map(entry => {
            const roster = Array.isArray(entry.drafted_team) ? entry.drafted_team : []
            const finalPick = contestantsByOriginalId.get(String(entry.final_winner_original_contestant_id || ''))
            const isExpanded = expandedEntry === entry.id
            return (
              <article key={entry.id} style={{ background: 'rgba(255,255,255,0.9)', border: entry.final_rank === 1 ? '2px solid #d4af37' : '1px solid rgba(203,213,225,0.95)', borderRadius: '14px', overflow: 'hidden', backdropFilter: 'blur(4px)', boxShadow: '0 8px 20px rgba(15,23,42,0.14)' }}>
                <button onClick={() => setExpandedEntry(isExpanded ? null : entry.id)} aria-expanded={isExpanded} style={{ width: '100%', border: 0, borderRadius: 0, background: 'transparent', padding: '0.9rem', display: 'grid', gridTemplateColumns: '54px minmax(0,1fr) auto', alignItems: 'center', gap: '0.75rem', textAlign: 'left' }}>
                  {entry.avatar_url ? <img src={entry.avatar_url} alt="" style={{ width: '50px', height: '50px', borderRadius: '50%', objectFit: 'cover' }} /> : <div style={{ width: '50px', height: '50px', borderRadius: '50%', background: '#e2e8f0' }} />}
                  <div style={{ minWidth: 0 }}>
                    <h2 style={{ margin: 0, fontSize: '1.08rem', overflowWrap: 'anywhere' }}>{entry.team_name}</h2>
                    <p style={{ margin: '0.15rem 0 0', color: '#64748b', fontSize: '0.84rem' }}>{entry.player_name}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ margin: 0, fontWeight: 800 }}>{entry.total_score} pts</p>
                    <p style={{ margin: '0.1rem 0 0', color: '#92400e', fontSize: '0.82rem', fontWeight: 700 }}>#{entry.final_rank}</p>
                  </div>
                </button>

                {isExpanded && (
                  <div style={{ borderTop: '1px solid #e2e8f0', padding: '0.9rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.45rem', marginBottom: '0.9rem', textAlign: 'center' }}>
                      <div><b>{entry.team_points}</b><br /><span style={{ fontSize: '0.72rem', color: '#64748b' }}>Team</span></div>
                      <div><b>{entry.bonus_points}</b><br /><span style={{ fontSize: '0.72rem', color: '#64748b' }}>Bonus</span></div>
                      <div><b>{entry.manual_points}</b><br /><span style={{ fontSize: '0.72rem', color: '#64748b' }}>Manual</span></div>
                    </div>

                    <h3 style={{ margin: '0 0 0.5rem' }}>Final Tribe</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(72px, 1fr))', gap: '0.5rem' }}>
                      {roster.map(pick => {
                        const contestant = contestantsByOriginalId.get(String(pick?.id)) || pick
                        return <div key={pick?.id || contestant?.name} style={{ textAlign: 'center' }}><img src={imageFor(contestant)} alt={contestant?.name || 'Contestant'} style={{ width: '58px', height: '58px', borderRadius: '9px', objectFit: 'cover', filter: contestant?.is_eliminated ? 'grayscale(100%)' : 'none' }} /><p style={{ margin: '0.2rem 0 0', fontSize: '0.72rem', lineHeight: 1.1 }}>{contestant?.name}</p></div>
                      })}
                    </div>

                    <h3 style={{ margin: '1rem 0 0.4rem' }}>Weekly Picks</h3>
                    <div style={{ display: 'flex', gap: '0.35rem', overflowX: 'auto', paddingBottom: '0.3rem' }}>
                      {weeklyResults.map(result => {
                        const pickValue = entry.weekly_picks?.[result.week]
                        const contestant = contestantsByOriginalId.get(String(pickValue || ''))
                        const winners = Array.isArray(result.winner_original_contestant_ids) ? result.winner_original_contestant_ids.map(String) : [String(result.winner_original_contestant_id || '')]
                        const won = result.phase === 'tribal' ? String(pickValue) === String(result.winner_team) : winners.includes(String(pickValue))
                        return <div key={result.week} title={`Week ${result.week}: ${contestant?.name || pickValue || 'No pick'}`} style={{ flex: '0 0 42px', textAlign: 'center' }}><div style={{ width: '38px', height: '38px', margin: '0 auto', borderRadius: '50%', border: won ? '3px solid #16a34a' : '2px solid #cbd5e1', background: contestant ? `url(${imageFor(contestant)}) center/cover` : '#e2e8f0' }} /><span style={{ fontSize: '0.65rem' }}>W{result.week}</span></div>
                      })}
                    </div>

                    {entry.final_wager_points > 0 && <p style={{ margin: '0.9rem 0 0', padding: '0.65rem', borderRadius: '10px', background: '#f8fafc' }}><b>Final wager:</b> {entry.final_wager_points} points on {finalPick?.name || 'Unknown contestant'}</p>}
                  </div>
                )}
              </article>
            )
          })}
        </div>

        <div style={{ textAlign: 'center', marginTop: '1rem' }}><Link to="/seasons" style={{ display: 'inline-block', color: 'white', textShadow: '0 2px 6px rgba(0,0,0,0.8)', fontWeight: 800 }}>← All Previous Seasons</Link></div>
      </div>
    </div>
  )
}
