-- Support pre-merge tribal picks and the two Survivor 51 tribes.
begin;

alter table public.seasons add column if not exists merge_week integer not null default 6;
alter table public.seasons add column if not exists tribes jsonb not null default '[]'::jsonb;

update public.seasons
set merge_week = 6,
    tribes = '["Savu", "Toka"]'::jsonb,
    updated_at = now()
where slug = 'survivor-51';

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
  if not exists (
    select 1 from public.profiles where id = auth.uid() and coalesce(is_admin, false)
  ) then
    raise exception 'Only admins can set immunity results';
  end if;

  if p_phase not in ('tribal', 'individual') then
    raise exception 'Pick phase must be tribal or individual';
  end if;

  if p_phase = 'tribal' and nullif(p_winner_team, '') is null then
    raise exception 'Select a winning tribe';
  end if;

  if p_phase = 'individual' then
    select nullif(value, '')::bigint into v_primary_winner
    from jsonb_array_elements_text(coalesce(p_winner_contestant_ids, '[]'::jsonb)) winner(value)
    limit 1;
    if v_primary_winner is null then raise exception 'Select at least one winner'; end if;
  end if;

  insert into public.season_weekly_results (
    season_id, week, phase, winner_team, winner_original_contestant_id,
    winner_original_contestant_ids, players_remaining, bonus_points_awarded,
    source_updated_at
  ) values (
    p_season_id, p_week, p_phase,
    case when p_phase = 'tribal' then p_winner_team end,
    case when p_phase = 'individual' then v_primary_winner end,
    case when p_phase = 'individual' then p_winner_contestant_ids end,
    p_players_remaining,
    case when p_phase = 'tribal' then 5 else p_bonus_points_awarded end,
    now()
  )
  on conflict (season_id, week) do update set
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

grant execute on function public.admin_set_season_weekly_result(bigint, integer, text, text, jsonb, integer, integer) to authenticated;

commit;
