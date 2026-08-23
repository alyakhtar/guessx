# GuessX Product Roadmap

_Last updated: 2026-08-23. Owner: PM of record. Update this file whenever a milestone opens, closes, or changes goal._

## Release gate: v1.0.1 — Production Baseline

Before the next product train, bring the deployed runtime and release process
onto a supported, repeatable baseline. Node 20 reached end-of-life on 2026-03-24;
the production image and CI must move to a supported Node LTS line. This train
also verifies ARM64 Raspberry Pi deployment, makes builds independent of Google
Fonts availability, and establishes a recurring dependency-security process.

The train is deliberately small and operational: it should not change gameplay.
Its exit criteria are a green CI run, a successfully rolled-out ARM64 image, a
documented rollback path, and no unresolved high/critical dependency advisories.

Tracking issues:

- [Node runtime and CI migration (#49)](https://github.com/alyakhtar/guessx/issues/49)
- [Dependency maintenance and security automation (#50)](https://github.com/alyakhtar/guessx/issues/50)
- [Reproducible production builds and font packaging (#51)](https://github.com/alyakhtar/guessx/issues/51)
- [Raspberry Pi ARM64 release verification and rollback runbook (#52)](https://github.com/alyakhtar/guessx/issues/52)
- [Admin authorization (#53)](https://github.com/alyakhtar/guessx/issues/53)
- [Active-game secret isolation (#54)](https://github.com/alyakhtar/guessx/issues/54)
- [Socket.IO validation and rate limiting (#55)](https://github.com/alyakhtar/guessx/issues/55)

## Product thesis

The core loop (realtime number-guessing duels) is solid; the realtime plumbing works.
What the product lacks is everything **around** the loop:

1. **No reason to open the app tomorrow** — nothing recurs.
2. **A finished game is a dead end** — "New Game" destroys the room and returns both
   players to the lobby; most sessions end after one game.
3. **Accumulated play is invisible** — every result is stored in MongoDB but only the
   admin panel can see it. Players build no identity.

The roadmap fixes these in order: **friction → habit → competition.** Each train
compounds into the next: rematch keeps sessions alive long enough for stats to
matter, stats make a leaderboard meaningful, and the daily challenge delivers the
leaderboard a fresh audience every morning.

## Release trains

| Train | Goal | Success metric | Status |
|---|---|---|---|
| [v1.0.1 — Production Baseline](https://github.com/alyakhtar/guessx/milestone/4) | Supported runtime, secure public surface, and repeatable releases | Green CI + no high/critical production advisories + verified ARM64 rollout + rollback path | Active hardening train; issues #49–#55 |
| [v1.1 — Settings & Timer](https://github.com/alyakhtar/guessx/milestone/1) | Kill pre-game friction and stalled games | No game can stall; options persist | Built on `feature/turn-timer`, awaiting merge (#12, #13) |
| [v1.2 — Social](https://github.com/alyakhtar/guessx/milestone/2) | A finished game leads to another game with the same human | Rematch rate ≥30% of finished PvP games | Next up |
| [v1.3 — Retention](https://github.com/alyakhtar/guessx/milestone/3) | A daily reason to open the app without a friend online | D1/D7 return of daily-challenge players | Planned |

Milestone descriptions on GitHub carry per-train scope, exit criteria, and pull
order — they are the working source of truth; this file carries the why.

## Sequencing rationale

- **Production baseline before product work:** Node 20 is end-of-life, and the
  app is deployed to an exposed Raspberry Pi. A supported runtime, reproducible
  build, dependency audit, and rollback procedure reduce operational risk before
  adding more public surface area.

- **v1.2 before v1.3:** retention features presume sessions worth returning to.
  Fixing the post-game dead end (#4) is days of work and the single
  highest-leverage change in the codebase.
- **Daily challenge before leaderboard (inside v1.3):** a leaderboard with no
  daily traffic is an empty room. The daily challenge (#17) is also the only
  organic-growth channel on the roadmap (shareable, spoiler-free emoji grid).
- **Ranked/ELO (#32) is deliberately last:** it requires real accounts (current
  identity is a spoofable localStorage name string) and a ladder on a small
  player base feels empty. Revisit when quick match (#21) shows concurrent
  volume.

## Backlog beyond the trains

Unmilestoned issues are triaged ideas, not commitments. Notable:

- **Quality of life:** digit tracker (#22), mobile input (#25), onboarding (#26),
  lobby layout (#24), dark-mode persistence (#23)
- **Depth:** game modes — Bulls & Cows, Blitz (#28); honest Hard bot (#29)
- **Big bets (epics):** PWA + push (#30), accounts + ELO (#32)
- **Social texture:** emotes / quick chat (#31)

Labels: `epic` = needs breakdown into child issues + a spec before any code;
`retention` = exists to bring players back; `ux-polish` = friction fix;
`priority:high` = active train, `priority:normal` = next train;
`security` = protects the public deployment or release supply chain;
`operations` = deployment, runtime, or observability work.

## Working agreement

- Every issue ships with a user story, acceptance criteria, and code pointers.
  Epics get broken into child issues when their milestone opens — not before.
- Metrics above are the review gate at each train's close: if v1.2 rematch rate
  is far below target, fix the loop before building v1.3 on top of it.
