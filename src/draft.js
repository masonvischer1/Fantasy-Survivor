import { supabase } from './supabaseClient.js';

// Fetch all available players (S50 cast)
export async function getAvailablePlayers() {
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .eq('season', 'S50')
    .order('name', { ascending: true });

  if (error) throw error;
  return data;
}

// Make a draft selection for a user
export async function pickPlayer(userId, playerId) {
  // Get the user's team
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('team_id')
    .eq('id', userId)
    .single();

  if (userError) throw userError;

  // Check if user already has 5 picks
  const { data: selections, error: selError } = await supabase
    .from('draft_selections')
    .select('*')
    .eq('team_id', user.team_id)
    .eq('selection_type', 'initial');

  if (selError) throw selError;
  if (selections.length >= 5) throw new Error('Maximum 5 picks allowed');

  // Insert new selection
  const { data, error } = await supabase
    .from('draft_selections')
    .insert({
      team_id: user.team_id,
      player_id,
      selection_type: 'initial',
      hidden: true, // hide until game start
    });

  if (error) throw error;
  return data[0];
}

// Get draft board for a team
export async function getTeamDraftBoard(teamId) {
  const { data, error } = await supabase
    .from('draft_selections')
    .select(`
      player_id,
      selection_type,
      hidden,
      players(name, tribe, bio, points)
    `)
    .eq('team_id', teamId);

  if (error) throw error;
  return data;
}

// Get full leaderboard
export async function getLeaderboard() {
  const { data, error } = await supabase
    .from('draft_selections')
    .select(`
      team_id,
      players(points)
    `);

  if (error) throw error;

  // Sum points per team
  const leaderboard = {};
  data.forEach((sel) => {
    if (!leaderboard[sel.team_id]) leaderboard[sel.team_id] = 0;
    leaderboard[sel.team_id] += sel.players.points || 0;
  });

  // Convert to array
  return Object.entries(leaderboard).map(([team_id, points]) => ({ team_id, points }));
}
