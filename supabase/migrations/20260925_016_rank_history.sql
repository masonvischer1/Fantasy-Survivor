-- Read-only chart projection. Re-saving a week replaces its displayed point;
-- the underlying snapshot audit history remains intact.
create or replace function public.get_season_rank_history()
returns jsonb language sql stable security definer set search_path=public as $$
with active as (
 select id,name,episode_count,current_week from public.seasons where status in ('draft','active','finale') order by id desc limit 1
), weekly as (
 select distinct on (season_week) season_week,created_at,standings
 from public.season_rank_snapshots where season_id=(select id from active) and season_week > 1 and season_week <= (select current_week from active)
 order by season_week,id desc
)
select jsonb_build_object(
 'season',(select jsonb_build_object('id',id,'name',name,'episode_count',episode_count,'current_week',current_week) from active),
 'teams',coalesce((select jsonb_agg(jsonb_build_object('id',id,'team_name',team_name,'avatar_url',avatar_url) order by id)
 from public.season_entries where season_id=(select id from active) and team_name is not null),'[]'::jsonb),
 'weeks',coalesce((select jsonb_agg(jsonb_build_object('week',season_week-1,'saved_at',created_at,'ranks',
 (select jsonb_object_agg(key,value->'rank') from jsonb_each(standings))) order by season_week) from weekly),'[]'::jsonb)
);
$$;
revoke all on function public.get_season_rank_history() from public;
grant execute on function public.get_season_rank_history() to anon,authenticated;
