import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { ordinalPlace } from '../utils/leaderboardStats'
import './RankHistory.css'

const colors = ['#fbbf24', '#38bdf8', '#fb7185', '#a3e635', '#c084fc', '#fb923c', '#2dd4bf', '#f472b6', '#818cf8', '#e2e8f0', '#bef264', '#f87171', '#67e8f9', '#d8b4fe', '#fdba74', '#94a3b8']

export default function RankHistory({ guest = false }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const chartRef = useRef(null)
  const [size, setSize] = useState({ width: 360, height: 620 })
  useEffect(() => {
    if (!data || !chartRef.current) return
    const observer = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width, height: entry.contentRect.height }))
    observer.observe(chartRef.current)
    return () => observer.disconnect()
  }, [data])
  useEffect(() => {
    let active = true
    async function load() {
      try {
        let next
        if (import.meta.env.DEV) {
          const response = await fetch('/__rank-history-preview')
          if (!response.ok) throw new Error('Preview unavailable')
          next = await response.json()
        } else {
          const response = await supabase.rpc('get_season_rank_history')
          if (response.error) throw response.error
          next = response.data
        }
        if (active) { setData(next); setError('') }
      } catch { if (active) setError('Rank history could not be loaded. Please try again shortly.') }
    }
    load()
    const timer = setInterval(load, 60000)
    window.addEventListener('focus', load)
    return () => { active = false; clearInterval(timer); window.removeEventListener('focus', load) }
  }, [])

  const teams = data?.teams || []
  const savedWeeks = data?.weeks || []
  const weeks = [{ week: 0, ranks: Object.fromEntries(teams.map(team => [team.id, 1])) }, ...savedWeeks.filter(w => w.week > 0)]
  const count = Math.max(teams.length, ...weeks.flatMap(w => Object.values(w.ranks || {}).map(Number)), 2)
  const weekCount = Math.max(1, ...weeks.map(w => w.week))
  const width = Math.max(size.width, 190 + weekCount * 46)
  const height = Math.max(size.height, count * 28 + 52)
  const x = week => 32 + week * (width - 185) / weekCount
  const y = rank => 26 + (rank - 1) * (height - 68) / (count - 1)
  const latest = weeks.at(-1)
  const endpoints = teams.map((team, index) => {
    const saved = weeks.filter(w => w.ranks?.[team.id] != null).at(-1)
    return { team, index, week: saved?.week, rank: saved?.ranks?.[team.id] }
  }).sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity) || a.index - b.index)

  return <div className="rank-history-page">
    <Link className="castaway-back" to={guest ? '/guest/teams' : '/teams'}>← Back</Link>
    <header className="rank-history-header">
      <h1>Rank History</h1>
    </header>
    {error && <p role="alert" className="history-notice">{error}</p>}
    {!data && !error && <p role="status">Loading rank history…</p>}
    {data && <>
      <div className="history-toolbar">
        <span>{`Current Week ${data.season?.current_week || 1} · Results through Week ${latest.week}`}</span>
      </div>
      <section className="history-panel" aria-label="Weekly ranking chart">
        <div ref={chartRef} className="history-scroll" tabIndex={0} role="region" aria-label="Scrollable rank chart">
            <svg width={width} height={height} role="group" aria-label="Weekly team rankings. First place at the top. Week zero starts every team in first place. Team pictures link to profiles.">
              {Array.from({ length: count }, (_, i) => <g key={i}><line x1="28" x2={x(weekCount)} y1={y(i + 1)} y2={y(i + 1)} stroke="#ffffff35" /><text x="22" y={y(i + 1) + 4} textAnchor="end" fill="#cbd5e1" fontSize="12">{i + 1}</text></g>)}
              {Array.from({ length: weekCount + 1 }, (_, i) => <g key={i}><line x1={x(i)} x2={x(i)} y1="30" y2={height - 35} stroke="#ffffff08" /><text x={x(i)} y={height - 12} textAnchor="middle" fill={weeks.some(w => w.week === i) ? '#fff' : '#718096'} fontSize="12" fontWeight="700">WK {i}</text></g>)}
              <text x="12" y="18" fill="#cbd5e1" fontSize="8">RANK</text>
              {teams.map((team, index) => {
                const points = weeks.map(w => ({ week: w.week, rank: w.ranks?.[team.id] })).filter(p => p.rank != null)
                const color = colors[index % colors.length]
                // A gap means no saved placement; do not invent intermediate history.
                const path = points.map((p, i) => `${i && points[i - 1].week === p.week - 1 ? 'L' : 'M'}${x(p.week)},${y(p.rank)}`).join(' ')
                return <g key={team.id} >
                  <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
                  {points.map(p => <g key={p.week}><title>{team.team_name}: Week {p.week}, {ordinalPlace(p.rank)}</title><circle cx={x(p.week)} cy={y(p.rank)} r="11" fill="transparent" /><circle cx={x(p.week)} cy={y(p.rank)} r="2.5" fill={color} stroke="#111e29" strokeWidth="1.5" /></g>)}
                </g>
              })}
              {endpoints.map(({ team, index, week, rank }, row) => {
                const badgeX = x(weekCount) + 28
                const badgeY = y(row + 1)
                const color = colors[index % colors.length]
                return <g key={`endpoint-${team.id}`} className="history-endpoint">
                  {rank != null && <path d={`M${x(week)},${y(rank)} L${badgeX - 14},${badgeY}`} stroke={color} strokeWidth="1.5" strokeDasharray="3 3" opacity=".65" fill="none" />}
                  <Link to={`${guest ? '/guest' : ''}/teams/${team.id}`} aria-label={`View ${team.team_name}, ${rank == null ? 'not ranked yet' : ordinalPlace(rank)}`}>
                    <rect x={badgeX - 14} y={badgeY - 14} width="135" height="28" fill="transparent" />
                    <title>{team.team_name} · {rank == null ? 'No saved ranking' : `${ordinalPlace(rank)} · Week ${week}`}</title>
                    <defs><clipPath id={`team-avatar-${team.id}`}><circle cx={badgeX} cy={badgeY} r="11" /></clipPath></defs>
                    <circle cx={badgeX} cy={badgeY} r="13" fill="#132632" stroke={color} strokeWidth="2.5" />
                    <text x={badgeX} y={badgeY + 4} textAnchor="middle" fill="white" fontSize="9" fontWeight="700">{team.team_name?.slice(0, 2).toUpperCase()}</text>
                    {team.avatar_url && <image href={team.avatar_url} x={badgeX - 11} y={badgeY - 11} width="22" height="22" preserveAspectRatio="xMidYMid slice" clipPath={`url(#team-avatar-${team.id})`} />}
                    <text x={badgeX + 18} y={badgeY - 2} fill="#f8fafc" fontSize="9" fontWeight="700">{team.team_name?.length > 17 ? `${team.team_name.slice(0, 16)}…` : team.team_name}</text>
                    <text x={badgeX + 18} y={badgeY + 10} fill={color} fontSize="8">{rank == null ? 'Not ranked yet' : ordinalPlace(rank)}</text>
                  </Link>
                </g>
              })}
            </svg>
          </div>
      </section>
    </>}
  </div>
}
