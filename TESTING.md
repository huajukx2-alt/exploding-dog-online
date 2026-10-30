# Running the checks

Use Node.js 24.15 or newer and run `npm ci` followed by `npm test`.
The HTTP/Socket.IO tests start a temporary localhost server and write only to
`.test-output/`. They disable Firebase and never load the normal user database.

The suite covers:

- Every preset with 2–8 players; all card effects, combos, bombs, prompts,
  Nope counters, turn order, rankings, rematches and private hand visibility.
- Complete automated matches in all six presets and three bot levels.
- Accounts, recovery, PIN updates, signed backups, purchases, equipment,
  daily streaks, mailbox claims, gacha tiers/guarantees and game rewards.
- Real HTTP and Socket.IO clients for rooms, reconnects, spectators, chat,
  hand sorting, leaving, and persistence across a server restart.
- DOM tests that run the actual client scripts for registration, menus,
  language selection, tutorial entry/exit and live game state rendering.

The Firebase load path is tested with an isolated fake provider. Verifying a
live Firebase project requires that project's credentials. DOM tests do not
replace real browser layout checks or listening to synthesized audio.

# Deployment

Render's build command runs the complete test suite before pruning development
dependencies. `/api/health` reports readiness and the deployed commit.
Use a stable, private `APP_SECRET` for backup signatures; never commit it.
Version 1 backups must be refreshed by logging in again.

Local accounts are stored under `data/`, or `APP_DATA_DIR` when supplied.
Keep this directory private and out of Git. Render's free web service uses an
ephemeral filesystem, so it needs Firebase for durable server-side accounts.
Signed client backups can recover an absent account, but are not a substitute
for a durable database. Active rooms are in memory and end on server restart.
