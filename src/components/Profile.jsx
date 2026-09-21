import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function Profile({ session, setProfile }) {
  const navigate = useNavigate()
  const [entry, setEntry] = useState(null)
  const [contestants, setContestants] = useState([])
  const [playerName, setPlayerName] = useState('')
  const [teamName, setTeamName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [avatarFile, setAvatarFile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const userId = session?.user?.id

  useEffect(() => {
    let active = true
    async function load() {
      const { data: season, error: seasonError } = await supabase.from('seasons').select('id').in('status', ['draft', 'active', 'finale']).single()
      if (seasonError || !active) return
      const [{ data: seasonEntry, error: entryError }, { data: cast, error: castError }] = await Promise.all([
        supabase.from('season_entries').select('*').eq('season_id', season.id).eq('profile_id', userId).single(),
        supabase.from('season_contestants').select('*').eq('season_id', season.id)
      ])
      if (entryError || castError) console.error(entryError || castError)
      if (!active) return
      setEntry(seasonEntry)
      setContestants(cast || [])
      setPlayerName(seasonEntry?.player_name || '')
      setTeamName(seasonEntry?.team_name || '')
      setAvatarUrl(seasonEntry?.avatar_url || '')
      setLoading(false)
    }
    Promise.resolve().then(load)
    return () => { active = false }
  }, [userId])

  const contestantMap = useMemo(() => new Map(contestants.map(c => [String(c.id), c])), [contestants])
  const roster = useMemo(() => (entry?.drafted_team || []).map(pick => contestantMap.get(String(pick?.id ?? pick))).filter(Boolean), [contestantMap, entry])

  async function uploadAvatar() {
    if (!avatarFile) return avatarUrl
    const extension = avatarFile.name.split('.').pop()
    const path = `${userId}-${Date.now()}.${extension}`
    const { error } = await supabase.storage.from('avatars').upload(path, avatarFile)
    if (error) throw error
    return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
  }

  async function handleSave() {
    if (!entry || !playerName.trim() || !teamName.trim()) return
    setSaving(true)
    try {
      const nextAvatar = await uploadAvatar()
      const [{ error: entryError }, { error: profileError }] = await Promise.all([
        supabase.from('season_entries').update({ player_name: playerName.trim(), team_name: teamName.trim(), avatar_url: nextAvatar }).eq('id', entry.id),
        supabase.from('profiles').update({ player_name: playerName.trim(), avatar_url: nextAvatar }).eq('id', userId)
      ])
      if (entryError || profileError) throw entryError || profileError
      const updated = { ...entry, player_name: playerName.trim(), team_name: teamName.trim(), avatar_url: nextAvatar }
      setEntry(updated)
      setAvatarUrl(nextAvatar)
      setProfile(previous => ({ ...previous, ...updated, id: userId, entry_id: updated.id }))
      alert('Survivor 51 team updated!')
    } catch (error) {
      alert(error.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  if (loading) return <div style={{ padding: '1rem' }}>Loading tribe…</div>

  return (
    <div style={{ padding: '1rem 1rem 6rem' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center', background: 'rgba(255,255,255,.88)', borderRadius: 12, padding: '1rem' }}>
        <h1>My Tribe</h1>
        <img src={avatarUrl || '/fallback.png'} alt="Avatar" style={{ width: 120, height: 120, borderRadius: '50%', objectFit: 'cover' }} />
        <div style={{ maxWidth: 420, margin: '1rem auto' }}>
          <input value={playerName} onChange={e => setPlayerName(e.target.value)} placeholder="Your Name" style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginBottom: 10, padding: 9 }} />
          <input value={teamName} onChange={e => setTeamName(e.target.value)} placeholder="Team Name" style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginBottom: 10, padding: 9 }} />
          <input id="avatar-upload" type="file" accept="image/*" onChange={e => setAvatarFile(e.target.files?.[0] || null)} style={{ display: 'none' }} />
          <label htmlFor="avatar-upload" style={{ display: 'block', padding: 10, border: '1px dashed #64748b', borderRadius: 8, cursor: 'pointer' }}>{avatarFile?.name || 'Choose Profile Photo'}</label>
          <button onClick={handleSave} disabled={saving} style={{ marginTop: 12 }}>{saving ? 'Saving…' : 'Save Profile'}</button>
        </div>

        <h2>Your Survivor 51 Draft</h2>
        {roster.length === 0 && <p>You haven’t drafted any Survivor 51 players yet.</p>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 12 }}>
          {roster.map(c => <article key={c.id} style={{ border: '1px solid #cbd5e1', borderRadius: 10, padding: 8 }}>
            <img src={c.picture_url || '/fallback.png'} alt={c.name} style={{ width: '100%', aspectRatio: 1, objectFit: 'cover', objectPosition: 'center top', borderRadius: 8, filter: c.is_eliminated ? 'grayscale(1)' : 'none' }} />
            <strong>{c.name}</strong>
          </article>)}
        </div>

        <button onClick={handleLogout} style={{ marginTop: 20, background: '#111827', color: 'white' }}>Logout</button>
      </div>
    </div>
  )
}
