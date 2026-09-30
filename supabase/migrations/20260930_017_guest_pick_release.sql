-- Guest pick visibility is enforced in the database, including authenticated
-- callers of the guest RPC. Schedule each week once when the admin activates it.
begin;

create table public.season_guest_pick_releases (
  season_id bigint not null references public.seasons(id) on delete cascade,
  week integer not null check (week > 0),
  release_at timestamptz not null,
  primary key (season_id, week)
);
alter table public.season_guest_pick_releases enable row level security;
revoke all on public.season_guest_pick_releases from public, anon, authenticated;

-- Compute in local Eastern time before converting to UTC, preserving DST.
-- At or after Wednesday's cutoff, a newly activated week targets next Wednesday.
create or replace function public.next_guest_pick_release(p_activated_at timestamptz)
returns timestamptz language plpgsql immutable set search_path=public as $$
declare
  v_local timestamp := p_activated_at at time zone 'America/New_York';
  v_release timestamp;
begin
  v_release := v_local::date + ((3-extract(dow from v_local)::integer+7)%7) + time '19:55';
  if v_release <= v_local then v_release := v_release + interval '7 days'; end if;
  return v_release at time zone 'America/New_York';
end;
$$;
revoke all on function public.next_guest_pick_release(timestamptz) from public, anon, authenticated;

create or replace function public.schedule_guest_pick_release()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if TG_OP='UPDATE' then
    if NEW.current_week is not distinct from OLD.current_week then return NEW; end if;
  end if;
  insert into public.season_guest_pick_releases(season_id,week,release_at)
    values(NEW.id,NEW.current_week,public.next_guest_pick_release(now()))
    on conflict(season_id,week) do nothing;
  return NEW;
end;
$$;
revoke all on function public.schedule_guest_pick_release() from public, anon, authenticated;
create trigger schedule_guest_pick_release
  after insert or update of current_week on public.seasons
  for each row execute function public.schedule_guest_pick_release();

-- Preserve past weeks already public before this feature. Anchor the initial
-- current week to its first ranking snapshot since the last week change, so
-- installing after an episode doesn't move that week's release to next week.
-- If no activation history exists, initialize conservatively from installation.
insert into public.season_guest_pick_releases(season_id,week,release_at)
select s.id,w.week,case when w.week<s.current_week then now() else public.next_guest_pick_release(coalesce((
  select min(r.created_at) from public.season_rank_snapshots r
  where r.season_id=s.id and r.season_week=s.current_week
    and r.id>coalesce((select max(previous.id) from public.season_rank_snapshots previous where previous.season_id=s.id and previous.season_week<>s.current_week),0)
),now())) end
from public.seasons s cross join lateral generate_series(1,s.current_week) w(week)
where s.status in ('draft','active','finale');

create or replace function public.get_guest_season_snapshot()
returns jsonb language sql stable security definer set search_path = public
as $$
with active as (
 select * from public.seasons where status in ('draft','active','finale') order by id desc limit 1
)
select jsonb_build_object(
 'season', (select jsonb_build_object('id',id,'name',name,'current_week',current_week,'status',status,'episode_count',episode_count,'merge_week',merge_week,'picks_start_week',picks_start_week,
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
revoke all on function public.get_guest_season_snapshot() from public;
grant execute on function public.get_guest_season_snapshot() to anon, authenticated;

commit;
