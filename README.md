# CredChain — React Frontend

Production frontend for the CredChain decentralized credential platform.

## Stack

React 19 · Vite 7 · TypeScript 5.9 · Tailwind CSS v4 · shadcn-style UI primitives · TanStack Query v5 · Zustand v5 · React Router 7 · React Hook Form v7 · Zod v3 · i18next v23 (en + id) · Vitest + RTL + MSW · Playwright session regressions (mocked API)

## Quick Start

```bash
cp .env.example .env
# Set VITE_GOOGLE_CLIENT_ID
npm install
make dev
```

Dev server proxies `/api` to `http://localhost:8080`. The Go backend must be running (`cd ../CredChain_Golang && make dev-up && make dev`).

## Project Structure

```
src/
├── app/              # App shell, providers, router, session, store
├── feature/          # Business domains, including credentials, reference data, notifications, and users
├── shared/           # Cross-feature code (api client, auth guards, components, hooks, i18n, lib, types)
├── styles/           # Tailwind entry + @theme design tokens
└── test/             # Vitest setup, MSW handlers, fixtures
```

## Key Commands

| Command | Purpose |
|---|---|
| `make dev` | Dev server with HMR |
| `make build` | Production build |
| `make lint` | ESLint |
| `make test` | Unit/component tests |
| `make format` | Prettier write |
| `npm run test:e2e` | Playwright session regressions with mocked API responses¹ |
| `npm run check-locales` | Check backend locale keys except `mail_`; frontend extras warn |

## Related Docs

- [AGENTS.md](AGENTS.md) — Full architecture, patterns, coding conventions, change log
- [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) — Design tokens, typography, component recipes, layout system

> **¹ Browser test setup:** `e2e/session-refresh.spec.ts` contains two mocked session checks; no OAuth recording is required. Run `npx playwright test e2e/session-refresh.spec.ts --project=chromium`. Playwright starts the Vite server locally; CI requires an existing server. `E2E_BASE_URL` overrides `http://localhost:5173`. The role-based suites and recording scripts described in historical plans are not present.
