import React, { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

export default function MyTeam() {
  const [team, setTeam] = useState([])

  useEffect(() => {
    fetchTeam()
  }, [])

  async function fetchTeam() {
    const user = (await supabase.auth.getUser()).data.user

    const { data, error } = await supabase
      .from('fantasy_teams')
      .select(`
        pick_type,
        contestants (*)
      `)
      .eq('user_id', user.id)

    if (error) console.error(error)
    else setTeam(data)
  }

  return (
    <div>
      <h1>My Fantasy Team</h1>

      {team.map(pick => (
        <div key={pick.contestants.id}>
          <img
            src={pick.contestants.picture_url}
            width="80"
          />
          <div>{pick.contestants.name}</div>
          <div>Pick type: {pick.pick_type}</div>
          <div>Score: {pick.contestants.score}</div>
        </div>
      ))}
    </div>
  )
}
