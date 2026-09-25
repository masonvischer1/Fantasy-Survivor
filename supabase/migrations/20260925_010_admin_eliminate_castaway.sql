-- Record an elimination and update every team's score atomically.
create or replace function public.admin_eliminate_season_contestant(
  p_season_id bigint, p_contestant_id bigint, p_days integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and coalesce(is_admin, false)) then
    raise exception 'Only admins can eliminate castaways';
  end if;
  if p_days is null or p_days < 1 or p_days > 32767 then
    raise exception 'Days lasted must be a positive whole number (1–32767)';
  end if;
  perform 1 from public.seasons where id = p_season_id and status in ('draft', 'active', 'finale') for update;
  if not found then raise exception 'Season is not active'; end if;

  update public.season_contestants
  set is_eliminated = true, elimination_day = p_days
  where id = p_contestant_id and season_id = p_season_id and not is_eliminated;
  if not found then raise exception 'Castaway not found or already eliminated'; end if;

  perform public.recalculate_season_scores(p_season_id);
end;
$$;
revoke all on function public.admin_eliminate_season_contestant(bigint, bigint, integer) from public;
grant execute on function public.admin_eliminate_season_contestant(bigint, bigint, integer) to authenticated;
