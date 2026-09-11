# ADR: Identity and accounts

- **Status:** Accepted
- **Date:** 2026-09-08
- **Tracking issue:** [#59](https://github.com/alyakhtar/guessx/issues/59)

## Context

GuessX currently identifies players only by a client-supplied display name. That
is appropriate for a fast, casual game, but it cannot safely support durable
history, player statistics, account-level administration, or reconnect
authorization. Cloudflare Access protects the administration perimeter; it is
not a player-account system and must not become one.

The identity design must preserve the existing guest-first game loop. A visitor
must be able to create, join, spectate, rematch, share, and play a bot without
creating an account.

## Decisions

### Application authentication

GuessX will use [Auth.js](https://authjs.dev/) (`next-auth`) with the official
MongoDB adapter for application authentication. Its App Router handler will be
mounted at `/api/auth/[...nextauth]`; application code will use the server-side
`auth()` helper rather than treating browser-supplied profile data as identity.

Google is the only player login provider in the first release. Any Google
account may create a GuessX account. GitHub and Discord are deliberate,
independent follow-up providers in [#68](https://github.com/alyakhtar/guessx/issues/68).
The Google OAuth callback is `/api/auth/callback/google`.

Use a distinct Google OAuth client for each environment, with these redirect
URIs:

| Environment | Redirect URI |
| --- | --- |
| Local | `http://localhost:3000/api/auth/callback/google` |
| Dev | `https://dev.alyakhtar.com/api/auth/callback/google` |
| Production | `https://guessx.alyakhtar.com/api/auth/callback/google` |

The initial implementation adds the provider credentials and Auth.js secret
only through deployment environment variables; neither is committed or exposed
through a client-side `NEXT_PUBLIC_` variable.

### Internal identity and MongoDB storage

The Auth.js `User` document is GuessX's internal user identity. Its MongoDB
`_id` is the durable application user ID used by game results, authorization,
and socket membership. A provider's stable subject identifier (`Account`
provider + providerAccountId) is the authoritative external mapping. Email and
display name are attributes, never identity keys.

The MongoDB adapter owns the `users`, `accounts`, `sessions`, and verification
token collection(s), including the unique provider-account mapping. A small
shared identity repository will expose only the fields needed by the game and
Socket.IO server, avoiding a second, competing user store. Existing Mongoose
models may continue to own game/configuration collections.

The persistence contract is implemented in `lib/models/User.model.ts`,
`lib/models/ProviderIdentity.model.ts`, and `lib/identity/userIdentity.ts`:

| Collection | Important fields | Indexes |
| --- | --- | --- |
| `users` | `_id`, `displayName`, optional `email`, optional verified-email timestamp, optional image, `lastSeenAt`, timestamps | Non-unique sparse `email` index for lookup only. |
| `accounts` | `userId`, `type`, `provider`, `providerAccountId`, optional provider email, timestamps | Unique `(provider, providerAccountId)` identity mapping; unique `(userId, provider)` to prevent linking the same provider twice. |

Provider access tokens, refresh tokens, and ID tokens are not part of the
GuessX provider-identity schema. If Auth.js requires a provider token for a
future capability, that capability must explicitly justify its storage,
minimize its scope and lifetime, and add encryption/rotation handling.

Before enabling application login in an environment, run the idempotent
`npm run db:ensure-identity-indexes` command with that environment's
`MONGODB_URI`. The command creates the documented indexes without modifying
existing game-result data. If it reports a duplicate-key error, stop the
rollout, inspect the conflicting `accounts` documents, and resolve the data
conflict before rerunning it.

Auth.js will use **database sessions**, not stateless JWT sessions. Sessions
are revocable, can be invalidated on account deletion, and give the Socket.IO
server a server-verified identity. Cookies remain host-only, `HttpOnly`,
`Secure` in production, `SameSite=Lax`, scoped to `/`, and use Auth.js's secure
defaults. They are never read by client application code or forwarded in a
Socket.IO event payload.

### Guest policy

Guest play remains the default and requires no OAuth redirect. A guest has a
browser-scoped opaque guest ID plus a validated display name. The lobby offers a
generated name as the default, lets the guest replace it, and preserves this
guest state through ordinary refreshes when safe. Guest IDs are not User IDs,
are not stored as provider identities, and are never accepted as proof of an
authenticated account.

Guest display names are presentation data only. They are bounded and validated
server-side but need not be globally unique. Authenticated users may change
their display name; the currently chosen name is captured as a historical
snapshot on a completed result, so later profile edits do not rewrite history.

### Result persistence and legacy data

Completed games are attributed by nullable internal user IDs, never by display
name equality:

| Participants | Persistence rule |
| --- | --- |
| Guest vs guest | Do not create durable player-history data. |
| Authenticated vs guest | Persist the authenticated participant's history; retain only a non-account guest snapshot needed to describe that game. |
| Authenticated vs authenticated | Persist both participants by internal user ID. |

Existing name-based `GameResult` records remain readable as legacy data. They
are not automatically assigned to an account, even when a later user chooses
the same display name or email. A future, explicit account-claim feature would
need a separate security review.

### Account lifecycle

Version 1.4 has no self-service account-deletion screen and no provider-unlink
flow. A user may request deletion through the operator. The manual procedure
must revoke/delete the user's provider mappings and sessions, remove the user
profile, null the user's identity references in retained game records, and
redact associated display-name snapshots where required. Aggregated,
non-identifying operational counts may remain. Self-service deletion and safe
unlinking are future, separately scoped work.

### Cloudflare Access and administration

Cloudflare Access remains a defense-in-depth perimeter for narrowly scoped
admin routes. It is independent from public player Google OAuth: public game
routes and `/api/auth/*` must not be placed behind an Access challenge.

After [#65](https://github.com/alyakhtar/guessx/issues/65), administration will
also require a verified GuessX application session whose email is in the
server-side admin allowlist. UI visibility is advisory only; pages and APIs
enforce authorization server-side. Cloudflare Access must continue to be
configured for `/admin`, `/admin/*`, and `/api/admin/*`, and must not protect a
broad `/api/*` path.

### Socket.IO boundary

Socket.IO will derive an authenticated identity only by validating the
application session during the connection handshake. The client will not send a
user ID, email, OAuth token, or session token in an event payload. The server
will represent every socket explicitly as either authenticated (internal user
ID) or guest (non-account context), and reconnect/rematch/room membership will
use that server-side identity. This is implemented in [#63](https://github.com/alyakhtar/guessx/issues/63).

The Socket.IO middleware reads the Auth.js session cookie from the handshake,
looks up a non-expired database session and its user document, then stores only
the internal user ID in server-only socket state. The raw session token is never
logged, saved to a room, or emitted to any client. Room records retain an
internal account ID only for authorization; sanitization strips it from every
member and spectator payload. Account reconnects match that internal user ID,
not the name supplied by the reconnecting client. Guest reconnects retain the
documented guest policy until a separately approved durable guest identity is
introduced.

## Delivery sequence

1. [#61](https://github.com/alyakhtar/guessx/issues/61): add the internal user
   and provider-identity persistence foundation.
2. [#60](https://github.com/alyakhtar/guessx/issues/60): add Google OAuth,
   database sessions, logout, and callback handling.
3. [#62](https://github.com/alyakhtar/guessx/issues/62): make the public UI
   explicitly guest-first and offer optional sign-in.
4. [#63](https://github.com/alyakhtar/guessx/issues/63), then
   [#64](https://github.com/alyakhtar/guessx/issues/64): secure socket identity
   and persist results by user ID.
5. [#65](https://github.com/alyakhtar/guessx/issues/65),
   [#66](https://github.com/alyakhtar/guessx/issues/66), and
   [#67](https://github.com/alyakhtar/guessx/issues/67): complete admin,
   deployment, and regression safeguards.
6. [#68](https://github.com/alyakhtar/guessx/issues/68): evaluate GitHub and
   Discord only after Google is stable in production.

## Consequences

- Player identity becomes durable without adding a login wall to casual play.
- The current Cloudflare Access configuration continues to protect only admin
  traffic; it cannot be used as a public-player login shortcut.
- Existing results are deliberately not retroactively claimed, preventing name
  collision and account-takeover mistakes.
- The next implementation PRs must add migrations/indexes, tests, environment
  documentation, and rollback notes appropriate to their individual scopes.
