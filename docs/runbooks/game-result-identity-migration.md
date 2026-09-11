# Game-result identity migration runbook

This runbook applies to the one-time migration shipped with [#64](https://github.com/alyakhtar/guessx/issues/64).
It adds identity metadata to pre-identity `gameresults` documents without
creating users, provider identities, guest IDs, or account claims.

## Safety rules

- Take and verify a MongoDB backup before the first write.
- Run the dry run against development before production.
- Do not run this from application startup or as part of `docker compose up`.
- Review the dry-run counts and keep the output with the deployment record.
- The script is idempotent: records at `identityVersion: 1` are skipped.

## Dry run

Set `MONGODB_URI` to the target database and run:

```sh
MONGODB_URI="$MONGODB_URI" npm run db:migrate-game-result-identities
```

For a deployed GuessX container, the same command uses that container's existing
environment variables. For the current development deployment:

```sh
docker exec -it guessx-dev-pr91 npm run db:migrate-game-result-identities
```

The default mode makes no writes. It reports the number of records scanned,
records that would change, and human/bot participant counts. Existing human
participants are classified as `legacy-guest`; the historical `Bot` participant
is classified as `bot`.

## Apply in development

After reviewing the dry-run output and backup:

```sh
MONGODB_URI="$MONGODB_URI" npm run db:migrate-game-result-identities -- --apply
```

In the development container, append the explicit `--apply` flag as follows:

```sh
docker exec -it guessx-dev-pr91 npm run db:migrate-game-result-identities -- --apply
```

Verify that the output reports the expected `modified` count, then confirm in
the admin Player Statistics page that current guest results and Legacy guest
results appear in their separate sections. Re-running the same command should
report zero records to change.

## Apply in production

Only after development verification succeeds, repeat the exact dry-run and
apply procedure with the production `MONGODB_URI`. Do not reuse a development
count without comparing it to the production dry-run output.

## Rollback

Rollback first as a dry run to review the number of migration-stamped records:

```sh
MONGODB_URI="$MONGODB_URI" npm run db:migrate-game-result-identities -- --rollback
```

If rollback is approved, apply it explicitly:

```sh
MONGODB_URI="$MONGODB_URI" npm run db:migrate-game-result-identities -- --rollback --apply
```

Rollback removes only `player1DisplayName`, `player2DisplayName`, the two
identity-kind fields, `identityVersion`, and the migration timestamp from
records stamped by this migration. It does not remove game results or alter
users, accounts, sessions, or provider identities.
