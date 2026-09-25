create table if not exists public.season_rank_snapshots (
  id bigint generated always as identity primary key,
  season_id bigint not null references public.seasons(id),
  season_week integer not null,
  created_at timestamptz not null default now(),
  standings jsonb not null,
  changes jsonb not null
);
alter table public.season_rank_snapshots enable row level security;
revoke all on public.season_rank_snapshots from public, anon, authenticated;

create or replace function public.get_season_rank_changes(p_season_id bigint)
returns jsonb language sql stable security definer set search_path=public as $$
 select coalesce((select jsonb_build_object('updated_at',created_at,'changes',changes)
 from public.season_rank_snapshots where season_id=p_season_id order by id desc limit 1),
 jsonb_build_object('updated_at',null,'changes','{}'::jsonb));
$$;
revoke all on function public.get_season_rank_changes(bigint) from public;
grant execute on function public.get_season_rank_changes(bigint) to anon, authenticated;

create or replace function public.admin_update_week_ranks(p_season_id bigint)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_week integer;
  v_previous public.season_rank_snapshots%rowtype;
  v_standings jsonb;
  v_changes jsonb;
begin
  if not exists(select 1 from public.profiles where id=auth.uid() and coalesce(is_admin,false)) then
    raise exception 'Only admins can update week ranks';
  end if;
  select current_week into v_week from public.seasons where id=p_season_id and status in ('draft','active','finale') for update;
  if not found then raise exception 'Season is not active'; end if;
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
revoke all on function public.admin_update_week_ranks(bigint) from public, anon;
grant execute on function public.admin_update_week_ranks(bigint) to authenticated;
