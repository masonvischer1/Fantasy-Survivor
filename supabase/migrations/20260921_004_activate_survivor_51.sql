-- Make Survivor 51 the writable active season while keeping Survivor 50 archived.
begin;

update public.seasons
set status = 'archived', updated_at = now()
where slug = 'survivor-50';

update public.seasons
set status = 'active', current_week = 1, started_at = coalesce(started_at, current_date), updated_at = now()
where slug = 'survivor-51';

-- Returning users keep their identity and avatar, but every gameplay field is new.
insert into public.season_entries (
  season_id, profile_id, player_name, team_name, avatar_url,
  drafted_team, weekly_picks, team_points, bonus_points, manual_points,
  final_winner_original_contestant_id, final_wager_points, total_score, final_rank
)
select
  s.id, p.id, p.player_name, null, p.avatar_url,
  '[]'::jsonb, '{}'::jsonb, 0, 0, 0,
  null, 0, 0, null
from public.profiles p
cross join public.seasons s
where s.slug = 'survivor-51'
on conflict (season_id, profile_id) do nothing;

drop policy if exists "Users can insert their current season entry" on public.season_entries;
create policy "Users can insert their current season entry"
  on public.season_entries for insert to authenticated
  with check (profile_id = auth.uid());

drop policy if exists "Users can update their own season entry" on public.season_entries;
create policy "Users can update their own season entry"
  on public.season_entries for update to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

grant insert, update on public.season_entries to authenticated;
grant usage, select on sequence public.season_entries_id_seq to authenticated;

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
    select
      entry.id as entry_id,
      coalesce(sum(
        case
          when coalesce(contestant.is_eliminated, false)
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
  ),
  bonus_points as (
    select
      entry.id as entry_id,
      coalesce(sum(
        case
          when result.phase = 'tribal'
           and entry.weekly_picks ->> result.week::text = result.winner_team then 5
          when result.phase = 'individual'
           and exists (
             select 1
             from jsonb_array_elements_text(
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

create or replace function public.admin_set_season_weekly_result(
  p_season_id bigint,
  p_week integer,
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
  if not exists (
    select 1 from public.profiles where id = auth.uid() and coalesce(is_admin, false)
  ) then
    raise exception 'Only admins can set immunity results';
  end if;

  if not exists (
    select 1 from public.seasons
    where id = p_season_id and status in ('active', 'finale')
  ) then
    raise exception 'Results can only be set for the active season';
  end if;

  select nullif(value, '')::bigint into v_primary_winner
  from jsonb_array_elements_text(coalesce(p_winner_contestant_ids, '[]'::jsonb)) winner(value)
  limit 1;

  if v_primary_winner is null then
    raise exception 'Select at least one winner';
  end if;

  insert into public.season_weekly_results (
    season_id, week, phase, winner_original_contestant_id,
    winner_original_contestant_ids, players_remaining, bonus_points_awarded,
    source_updated_at
  ) values (
    p_season_id, p_week, 'individual', v_primary_winner,
    p_winner_contestant_ids, p_players_remaining, p_bonus_points_awarded,
    now()
  )
  on conflict (season_id, week) do update set
    phase = excluded.phase,
    winner_team = null,
    winner_original_contestant_id = excluded.winner_original_contestant_id,
    winner_original_contestant_ids = excluded.winner_original_contestant_ids,
    players_remaining = excluded.players_remaining,
    bonus_points_awarded = excluded.bonus_points_awarded,
    source_updated_at = excluded.source_updated_at;

  perform public.recalculate_season_scores(p_season_id);
end;
$$;

grant execute on function public.admin_set_season_weekly_result(bigint, integer, jsonb, integer, integer) to authenticated;

commit;
