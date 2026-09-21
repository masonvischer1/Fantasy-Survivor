-- Survivor 51 weekly picks begin in Week 2. Recording the current week's result
-- advances the season, which automatically unlocks the merge draft in Week 7.
begin;

alter table public.seasons add column if not exists picks_start_week integer not null default 1;

update public.seasons
set picks_start_week = 2, updated_at = now()
where slug = 'survivor-51';

create or replace function public.submit_season_weekly_pick(
  p_season_id bigint,
  p_week integer,
  p_pick text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_season public.seasons%rowtype;
  v_entry public.season_entries%rowtype;
  v_phase text;
  v_picks jsonb;
begin
  select * into v_season from public.seasons
  where id = p_season_id and status in ('active', 'finale');
  if not found then raise exception 'Season is not active'; end if;
  if p_week < v_season.picks_start_week then
    raise exception 'Weekly picks begin in Week %', v_season.picks_start_week;
  end if;
  if p_week < 1 or p_week > v_season.episode_count then raise exception 'Invalid week'; end if;
  if exists (select 1 from public.season_weekly_results where season_id = p_season_id and week = p_week) then
    raise exception 'This week is already locked';
  end if;

  v_phase := case when p_week < v_season.merge_week then 'tribal' else 'individual' end;
  if v_phase = 'tribal' then
    if not (v_season.tribes ? p_pick) then raise exception 'Choose a valid tribe'; end if;
  else
    if p_pick !~ '^\d+$' or not exists (
      select 1 from public.season_contestants
      where id = p_pick::bigint and season_id = p_season_id and not is_eliminated
    ) then raise exception 'Choose an active castaway'; end if;
  end if;

  select * into v_entry from public.season_entries
  where season_id = p_season_id and profile_id = auth.uid()
  for update;
  if not found then raise exception 'Season entry not found'; end if;
  if coalesce(v_entry.weekly_picks, '{}'::jsonb) ? p_week::text then
    raise exception 'Your pick is already locked';
  end if;

  v_picks := jsonb_set(coalesce(v_entry.weekly_picks, '{}'::jsonb), array[p_week::text], to_jsonb(p_pick), true);
  update public.season_entries set weekly_picks = v_picks where id = v_entry.id;
  return v_picks;
end;
$$;

create or replace function public.admin_update_current_week(
  p_season_id bigint,
  p_current_week integer
)
returns public.seasons
language plpgsql
security definer
set search_path = public
as $$
declare v_season public.seasons%rowtype;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and coalesce(is_admin, false)) then
    raise exception 'Only admins can update the current week';
  end if;
  select * into v_season from public.seasons where id = p_season_id;
  if not found then raise exception 'Season not found'; end if;
  if p_current_week < 1 or p_current_week > v_season.episode_count then
    raise exception 'Current week must be between 1 and %', v_season.episode_count;
  end if;
  update public.seasons set current_week = p_current_week, updated_at = now()
  where id = p_season_id returning * into v_season;
  return v_season;
end;
$$;

create or replace function public.admin_set_season_weekly_result(
  p_season_id bigint,
  p_week integer,
  p_phase text,
  p_winner_team text,
  p_winner_contestant_ids jsonb,
  p_players_remaining integer,
  p_bonus_points_awarded integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_primary_winner bigint;
  v_current_week integer;
  v_episode_count integer;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and coalesce(is_admin, false)) then
    raise exception 'Only admins can set immunity results';
  end if;
  select current_week, episode_count into v_current_week, v_episode_count
  from public.seasons where id = p_season_id and status in ('active', 'finale');
  if not found then raise exception 'Season is not active'; end if;
  if p_phase not in ('tribal', 'individual') then raise exception 'Invalid phase'; end if;
  if p_phase = 'tribal' and nullif(p_winner_team, '') is null then raise exception 'Select a winning tribe'; end if;
  if p_phase = 'individual' then
    select nullif(value, '')::bigint into v_primary_winner
    from jsonb_array_elements_text(coalesce(p_winner_contestant_ids, '[]'::jsonb)) winner(value) limit 1;
    if v_primary_winner is null then raise exception 'Select at least one winner'; end if;
  end if;

  insert into public.season_weekly_results (
    season_id, week, phase, winner_team, winner_original_contestant_id,
    winner_original_contestant_ids, players_remaining, bonus_points_awarded, source_updated_at
  ) values (
    p_season_id, p_week, p_phase,
    case when p_phase = 'tribal' then p_winner_team end,
    case when p_phase = 'individual' then v_primary_winner end,
    case when p_phase = 'individual' then p_winner_contestant_ids end,
    p_players_remaining,
    case when p_phase = 'tribal' then 3 else p_bonus_points_awarded end,
    now()
  ) on conflict (season_id, week) do update set
    phase = excluded.phase,
    winner_team = excluded.winner_team,
    winner_original_contestant_id = excluded.winner_original_contestant_id,
    winner_original_contestant_ids = excluded.winner_original_contestant_ids,
    players_remaining = excluded.players_remaining,
    bonus_points_awarded = excluded.bonus_points_awarded,
    source_updated_at = excluded.source_updated_at;

  if p_week = v_current_week and v_current_week < v_episode_count then
    update public.seasons set current_week = v_current_week + 1, updated_at = now()
    where id = p_season_id;
  end if;

  perform public.recalculate_season_scores(p_season_id);
end;
$$;

grant execute on function public.submit_season_weekly_pick(bigint, integer, text) to authenticated;
grant execute on function public.admin_update_current_week(bigint, integer) to authenticated;
grant execute on function public.admin_set_season_weekly_result(bigint, integer, text, text, jsonb, integer, integer) to authenticated;

commit;
