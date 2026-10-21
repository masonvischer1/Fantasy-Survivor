import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { PGlite } from '@electric-sql/pglite'

test('future tribal picks earn five while historical awards survive corrections and recalculation', async () => {
  const db = new PGlite()
  try {
    await db.exec(`
      create schema auth;
      create function auth.uid() returns integer language sql as $$ select 1 $$;
      create table profiles(id integer, is_admin boolean);
      insert into profiles values(1,true);
      create table seasons(id bigint, status text);
      insert into seasons values(1,'active');
      create table season_contestants(id bigint, season_id bigint, is_eliminated boolean,
        elimination_day integer, jury_votes_received integer);
      create table season_entries(id bigint, season_id bigint, drafted_team jsonb,
        weekly_picks jsonb, team_points integer, bonus_points integer, manual_points integer, total_score integer);
      create table season_weekly_results(season_id bigint, week integer, phase text, winner_team text,
        winner_original_contestant_id bigint, winner_original_contestant_ids jsonb,
        players_remaining integer, bonus_points_awarded integer, source_updated_at timestamptz,
        unique(season_id,week));
      insert into season_entries values(1,1,'[]','{"2":"Savu","3":"Toka","4":"Dina","5":"Dina","6":"42"}',0,0,2,0);
      insert into season_weekly_results(season_id,week,phase,winner_team,bonus_points_awarded) values
        (1,2,'tribal','Savu',3),(1,3,'tribal','Toka',null),(1,4,'tribal','Dina',0);
    `)
    await db.exec(await readFile(new URL('../supabase/migrations/20261021_020_five_point_tribal_picks.sql', import.meta.url), 'utf8'))
    const record = (week, phase, tribe, winners, bonus) => db.query(
      'select admin_set_season_weekly_result(1,$1,$2,$3,$4,10,$5)',
      [week, phase, tribe, JSON.stringify(winners), bonus])
    await record(5, 'tribal', 'Dina', [], 3) // Old clients cannot override the new reward.
    await record(2, 'tribal', 'Savu', [], 5) // Editing history preserves its reward.
    await record(4, 'tribal', 'Dina', [], 5)
    await record(6, 'individual', null, [42], 10)
    assert.deepEqual((await db.query('select week,bonus_points_awarded from season_weekly_results order by week')).rows,
      [{week:2,bonus_points_awarded:3},{week:3,bonus_points_awarded:null},
        {week:4,bonus_points_awarded:0},{week:5,bonus_points_awarded:5},{week:6,bonus_points_awarded:10}])
    assert.deepEqual((await db.query('select bonus_points,total_score from season_entries')).rows,
      [{bonus_points:21,total_score:23}])
    await record(5, 'tribal', 'Toka', [], 3)
    assert.equal((await db.query('select bonus_points from season_entries')).rows[0].bonus_points,16)
  } finally {
    await db.close()
  }
})
