create or replace function public.admin_update_week_ranks(p_season_id bigint, p_target_week integer)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_week integer;
  v_limit integer;
  v_previous public.season_rank_snapshots%rowtype;
  v_standings jsonb;
  v_changes jsonb;
begin
  if not exists(select 1 from public.profiles where id=auth.uid() and coalesce(is_admin,false)) then
    raise exception 'Only admins can update week ranks';
  end if;
  select current_week, episode_count into v_week, v_limit from public.seasons where id=p_season_id and status in ('draft','active','finale') for update;
  if not found then raise exception 'Season is not active'; end if;
  if p_target_week is null or p_target_week < 1 or p_target_week > v_limit then
    raise exception 'Target week must be between 1 and %', v_limit;
  end if;
  -- Advancing the week and saving its rankings are one transaction.
  update public.seasons set current_week=p_target_week, updated_at=now() where id=p_season_id;
  v_week := p_target_week;
  select * into v_previous from public.season_rank_snapshots where season_id=p_season_id order by id desc limit 1;
  select coalesce(jsonb_object_agg(id::text,jsonb_build_object('rank',place,'score',total_score)),'{}'::jsonb)
    into v_standings from (
      select id,total_score,rank() over(order by coalesce(total_score,0) desc) as place
      from public.season_entries where season_id=p_season_id and team_name is not null
    ) ranked;
  if v_standings='{}'::jsonb then raise exception 'No teams to rank'; end if;
  -- Repeated clicks with unchanged standings must not erase the last movement.
  if v_previous.standings=v_standings and v_previous.season_week=v_week then
    return public.get_season_rank_changes(p_season_id);
  end if;
  select jsonb_object_agg(key,
    case when v_previous.standings ? key then
      (v_previous.standings->key->>'rank')::integer-(value->>'rank')::integer
    else null end) into v_changes from jsonb_each(v_standings);
  insert into public.season_rank_snapshots(season_id,season_week,standings,changes)
    values(p_season_id,v_week,v_standings,v_changes);
  return public.get_season_rank_changes(p_season_id);
end;
$$;
revoke all on function public.admin_update_week_ranks(bigint, integer) from public, anon;
grant execute on function public.admin_update_week_ranks(bigint, integer) to authenticated;

revoke execute on function public.admin_update_week_ranks(bigint) from public, anon, authenticated;
revoke execute on function public.admin_update_current_week(bigint, integer) from public, anon, authenticated;

-- Recording immunity results no longer advances the season.
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
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and coalesce(is_admin, false)) then
    raise exception 'Only admins can set immunity results';
  end if;
  perform 1 from public.seasons where id = p_season_id and status in ('active', 'finale');
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

  perform public.recalculate_season_scores(p_season_id);
end;
$$;

