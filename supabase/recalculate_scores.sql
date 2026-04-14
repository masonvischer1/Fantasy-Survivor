-- Scoring automation for Survivor Draft
-- Uses existing profiles.team JSON + profiles.weekly_picks JSON.
-- Run this in Supabase SQL editor.

begin;

-- Global weekly winner source of truth (admin-controlled).
create table if not exists public.weekly_immunity_results (
  week integer primary key,
  phase text not null check (phase in ('tribal', 'individual')),
  winner_team text null,
  winner_contestant_id bigint null references public.contestants(id) on delete set null,
  winner_contestant_ids jsonb null,
  players_remaining integer null,
  bonus_points_awarded integer null,
  updated_by uuid null references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint weekly_immunity_results_winner_contestant_ids_is_array check (
    winner_contestant_ids is null or jsonb_typeof(winner_contestant_ids) = 'array'
  )
);

alter table public.weekly_immunity_results
  add column if not exists winner_contestant_ids jsonb null;

alter table public.weekly_immunity_results
  add column if not exists bonus_points_awarded integer null;

alter table public.weekly_immunity_results
  drop constraint if exists weekly_immunity_results_winner_contestant_ids_is_array;

alter table public.weekly_immunity_results
  add constraint weekly_immunity_results_winner_contestant_ids_is_array check (
    winner_contestant_ids is null or jsonb_typeof(winner_contestant_ids) = 'array'
  );

update public.weekly_immunity_results
set winner_contestant_ids = jsonb_build_array(winner_contestant_id)
where winner_contestant_id is not null
  and (winner_contestant_ids is null or winner_contestant_ids = '[]'::jsonb);

update public.weekly_immunity_results
set bonus_points_awarded = coalesce(bonus_points_awarded, players_remaining)
where phase = 'individual';

alter table public.weekly_immunity_results
  drop constraint if exists weekly_immunity_results_winner_check;

alter table public.weekly_immunity_results
  add constraint weekly_immunity_results_winner_check check (
    (phase = 'tribal' and winner_team is not null)
    or
    (
      phase = 'individual'
      and (
        winner_contestant_id is not null
        or (winner_contestant_ids is not null and jsonb_array_length(winner_contestant_ids) > 0)
      )
    )
  );

create index if not exists idx_weekly_immunity_results_updated_at
  on public.weekly_immunity_results(updated_at desc);

-- Recalculate all profile scores from source data.
create or replace function public.recalculate_scores(p_current_day integer default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_day integer;
begin
  -- Current game day for active contestants.
  -- If not supplied, infer from max elim_day seen so far.
  v_current_day := coalesce(
    p_current_day,
    (select coalesce(max(c.elim_day), 0) from public.contestants c)
  );

  with roster_points as (
    select
      p.id as profile_id,
      coalesce(sum(
        case
          -- Use contestant table as truth. Fallback to JSON values if needed.
          when coalesce(c.is_eliminated, false) then greatest(coalesce(c.elim_day, (t.player_json ->> 'elim_day')::integer, 0), 0)
          else greatest(v_current_day, 0)
        end
        +
        -- Finale jury votes support:
        -- If contestants has jury_votes_received, include it.
        coalesce((to_jsonb(c) ->> 'jury_votes_received')::integer, 0)
      ), 0) as team_points
    from public.profiles p
    left join lateral jsonb_array_elements(coalesce(p.team::jsonb, '[]'::jsonb)) t(player_json) on true
    left join public.contestants c
      on c.id = nullif(t.player_json ->> 'id', '')::bigint
    group by p.id
  ),
  normalized_weekly_results as (
    select
      r.week,
      r.phase,
      r.winner_team,
      coalesce(
        nullif(r.winner_contestant_ids, '[]'::jsonb),
        case
          when r.winner_contestant_id is not null then jsonb_build_array(r.winner_contestant_id)
          else '[]'::jsonb
        end
      ) as normalized_winner_ids,
      coalesce(r.bonus_points_awarded, r.players_remaining, 0) as awarded_points
    from public.weekly_immunity_results r
  ),
  bonus_points as (
    select
      p.id as profile_id,
      coalesce(sum(
        case
          when r.phase = 'tribal'
               and (p.weekly_picks ->> r.week::text) = r.winner_team
            then 5
          when r.phase = 'individual'
               and (
                 exists (
                   select 1
                   from jsonb_array_elements_text(r.normalized_winner_ids) winner_id
                   where winner_id = (p.weekly_picks ->> r.week::text)
                 )
                 or
                 exists (
                   select 1
                   from public.contestants c2
                   where c2.name = (p.weekly_picks ->> r.week::text)
                     and exists (
                       select 1
                       from jsonb_array_elements_text(r.normalized_winner_ids) winner_id
                       where winner_id = c2.id::text
                     )
                 )
               )
            then r.awarded_points
          else 0
        end
      ), 0) as bonus_points
    from public.profiles p
    left join normalized_weekly_results r on true
    group by p.id
  )
  update public.profiles p
  set
    team_points = rp.team_points,
    bonus_points = bp.bonus_points,
    total_score = rp.team_points + bp.bonus_points + coalesce(p.manual_points, 0)
  from roster_points rp
  join bonus_points bp
    on bp.profile_id = rp.profile_id
  where p.id = rp.profile_id;
end;
$$;

comment on function public.recalculate_scores(integer) is
'Recomputes team_points, bonus_points, and total_score for all profiles.';

-- Admin helper: set weekly immunity winner and recalculate immediately.
drop function if exists public.admin_set_weekly_immunity_result(integer, text, text, bigint, integer);
drop function if exists public.admin_set_weekly_immunity_result(integer, text, text, bigint, integer, integer, jsonb);

create or replace function public.admin_set_weekly_immunity_result(
  p_week integer,
  p_phase text,
  p_winner_team text default null,
  p_winner_contestant_id bigint default null,
  p_players_remaining integer default null,
  p_bonus_points_awarded integer default null,
  p_winner_contestant_ids jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_admin boolean;
  v_primary_winner_contestant_id bigint;
  v_players_remaining integer;
  v_bonus_points_awarded integer;
  v_winner_contestant_ids jsonb;
begin
  select coalesce(pr.is_admin, false)
  into v_is_admin
  from public.profiles pr
  where pr.id = auth.uid();

  if not coalesce(v_is_admin, false) then
    raise exception 'Only admins can set immunity results';
  end if;

  v_players_remaining := case
    when p_phase = 'individual' then coalesce(
      p_players_remaining,
      (
        select count(*)
        from public.contestants c
        where coalesce(c.is_eliminated, false) = false
      )
    )
    else p_players_remaining
  end;

  v_bonus_points_awarded := case
    when p_phase = 'individual' then coalesce(p_bonus_points_awarded, v_players_remaining)
    else p_bonus_points_awarded
  end;

  v_winner_contestant_ids := case
    when p_phase = 'individual' then coalesce(
      p_winner_contestant_ids,
      case
        when p_winner_contestant_id is not null then jsonb_build_array(p_winner_contestant_id)
        else '[]'::jsonb
      end
    )
    else null
  end;

  v_primary_winner_contestant_id := case
    when p_phase = 'individual' then coalesce(
      p_winner_contestant_id,
      (
        select nullif(value, '')::bigint
        from jsonb_array_elements_text(coalesce(v_winner_contestant_ids, '[]'::jsonb)) as winner(value)
        limit 1
      )
    )
    else null
  end;

  insert into public.weekly_immunity_results (
    week,
    phase,
    winner_team,
    winner_contestant_id,
    winner_contestant_ids,
    players_remaining,
    bonus_points_awarded,
    updated_by,
    updated_at
  )
  values (
    p_week,
    p_phase,
    p_winner_team,
    v_primary_winner_contestant_id,
    v_winner_contestant_ids,
    v_players_remaining,
    v_bonus_points_awarded,
    auth.uid(),
    now()
  )
  on conflict (week) do update
  set
    phase = excluded.phase,
    winner_team = excluded.winner_team,
    winner_contestant_id = excluded.winner_contestant_id,
    winner_contestant_ids = excluded.winner_contestant_ids,
    players_remaining = excluded.players_remaining,
    bonus_points_awarded = excluded.bonus_points_awarded,
    updated_by = excluded.updated_by,
    updated_at = excluded.updated_at;

  perform public.recalculate_scores();
end;
$$;

comment on function public.admin_set_weekly_immunity_result(integer, text, text, bigint, integer, integer, jsonb) is
'Admin upsert for weekly immunity winner; recalculates all scores.';

-- Optional triggers so contestant/pick edits auto-refresh scores.
create or replace function public.trigger_recalculate_scores()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.recalculate_scores();
  return null;
end;
$$;

drop trigger if exists trg_recalc_on_contestants on public.contestants;
create trigger trg_recalc_on_contestants
after insert or update of is_eliminated, elim_day on public.contestants
for each statement execute function public.trigger_recalculate_scores();

drop trigger if exists trg_recalc_on_profiles_picks on public.profiles;
create trigger trg_recalc_on_profiles_picks
after update of weekly_picks, team, manual_points on public.profiles
for each statement execute function public.trigger_recalculate_scores();

drop trigger if exists trg_recalc_on_weekly_results on public.weekly_immunity_results;
create trigger trg_recalc_on_weekly_results
after insert or update or delete on public.weekly_immunity_results
for each statement execute function public.trigger_recalculate_scores();

commit;
