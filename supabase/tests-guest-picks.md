# Guest pick release

Run `npm run test:guest-picks` to test the migration in an isolated PostgreSQL runtime. Tests use fixtures and do not connect to production.

## Deployment

Apply `migrations/20260930_017_guest_pick_release.sql` to Supabase before deploying the frontend. The migration is transactional and filters picks inside `get_guest_season_snapshot`, covering anonymous and authenticated callers of the guest endpoint.

The admin's current-week change schedules that week's release for the next Wednesday at 7:55 p.m. in `America/New_York`, including daylight saving time. A change made at or after Wednesday's cutoff targets the following Wednesday. Re-saving or revisiting an already scheduled week preserves its first release time. Future weeks stay private, and skipped weeks remain private until scheduled.

On installation, prior weeks remain public. The current week's initial release is based on its first rank snapshot since the last week change; if no such history exists, installation time is used. Confirm the current week's `release_at` in `season_guest_pick_releases` after applying the migration.

The frontend uses the server's `guest_released_pick_weeks` list, refreshes at the current release time, and retries every minute and on window focus. It hides picks when release metadata is absent, including older local preview fixtures. Existing signed-in player visibility rules are unchanged.
