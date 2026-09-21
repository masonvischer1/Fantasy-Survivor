-- Allow users to lock picks for any unresolved week, including future weeks.
begin;

create or replace function public.submit_season_weekly_pick(
  p_season_id bigint,
  p_week integer,
  p_pick text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_season public.seasons%rowtype;
  v_entry public.season_entries%rowtype;
  v_phase text;
  v_picks jsonb;
begin
  select * into v_season from public.seasons
  where id = p_season_id and status in ('active', 'finale');
  if not found then raise exception 'Season is not active'; end if;
  if p_week < 1 or p_week > v_season.episode_count then raise exception 'Invalid week'; end if;
  if exists (select 1 from public.season_weekly_results where season_id = p_season_id and week = p_week) then
    raise exception 'This week is already locked';
  end if;

  v_phase := case when p_week < v_season.merge_week then 'tribal' else 'individual' end;
  if v_phase = 'tribal' then
    if not (v_season.tribes ? p_pick) then raise exception 'Choose a valid tribe'; end if;
  else
    if p_pick !~ '^\d+$' or not exists (
      select 1 from public.season_contestants
      where id = p_pick::bigint and season_id = p_season_id and not is_eliminated
    ) then raise exception 'Choose an active castaway'; end if;
  end if;

  select * into v_entry from public.season_entries
  where season_id = p_season_id and profile_id = auth.uid()
  for update;
  if not found then raise exception 'Season entry not found'; end if;
  if coalesce(v_entry.weekly_picks, '{}'::jsonb) ? p_week::text then
    raise exception 'Your pick is already locked';
  end if;

  v_picks := jsonb_set(coalesce(v_entry.weekly_picks, '{}'::jsonb), array[p_week::text], to_jsonb(p_pick), true);
  update public.season_entries set weekly_picks = v_picks where id = v_entry.id;
  return v_picks;
end;
$$;

grant execute on function public.submit_season_weekly_pick(bigint, integer, text) to authenticated;

commit;
