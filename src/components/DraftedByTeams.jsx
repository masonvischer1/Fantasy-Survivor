import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function DraftedByTeams({ seasonId, contestantId, canView }) {
  const [totalTeams, setTotalTeams] = useState(0)
  const [teams, setTeams] = useState([])
  const [status, setStatus] = useState('loading')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!canView) return
    let active = true
    let request = 0
    async function load() {
      const currentRequest = ++request
      const { data, error } = await supabase
        .from('season_entries')
        .select('id, team_name, player_name, avatar_url, drafted_team')
        .eq('season_id', seasonId)
        .not('team_name', 'is', null)
      if (!active || currentRequest !== request) return
      if (error) {
        console.error(error)
        setStatus('error')
        return
      }
      setTotalTeams((data || []).length)
      setTeams((data || []).filter(team =>
        (team.drafted_team || []).some(pick => String(pick?.id ?? pick) === String(contestantId))
      ).sort((a, b) => (a.team_name || '').localeCompare(b.team_name || '')))
      setStatus('ready')
    }
    load()
    const channel = supabase.channel(`drafted-by-${seasonId}-${contestantId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'season_entries', filter: `season_id=eq.${seasonId}` }, load)
      .subscribe()
    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [seasonId, contestantId, canView, attempt])

  return (
    <section className="castaway-drafted-by" aria-labelledby="drafted-by-heading">
      {canView && status === 'ready' && <p className="castaway-draft-percentage"><strong>{totalTeams ? Math.round(teams.length / totalTeams * 100) : 0}%</strong> of league teams <span>({teams.length} of {totalTeams})</span></p>}
      <h2 id="drafted-by-heading">Drafted by</h2>
      {!canView ? <p>Complete your starting draft to see which teams drafted this castaway.</p> : status === 'loading' ? <p role="status">Loading teams…</p> : status === 'error' ? (
        <div><p>Couldn’t load teams.</p><button type="button" onClick={() => { setStatus('loading'); setAttempt(value => value + 1) }}>Try again</button></div>
      ) : teams.length === 0 ? <p>No teams have drafted this castaway yet.</p> : (
        <ul>
          {teams.map(team => (
            <li key={team.id}>
              <Link to={`/teams/${team.id}`}>
                {team.avatar_url ? <img src={team.avatar_url} alt="" /> : <span className="drafted-team-avatar" aria-hidden="true">{(team.team_name || 'T').charAt(0)}</span>}
                <span className="drafted-team-name"><strong>{team.team_name}</strong>{team.player_name && <small>{team.player_name}</small>}</span>
                <span aria-hidden="true">›</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
