-- Break score ties by active drafted castaways. Preserve historical snapshots.
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
  select coalesce(jsonb_object_agg(id::text,jsonb_build_object('rank',place,'score',total_score,'remaining',remaining)),'{}'::jsonb)
    into v_standings from (
      select id,total_score,remaining,rank() over(order by coalesce(total_score,0) desc,remaining desc) as place
      from (
        select e.id,e.total_score,(select count(distinct c.id)
          from jsonb_array_elements(e.drafted_team) pick(value)
          join public.season_contestants c on c.id::text=coalesce(pick.value->>'id',trim(both '"' from pick.value::text))
            and c.season_id=e.season_id and not c.is_eliminated) as remaining
        from public.season_entries e where e.season_id=p_season_id and e.team_name is not null
      ) counted
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
