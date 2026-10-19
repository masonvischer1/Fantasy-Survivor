begin;
alter table public.seasons add column if not exists disabled_pick_weeks jsonb not null default '[]'::jsonb;
update public.seasons set tribes='["Savu","Toka","Dina"]', disabled_pick_weeks='[4]', updated_at=now() where slug='survivor-51';
create temporary table swap_tribes(name text primary key, tribe text not null) on commit drop;
insert into swap_tribes values
('Alexis Levine','Savu'),
('Devin Way','Savu'),
('Angelica Loblack','Savu'),
('Ori Jean-Charles','Savu'),
('Brady Booker','Toka'),
('Carter Krull','Toka'),
('Kristin Flickinger','Toka'),
('Maggie Nestor','Toka'),
('Mike Pinsky','Toka'),
('An Nguyen','Toka'),
('Cristian Chavez','Dina'),
('Danny Kilby','Dina'),
('Eric Macksoud','Dina'),
('Lewis Kelly','Dina'),
('Linnea Capobianco','Dina'),
('Sharonda Cox','Dina');
do $$ begin
if (select count(*) from public.season_contestants c join public.seasons s on s.id=c.season_id join swap_tribes t on t.name=btrim(c.name) where s.slug='survivor-51') <> 16 then raise exception 'Expected 16 matching castaways'; end if;
end $$;
update public.season_contestants c set tribe=t.tribe from swap_tribes t, public.seasons s where c.season_id=s.id and s.slug='survivor-51' and btrim(c.name)=t.name;
update public.season_entries set weekly_picks=weekly_picks-'4' where season_id=(select id from public.seasons where slug='survivor-51');
delete from public.season_weekly_results where season_id=(select id from public.seasons where slug='survivor-51') and week=4;
-- Enforce N/A even for clients running an older frontend.
create or replace function public.reject_disabled_pick_weeks() returns trigger language plpgsql set search_path=public as $$
declare disabled jsonb;
begin
select disabled_pick_weeks into disabled from public.seasons where id=new.season_id;
if tg_table_name='season_entries' then
 if exists(select 1 from jsonb_array_elements_text(disabled) w(week) where new.weekly_picks ? w.week) then raise exception 'Weekly picks are N/A for a disabled week'; end if;
else
 if disabled @> jsonb_build_array(new.week) then raise exception 'Weekly picks are N/A for this week'; end if;
end if;
return new;
end $$;
create trigger reject_disabled_entry_picks before insert or update of weekly_picks on public.season_entries for each row execute function public.reject_disabled_pick_weeks();
create trigger reject_disabled_week_results before insert or update on public.season_weekly_results for each row execute function public.reject_disabled_pick_weeks();
select public.recalculate_season_scores(id) from public.seasons where slug='survivor-51';
create or replace function public.get_guest_season_snapshot()
returns jsonb language sql stable security definer set search_path = public
as $$
with active as (
 select * from public.seasons where status in ('draft','active','finale') order by id desc limit 1
)
select jsonb_build_object(
 'season', (select jsonb_build_object('id',id,'name',name,'current_week',current_week,'status',status,'episode_count',episode_count,'merge_week',merge_week,'picks_start_week',picks_start_week,'disabled_pick_weeks',disabled_pick_weeks,'tribes',tribes,
   'guest_pick_release_at',(select releases.release_at from public.season_guest_pick_releases releases where releases.season_id=active.id and releases.week=active.current_week),
   'guest_released_pick_weeks',coalesce((select jsonb_agg(releases.week order by releases.week) from public.season_guest_pick_releases releases where releases.season_id=active.id and releases.week<=active.current_week and releases.release_at<=now()),'[]'::jsonb)) from active),
 'castaways', coalesce((select jsonb_agg(jsonb_build_object(
   'id',c.id,'name',c.name,'display_name',c.display_name,'picture_url',c.picture_url,
   'tribe',c.tribe,'age',c.age,'occupation',c.occupation,'hometown',c.hometown,
   'current_residence',c.current_residence,'bio',c.bio,'is_eliminated',c.is_eliminated,
   'elimination_day',c.elimination_day,'jury_votes_received',c.jury_votes_received
 ) order by c.name) from public.season_contestants c join active s on s.id=c.season_id),'[]'::jsonb),
 'teams', coalesce((select jsonb_agg(jsonb_build_object(
   'id',e.id,'player_name',e.player_name,'team_name',e.team_name,'avatar_url',e.avatar_url,'drafted_team',
     (select coalesce(jsonb_agg(coalesce(p.value->'id',p.value)),'[]'::jsonb) from jsonb_array_elements(e.drafted_team) p(value)),
   'weekly_picks',coalesce((select jsonb_object_agg(pick.key,pick.value)
     from jsonb_each(coalesce(e.weekly_picks,'{}'::jsonb)) pick
     join public.season_guest_pick_releases releases on releases.season_id=e.season_id and releases.week::text=pick.key
     where releases.week<=s.current_week and releases.release_at<=now()),'{}'::jsonb),'team_points',e.team_points,'bonus_points',e.bonus_points,'manual_points',e.manual_points,'total_score',e.total_score
 ) order by e.total_score desc,e.team_name) from public.season_entries e join active s on s.id=e.season_id where e.team_name is not null),'[]'::jsonb),
 'rank_snapshot', public.get_season_rank_changes((select id from active)),
 'results', coalesce((select jsonb_agg(jsonb_build_object('week',r.week,'phase',r.phase,'winner_team',r.winner_team,
   'winner_original_contestant_ids',r.winner_original_contestant_ids,'bonus_points_awarded',r.bonus_points_awarded
 ) order by r.week desc) from public.season_weekly_results r join active s on s.id=r.season_id),'[]'::jsonb)
);
$$;
commit;
