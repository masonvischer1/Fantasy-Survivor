create or replace function public.set_season_draft_pick(
  p_season_id bigint,
  p_contestant_id bigint,
  p_add boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_season public.seasons%rowtype;
  v_entry public.season_entries%rowtype;
  v_roster jsonb;
  v_count integer;
  v_limit integer;
  v_exists boolean;
begin
  if p_add is distinct from true then
    raise exception 'Draft picks are permanent and cannot be removed or replaced';
  end if;

  select * into v_season from public.seasons
  where id = p_season_id and status in ('draft', 'active', 'finale');
  if not found then raise exception 'Season is not active'; end if;

  select * into v_entry from public.season_entries
  where season_id = p_season_id and profile_id = auth.uid()
  for update;
  if not found then raise exception 'Season entry not found'; end if;

  if not exists (
    select 1 from public.season_contestants
    where id = p_contestant_id and season_id = p_season_id and not is_eliminated
  ) then raise exception 'Castaway is not available'; end if;

  v_roster := coalesce(v_entry.drafted_team, '[]'::jsonb);
  select exists (
    select 1 from jsonb_array_elements(v_roster) pick(value)
    where coalesce(pick.value->>'id', trim(both '"' from pick.value::text)) = p_contestant_id::text
  ) into v_exists;

  if p_add then
    if v_exists then return v_roster; end if;
    v_limit := case when v_season.current_week >= v_season.merge_week
      then v_season.merge_draft_size else v_season.initial_draft_size end;
    v_count := jsonb_array_length(v_roster);
    if v_count >= v_limit then
      raise exception 'Your tribe is full for the current phase (% players)', v_limit;
    end if;
    if v_season.current_week > 1 and v_count < v_season.initial_draft_size then
      raise exception 'The initial draft is closed';
    end if;
    v_roster := v_roster || jsonb_build_array(p_contestant_id);
  end if;

  update public.season_entries set drafted_team = v_roster where id = v_entry.id;
  perform public.recalculate_season_scores(p_season_id);
  return v_roster;
end;
$$;

-- Players must use the validated draft RPC; direct roster edits are forbidden.
-- Database administrators can still perform an explicitly authorized reset.
create or replace function public.guard_direct_season_roster_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') and new.drafted_team is distinct from old.drafted_team then
    raise exception 'Draft picks are permanent. Use the draft action to fill open spots';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_direct_season_roster_update on public.season_entries;
create trigger guard_direct_season_roster_update
before update of drafted_team on public.season_entries
for each row execute function public.guard_direct_season_roster_update();
