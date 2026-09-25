-- Public read-only projection: no account IDs or contact information; includes submitted weekly picks.
create or replace function public.get_guest_season_snapshot()
returns jsonb language sql stable security definer set search_path = public
as $$
with active as (
 select * from public.seasons where status in ('draft','active','finale') order by id desc limit 1
)
select jsonb_build_object(
 'season', (select jsonb_build_object('id',id,'name',name,'current_week',current_week,'status',status,'episode_count',episode_count,'merge_week',merge_week,'picks_start_week',picks_start_week) from active),
 'castaways', coalesce((select jsonb_agg(jsonb_build_object(
   'id',c.id,'name',c.name,'display_name',c.display_name,'picture_url',c.picture_url,
   'tribe',c.tribe,'age',c.age,'occupation',c.occupation,'hometown',c.hometown,
   'current_residence',c.current_residence,'bio',c.bio,'is_eliminated',c.is_eliminated,
   'elimination_day',c.elimination_day,'jury_votes_received',c.jury_votes_received
 ) order by c.name) from public.season_contestants c join active s on s.id=c.season_id),'[]'::jsonb),
 'teams', coalesce((select jsonb_agg(jsonb_build_object(
   'id',e.id,'player_name',e.player_name,'team_name',e.team_name,'avatar_url',e.avatar_url,'drafted_team',
     (select coalesce(jsonb_agg(coalesce(p.value->'id',p.value)),'[]'::jsonb) from jsonb_array_elements(e.drafted_team) p(value)),
   'weekly_picks',e.weekly_picks,'team_points',e.team_points,'bonus_points',e.bonus_points,'manual_points',e.manual_points,'total_score',e.total_score
 ) order by e.total_score desc,e.team_name) from public.season_entries e join active s on s.id=e.season_id where e.team_name is not null),'[]'::jsonb),
 'rank_snapshot', public.get_season_rank_changes((select id from active)),
 'results', coalesce((select jsonb_agg(jsonb_build_object('week',r.week,'phase',r.phase,'winner_team',r.winner_team,
   'winner_original_contestant_ids',r.winner_original_contestant_ids,'bonus_points_awarded',r.bonus_points_awarded
 ) order by r.week desc) from public.season_weekly_results r join active s on s.id=r.season_id),'[]'::jsonb)
);
$$;
revoke all on function public.get_guest_season_snapshot() from public;
grant execute on function public.get_guest_season_snapshot() to anon, authenticated;
-- Older functions may inherit PUBLIC execute by default. Guests cannot invoke mutations.
do $$
declare f record;
begin
 for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and (p.proname like 'admin_%' or p.proname in ('recalculate_season_scores','set_season_draft_pick','submit_season_weekly_pick'))
 loop
   execute format('revoke execute on function %s from public, anon',f.signature);
   execute format('grant execute on function %s to authenticated',f.signature);
 end loop;
end $$;

-- Guests read league data only through the projection, never account/entry rows.
revoke all on public.profiles, public.season_entries from anon, public;
