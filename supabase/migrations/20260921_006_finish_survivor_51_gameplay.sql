-- Complete active-season gameplay: drafting, locked picks, configurable merge,
-- and Survivor 51's three-point tribal immunity bonus.
begin;

update public.seasons
set merge_week = 7, updated_at = now()
where slug = 'survivor-51';

create or replace function public.recalculate_season_scores(p_season_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_day integer;
begin
  v_current_day := (
    select coalesce(max(sc.elimination_day), 0)
    from public.season_contestants sc
    where sc.season_id = p_season_id
  );

  with roster_points as (
    select entry.id as entry_id,
      coalesce(sum(
        case when coalesce(contestant.is_eliminated, false)
          then greatest(coalesce(contestant.elimination_day, 0), 0)
          else greatest(v_current_day, 0)
        end + coalesce(contestant.jury_votes_received, 0)
      ), 0)::integer as points
    from public.season_entries entry
    left join lateral jsonb_array_elements(coalesce(entry.drafted_team, '[]'::jsonb)) pick(value) on true
    left join public.season_contestants contestant
      on contestant.season_id = entry.season_id
     and contestant.id = nullif(coalesce(pick.value->>'id', trim(both '"' from pick.value::text)), '')::bigint
    where entry.season_id = p_season_id
    group by entry.id
  ), bonus_points as (
    select entry.id as entry_id,
      coalesce(sum(
        case
          when result.phase = 'tribal'
           and entry.weekly_picks ->> result.week::text = result.winner_team then 3
          when result.phase = 'individual'
           and exists (
             select 1 from jsonb_array_elements_text(
               coalesce(result.winner_original_contestant_ids,
                 case when result.winner_original_contestant_id is null then '[]'::jsonb
                      else jsonb_build_array(result.winner_original_contestant_id) end)
             ) winner(id)
             where winner.id = entry.weekly_picks ->> result.week::text
           ) then coalesce(result.bonus_points_awarded, result.players_remaining, 0)
          else 0
        end
      ), 0)::integer as points
    from public.season_entries entry
    left join public.season_weekly_results result on result.season_id = entry.season_id
    where entry.season_id = p_season_id
    group by entry.id
  )
  update public.season_entries entry
  set team_points = roster.points,
      bonus_points = bonus.points,
      total_score = roster.points + bonus.points + coalesce(entry.manual_points, 0)
  from roster_points roster
  join bonus_points bonus on bonus.entry_id = roster.entry_id
  where entry.id = roster.entry_id;
end;
$$;

create or replace function public.set_season_draft_pick(
  p_season_id bigint,
  p_contestant_id bigint,
  p_add boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_season public.seasons%rowtype;
  v_entry public.season_entries%rowtype;
  v_roster jsonb;
  v_count integer;
  v_limit integer;
  v_exists boolean;
begin
  select * into v_season from public.seasons
  where id = p_season_id and status in ('draft', 'active', 'finale');
  if not found then raise exception 'Season is not active'; end if;

  select * into v_entry from public.season_entries
  where season_id = p_season_id and profile_id = auth.uid()
  for update;
  if not found then raise exception 'Season entry not found'; end if;

  if not exists (
    select 1 from public.season_contestants
    where id = p_contestant_id and season_id = p_season_id and not is_eliminated
  ) then raise exception 'Castaway is not available'; end if;

  v_roster := coalesce(v_entry.drafted_team, '[]'::jsonb);
  select exists (
    select 1 from jsonb_array_elements(v_roster) pick(value)
    where coalesce(pick.value->>'id', trim(both '"' from pick.value::text)) = p_contestant_id::text
  ) into v_exists;

  if p_add then
    if v_exists then return v_roster; end if;
    v_limit := case when v_season.current_week >= v_season.merge_week
      then v_season.merge_draft_size else v_season.initial_draft_size end;
    v_count := jsonb_array_length(v_roster);
    if v_count >= v_limit then
      raise exception 'Your tribe is full for the current phase (% players)', v_limit;
    end if;
    if v_season.current_week > 1 and v_count < v_season.initial_draft_size then
      raise exception 'The initial draft is closed';
    end if;
    v_roster := v_roster || jsonb_build_array(p_contestant_id);
  else
    if v_season.current_week > 1 then raise exception 'Draft picks are locked'; end if;
    select coalesce(jsonb_agg(pick.value order by pick.ordinality), '[]'::jsonb)
    into v_roster
    from jsonb_array_elements(v_roster) with ordinality pick(value, ordinality)
    where coalesce(pick.value->>'id', trim(both '"' from pick.value::text)) <> p_contestant_id::text;
  end if;

  update public.season_entries set drafted_team = v_roster where id = v_entry.id;
  perform public.recalculate_season_scores(p_season_id);
  return v_roster;
end;
$$;

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
  if p_week <> v_season.current_week then raise exception 'Only the current week is open for picks'; end if;
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

create or replace function public.admin_update_season_settings(
  p_season_id bigint,
  p_merge_week integer
)
returns public.seasons
language plpgsql
security definer
set search_path = public
as $$
declare v_season public.seasons%rowtype;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and coalesce(is_admin, false)) then
    raise exception 'Only admins can update season settings';
  end if;
  select * into v_season from public.seasons where id = p_season_id;
  if not found then raise exception 'Season not found'; end if;
  if p_merge_week < 2 or p_merge_week > v_season.episode_count then
    raise exception 'Merge week must be between 2 and %', v_season.episode_count;
  end if;
  update public.seasons set merge_week = p_merge_week, updated_at = now()
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
declare v_primary_winner bigint;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and coalesce(is_admin, false)) then
    raise exception 'Only admins can set immunity results';
  end if;
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
  perform public.recalculate_season_scores(p_season_id);
end;
$$;

grant execute on function public.set_season_draft_pick(bigint, bigint, boolean) to authenticated;
grant execute on function public.submit_season_weekly_pick(bigint, integer, text) to authenticated;
grant execute on function public.admin_update_season_settings(bigint, integer) to authenticated;
grant execute on function public.admin_set_season_weekly_result(bigint, integer, text, text, jsonb, integer, integer) to authenticated;

commit;
