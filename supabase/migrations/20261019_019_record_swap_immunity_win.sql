begin;
-- Keep submissions disabled, but retain actual challenge winners for tribe history.
create or replace function public.reject_disabled_pick_weeks()
returns trigger language plpgsql set search_path=public as $$
declare disabled jsonb;
begin
  select disabled_pick_weeks into disabled from public.seasons where id=new.season_id;
  if tg_table_name='season_entries' then
    if exists(select 1 from jsonb_array_elements_text(disabled) w(week) where new.weekly_picks ? w.week) then
      raise exception 'Weekly picks are N/A for a disabled week';
    end if;
  elsif disabled @> jsonb_build_array(new.week) then
    new.bonus_points_awarded := 0;
  end if;
  return new;
end $$;

insert into public.season_weekly_results
  (season_id, week, phase, winner_team, bonus_points_awarded, source_updated_at)
select id, 4, 'tribal', 'Dina', 0, now() from public.seasons where slug='survivor-51'
on conflict (season_id, week) do update set
  phase='tribal', winner_team='Dina', bonus_points_awarded=0,
  winner_original_contestant_id=null, winner_original_contestant_ids=null,
  source_updated_at=now();
commit;
