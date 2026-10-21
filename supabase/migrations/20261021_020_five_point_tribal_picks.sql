-- Five-point tribal picks start in Week 5, following the Week 4 tribe swap.
-- Existing awards are retained; legacy results without an award remain worth three.
begin;

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
           and entry.weekly_picks ->> result.week::text = result.winner_team then coalesce(result.bonus_points_awarded, 3)
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
    case when p_phase = 'tribal' then
      case when p_week >= 5 then 5 else 3 end
    else p_bonus_points_awarded end,
    now()
  ) on conflict (season_id, week) do update set
    phase = excluded.phase,
    winner_team = excluded.winner_team,
    winner_original_contestant_id = excluded.winner_original_contestant_id,
    winner_original_contestant_ids = excluded.winner_original_contestant_ids,
    players_remaining = excluded.players_remaining,
    -- Keep the recorded award when correcting an existing tribal result.
    bonus_points_awarded = case
      when season_weekly_results.phase = 'tribal' and excluded.phase = 'tribal'
        then coalesce(season_weekly_results.bonus_points_awarded, 3)
      else excluded.bonus_points_awarded end,
    source_updated_at = excluded.source_updated_at;

  perform public.recalculate_season_scores(p_season_id);
end;
$$;


commit;
