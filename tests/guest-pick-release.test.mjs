import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { PGlite } from '@electric-sql/pglite'
import { guestPickReleaseMessage, isGuestPickWeekReleased } from '../src/utils/guestPickVisibility.js'

// An isolated database exercises the actual migration; no live credentials or data.
const fixture = `
create role anon;
create role authenticated;
create table public.seasons (
  id bigint primary key, name text, current_week integer, status text,
  episode_count integer, merge_week integer, picks_start_week integer
);
create table public.season_entries (
  id bigint primary key, season_id bigint, player_name text, team_name text,
  avatar_url text, drafted_team jsonb, weekly_picks jsonb, team_points integer,
  bonus_points integer, manual_points integer, total_score integer
);
create table public.season_contestants (
  id bigint, season_id bigint, name text, display_name text, picture_url text,
  tribe text, age integer, occupation text, hometown text, current_residence text,
  bio text, is_eliminated boolean, elimination_day integer, jury_votes_received integer
);
create table public.season_weekly_results (
  season_id bigint, week integer, phase text, winner_team text,
  winner_original_contestant_ids jsonb, bonus_points_awarded integer
);
create table public.season_rank_snapshots (
  id bigint primary key, season_id bigint, season_week integer, created_at timestamptz
);
grant select on public.season_entries to authenticated;
create function public.get_season_rank_changes(bigint) returns jsonb
language sql as $$ select '{}'::jsonb $$;
insert into seasons values(1,'Test season',2,'active',15,7,2);
insert into season_entries values
  (1,1,'Player','Team',null,'[]','{"1":"Savu","2":"Toka","3":"42","invalid":"Savu"}',0,0,0,0),
  (2,1,'Pending','Pending team',null,'[]','{}',0,0,0,0);
`

test('guest cutoff scheduling and database privacy', async () => {
  const db = new PGlite()
  try {
    await db.exec(fixture)
    await db.exec(await readFile(new URL('../supabase/migrations/20260930_017_guest_pick_release.sql', import.meta.url), 'utf8'))
    const scalar = async (sql, args = []) => (await db.query(sql, args)).rows[0].value
    const snapshot = async () => {
      const data = await scalar('select public.get_guest_season_snapshot() as value')
      data.teams.sort((a, b) => a.id - b.id)
      return data
    }

    // Before, exactly at, and after the cutoff, plus UTC crossings and DST changes.
    const dates = [
      ['2026-09-28T12:00:00Z', '2026-09-30T23:55:00Z'],
      ['2026-09-30T23:54:59Z', '2026-09-30T23:55:00Z'],
      ['2026-09-30T23:55:00Z', '2026-10-07T23:55:00Z'],
      ['2026-10-01T00:30:00Z', '2026-10-07T23:55:00Z'],
      ['2026-10-30T12:00:00Z', '2026-11-05T00:55:00Z'],
      ['2026-03-06T12:00:00Z', '2026-03-11T23:55:00Z']
    ]
    for (const [activated, expected] of dates) {
      const actual = await scalar('select public.next_guest_pick_release($1) as value', [activated])
      assert.equal(new Date(actual).toISOString(), new Date(expected).toISOString())
    }
    let data = await snapshot()
    assert.deepEqual(data.teams[0].weekly_picks, { 1: 'Savu' })
    assert.deepEqual(data.teams[1].weekly_picks, {})
    assert.deepEqual(data.season.guest_released_pick_weeks, [1])
    assert.ok(data.season.guest_pick_release_at)

    // Saving rankings for the same week does not reschedule its cutoff.
    const original = data.season.guest_pick_release_at
    await db.exec('update seasons set current_week=2 where id=1')
    assert.equal((await snapshot()).season.guest_pick_release_at, original)
    await db.exec('update seasons set current_week=3 where id=1')
    const thirdRelease = (await snapshot()).season.guest_pick_release_at
    await db.exec('update seasons set current_week=2 where id=1')
    assert.equal((await snapshot()).season.guest_pick_release_at, original)
    await db.exec('update seasons set current_week=3 where id=1')
    assert.equal((await snapshot()).season.guest_pick_release_at, thirdRelease)
    await db.exec('update seasons set current_week=2 where id=1')

    // Future picks remain private even if their schedule has already elapsed.
    await db.exec("update season_guest_pick_releases set release_at=now()-interval '1 day' where week=3")
    assert.deepEqual((await snapshot()).teams[0].weekly_picks, { 1: 'Savu' })

    // The saved release is inclusive: still hidden just before it, public at it.
    await db.exec('begin')
    await db.exec("update season_guest_pick_releases set release_at=now()+interval '1 second' where week=2")
    assert.deepEqual((await snapshot()).teams[0].weekly_picks, { 1: 'Savu' })
    await db.exec('update season_guest_pick_releases set release_at=now() where week=2')
    assert.deepEqual((await snapshot()).teams[0].weekly_picks, { 1: 'Savu', 2: 'Toka' })
    await db.exec('rollback')

    // Anonymous users AND signed-in users calling the guest RPC get redacted data.
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`set role ${role}`)
      data = await snapshot()
      assert.deepEqual(data.teams[0].weekly_picks, { 1: 'Savu' })
      assert.equal(await scalar("select has_table_privilege(current_user,'public.season_guest_pick_releases','UPDATE') as value"), false)
      await assert.rejects(db.query('select * from public.season_guest_pick_releases'), /permission denied/)
      if (role === 'anon') await assert.rejects(db.query('select * from public.season_entries'), /permission denied/)
      await assert.rejects(db.query('select public.next_guest_pick_release(now())'), /permission denied/)
      await db.exec('reset role')
    }
    // Once released, picks stay public as the clock moves on.
    await db.exec("update season_guest_pick_releases set release_at=now()-interval '8 days' where week=2")
    assert.deepEqual((await snapshot()).teams[0].weekly_picks, { 1: 'Savu', 2: 'Toka' })
    // Newly inserted seasons also receive an initial release schedule.
    await db.exec("insert into seasons values(2,'New season',1,'draft',15,7,2)")
    assert.equal(await scalar('select count(*)::integer as value from season_guest_pick_releases where season_id=2'), 1)
  } finally {
    await db.close()
  }
})

test('guest UI uses server release decisions and explicit Eastern release labels', () => {
  const season = { current_week: 2, guest_released_pick_weeks: [1], guest_pick_release_at: '2026-09-30T23:55:00Z' }
  assert.equal(isGuestPickWeekReleased(season, 1), true)
  assert.equal(isGuestPickWeekReleased(season, '1'), true)
  assert.equal(isGuestPickWeekReleased(season, 2), false)
  assert.equal(isGuestPickWeekReleased(season, 3), false)
  assert.equal(isGuestPickWeekReleased({}, 1), false)
  assert.match(guestPickReleaseMessage(season), /Wednesday, Sep 30, 7:55 PM EDT/)
  assert.match(guestPickReleaseMessage({ ...season, guest_pick_release_at: '2026-11-05T00:55:00Z' }), /Wednesday, Nov 4, 7:55 PM EST/)
  assert.match(guestPickReleaseMessage(season, 3), /not public yet/)
})

test('installation preserves the release anchored to the current week activation', async () => {
  for (const [history, expected] of [
    ["(1,1,1,'2026-09-20T12:00:00Z'),(2,1,2,'2026-09-25T12:00:00Z'),(3,1,2,'2026-10-02T12:00:00Z')", '2026-09-30T23:55:00.000Z'],
    ["(1,1,2,'2026-09-25T12:00:00Z'),(2,1,1,'2026-10-01T12:00:00Z'),(3,1,2,'2026-10-02T12:00:00Z')", '2026-10-07T23:55:00.000Z']
  ]) {
    const db = new PGlite()
    try {
      await db.exec(fixture)
      await db.exec(`insert into season_rank_snapshots values ${history}`)
      await db.exec(await readFile(new URL('../supabase/migrations/20260930_017_guest_pick_release.sql', import.meta.url), 'utf8'))
      const { rows } = await db.query('select release_at from season_guest_pick_releases where season_id=1 and week=2')
      assert.equal(new Date(rows[0].release_at).toISOString(), expected)
    } finally {
      await db.close()
    }
  }
})
