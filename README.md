# GuessX 🎯

> A real-time multiplayer number-guessing game built with **Next.js 16**, **Socket.IO**, and **TypeScript**.

[![CI · Build & Publish](https://github.com/alyakhtar/guessx/actions/workflows/docker-publish.yml/badge.svg?branch=main)](https://github.com/alyakhtar/guessx/actions/workflows/docker-publish.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/Node-20%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Real-time](https://img.shields.io/badge/Real--time-Socket.IO-010101?logo=socket.io&logoColor=white)](https://socket.io)
[![i18n](https://img.shields.io/badge/i18n-EN%20%7C%20FR-9cf)](https://next-intl-docs.vercel.app)
[![Docker Image](https://img.shields.io/badge/GHCR-guessx-blue?logo=docker&logoColor=white)](https://github.com/alyakhtar/guessx/pkgs/container/guessx)
![Made with ☕](https://img.shields.io/badge/Made%20with-%E2%98%95-6f4e37)
![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen)

GuessX is a clean, fast, real-time number-guessing game. Create a room, share a
code, and duel a friend (or an AI bot) to see who can crack the secret number first.

---

## 🎮 Play it now

Two live environments are deployed:

| Environment | URL | Image |
|---|---|---|
| **Production (live)** | **https://guessx.alyakhtar.com** | `ghcr.io/alyakhtar/guessx:latest` |
| **Dev / Staging (feature branches)** | **https://dev.alyakhtar.com** | `ghcr.io/alyakhtar/guessx:<branch-slug>` |

> Open the Production URL to play the released build; the Dev URL tracks the
> latest feature-branch image for testing.

---

## ✨ Features

- **Real-time multiplayer** gameplay over Socket.IO
- **Private rooms** 🔒 — create a room, get a 3-character access code, and share it
  with a friend. Codes are never exposed in the public room list. *(shipped via PR #2)*
- **Single-player vs AI** — three bot difficulties (Easy / Medium / Hard)
- **Spectator mode** — watch a live game in read-only view
- **Lobby system** — unified room list with public/private badges
- **i18n** — English & French, with a locale switcher
- **Dark / Light mode** toggle
- **Responsive UI** — Tailwind CSS + Bootstrap
- **Keyboard-friendly** — `Enter` to submit, auto-focus digit navigation
- **Win/loss celebration** animations

---

## 🚀 Quick start

```bash
# 1. Clone
git clone https://github.com/alyakhtar/guessx.git
cd guessx

# 2. Install (reproducible — uses the committed lockfile)
npm ci

# 3. Dev server
npm run dev
# → http://localhost:3000
```

### Production build

```bash
npm run build
npm start            # serves on :8082 (override with PORT)
```

### Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Dev server (hot reload) |
| `npm run build` | Production build |
| `npm start` | Run the production server |
| `npm run lint` | ESLint (flat config) |
| `npm run type-check` | `tsc --noEmit` |

---

## 🐳 Docker

Images are built and published to **GHCR** by CI during a PR sync or push to main
(`ghcr.io/alyakhtar/guessx`). Pull and run:

```bash
docker pull ghcr.io/alyakhtar/guessx:latest
docker run -d -p 8082:8082 \
  -e NODE_ENV=production \
  -e MONGODB_URI="$MONGODB_URI" \
  ghcr.io/alyakhtar/guessx:latest
```

> Requires a MongoDB connection (`MONGODB_URI`). Game results are persisted there.

---

## 🌐 Internationalization

GuessX ships English and French message catalogs under `messages/`. Switch
language from the locale selector in the UI; `next-intl` resolves translations at
render time.

---

## 🤖 Bots & difficulty

| Difficulty | Bot behavior |
|---|---|
| **Easy** | Mostly random guessing with light logic |
| **Medium** | Elimination strategies, learns from history |
| **Hard** | Near-optimal guessing pattern |

Administrators can tune per-digit-length guess windows from the **Admin panel**
(`/<locale>/admin`) — changes apply server-wide to new games.

---

## 🗂️ Project structure

```
app/          Next.js app router (pages, layouts)
components/   React UI (Lobby, Game, modals)
server/       Socket.IO game server logic
lib/          Utilities & helpers (socket client, models)
types/        TypeScript definitions
messages/     i18n catalogs (en, fr)
i18n.ts       next-intl config
```

---

## ⚙️ Environment variables

| Var | Default | Description |
|---|---|---|
| `NODE_ENV` | `development` | `production` for prod builds |
| `PORT` | `8082` | Server port (dev defaults to 3000) |
| `MONGODB_URI` | — | MongoDB connection string (required for result persistence) |

---

## 🧪 CI

`.github/workflows/docker-publish.yml`:

- **`pull_request`** → validates (type-check + lint + build) and builds the
  branch-tagged image for dev testing.
- **`push` to `main`** → validates and publishes `latest` to GHCR.

The build badge at the top of this README tracks the `main` branch.

---

## 🤝 Contributing

PRs are welcome! Branch from `main`, open a PR, and the CI gate (type-check +
lint + build) must pass. See the issue tracker for planned enhancements.

---

## 📜 License

[MIT](LICENSE) — do what you like, just keep the attribution.
