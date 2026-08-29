# CredChain React - Agent Instructions

Production frontend for the CredChain decentralized credential platform. React 19 + Vite 7 + TypeScript 5.9 + Tailwind CSS v4 SPA. Communicates with the Go backend over `/api` via httpOnly cookies. Manages user sessions, credential workflows, and role-gated admin interfaces.

This file is the authoritative reference for AI assistants and engineers working in `CredChain_React/`. For the full visual + engineering specification, see `DESIGN_SYSTEM.md`.

### Document Responsibilities

Two reference files serve different purposes. Update the right one:

| File                      | Purpose                                                                                                                            | Update when...                                                                                                       |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **AGENTS.md** (this file) | Operational instructions: commands, patterns, conventions, checklists, pitfalls, test counts, deployment rules, change log         | Adding/removing commands, changing patterns/conventions/rules, updating test counts, recording changes               |
| **DESIGN_SYSTEM.md**      | Design & engineering specification: tokens, typography, layout, component recipes, visual language, accessibility, migration notes | Changing design tokens, typography rules, layout patterns, component APIs, visual philosophy, or any design decision |

**Rule of thumb:** If it's about _how things look or are built_ (design, components, layouts), update `DESIGN_SYSTEM.md`. If it's about _how to work in this repo_ (commands, rules, workflows), update `AGENTS.md`. When in doubt, update `DESIGN_SYSTEM.md` first and reference it from `AGENTS.md`. Never duplicate full design specifications into both files — prefer a `See DESIGN_SYSTEM.md §X` cross-reference.

## Repo Position

Sibling to `CredChain_Golang/` (Go backend), `CredChain_Solidity/` (smart contracts), and `CredChain_Python/` (AI service).

- **`CredChain_Golang/`:** sole HTTP endpoint. All routes live under `/api`. Backend sets httpOnly cookies (`access_token`, `refresh_token`) that axios sends automatically.
- **`CredChain_Solidity/`:** frontend never talks to contracts directly. All on-chain operations go through the Go API.
- **`CredChain_Python/`:** frontend never talks to the AI service. All OCR/extraction flows go through the Go API.


## Critical Commands

```bash
npm install                   # one-time, after cloning

# Parity verbs (thin Makefile wrappers over npm — same as other repos):
make dev                      # Vite dev server on :5173 (proxies /api → :8080)
make build                    # tsc -b && vite build (strict TypeScript; must pass before push)
make lint                     # ESLint
make format                   # Prettier write
make test                     # Vitest run

# Unwrapped scripts (run via npm):
npm run preview               # serve production build locally
npm run format:check          # Prettier check (CI)
npm run test:watch            # Vitest watch mode
npm run test:coverage         # Vitest with v8 coverage
npm run test:e2e              # Playwright E2E (requires :5173 + .auth/*.json files)
npm run check-locales         # verify en.json/id.json sync with backend locales/
```

**Env setup:** copy `.env.example` to `.env` and fill `VITE_GOOGLE_CLIENT_ID`. Tests use `.env.test` (committed, placeholder values).

**Required env vars** (validated at startup in `src/shared/lib/env.ts`):

| Var                     | Required | Default                 | Purpose                                                     |
| ----------------------- | -------- | ----------------------- | ----------------------------------------------------------- |
| `VITE_GOOGLE_CLIENT_ID` | **yes**  | —                       | fatal if missing (thrown by `env.ts` at module load)        |
| `VITE_API_BASE_URL`     | no       | `/api`                  | base URL for axios                                          |
| `VITE_API_PROXY`        | no       | `http://localhost:8080` | dev-server proxy target for `/api` (Vite only, not bundled) |
| `VITE_APP_ENV`          | no       | `development`           | `development` / `staging` / `production`                    |
| `VITE_SUPPORT_EMAIL`    | no       | `support@credchain.app` | contact address shown on Help & About pages                 |
| `E2E_BASE_URL`          | no       | `http://localhost:5173` | Playwright and save-auth base URL (overrides default)      |

Engine note: tested on Node 20.x; `package.json` does not pin `engines`.

A `prepare` script wires `husky`; commits trigger `lint-staged` (Prettier on `*.{ts,tsx,css,json,md}`, ESLint `--fix` on `*.{ts,tsx}`).

**CI:** `.github/workflows/ci.yml` runs on push to master: lint → build → test → check-locales (ubuntu-latest, Node 20).

## Environment Setup

```bash
cp .env.example .env
# Fill VITE_GOOGLE_CLIENT_ID in .env
npm install
make dev
```

For testing: `.env.test` is committed and contains placeholder values. Tests do not require a running backend (MSW mocks all `/api/*` calls).

## Project Architecture

```
CredChain_React/
  public/
  e2e/                         # Playwright specs (guest, holder, issuer, admin, super-admin, a11y)
    guest-flow.spec.ts
    holder-flow.spec.ts
    issuer-flow.spec.ts
    admin-flow.spec.ts
    super-admin-flow.spec.ts
    a11y.spec.ts
    helpers/
      screenshots.ts
    scripts/
      save-auth.ts
  scripts/
    check-locales-sync.mjs     # verifies en.json/id.json sync with ../CredChain_Golang/locales/
  src/
    app/                       # cross-cutting wiring (no business logic)
      App.tsx                  # RouterProvider mount
      providers.tsx            # QueryClient + I18n + GoogleOAuth + ErrorBoundary + OfflineBanner + Toaster
      router.tsx               # createBrowserRouter with lazyRoute() helper
      SessionHydrator.tsx      # validates session via GET /users/self, syncs i18n with Zustand locale
      store/index.ts           # Zustand: auth + UI slices combined (persist middleware)
    feature/                   # one folder per business domain
      auth/                    # Login + api/ (useGoogleLogin, useLogout)
      user/                    # UserCreate, UserDetail, UserList, UserSelfEmail, UserSelfProfile
                               # + api/ (11 hooks: useCreateUsers, useDeleteUsers, useRestoreUsers,
                               #         useTransferSuperAdmin, useUpdateSelfEmail, useUpdateSelfProfile,
                               #         useUpdateUserRoles, useUpdateUsers, useUser, useUsers, useUserSelf)
                                # + components/ (CredentialSortMenu, CredentialStatusFilterMenu, MetaEditor,
                                #                RoleFilterMenu, SortMenu, StatusFilterMenu, UserCreateRow,
                                #                UserEditDrawer, UserStatusBadge)
                               # + hooks/ (useUserListParams) + lib/ (meta) + schemas/ (user)
      credential/              # CredentialDetail, CredentialIssue, CredentialList, MyCredentials,
                               # VerifyCredential + api/ (6 hooks + keys.ts) + components/ + schemas/
      overview/                # Overview + Settings
      landing/                 # Landing (self-wraps SplitLayout; route: /)
      about/                   # About
      help/                    # Help
    shared/
      api/                     # client.ts + codes.ts + envelope.ts + query-client.ts
      auth/                    # role.ts + guards.tsx
      components/              # 28 shared components
        ui/                    # 14 shadcn-style primitives (sole Radix import location)
        layout/                # AdaptiveLayout, OverviewLayout, PublicLayout, SplitLayout,
                               # OverviewSidebar, NavbarOverview, nav-items.ts
      hooks/                   # useDebouncedValue, useLoadMore, useNavSearch, useOnline, useSmartBack, useT
      i18n/                    # config.ts + en.json + id.json
      lib/                     # cn, env, format, forms, hash, jwt, notify
      types/api.ts             # DTO mirrors (UserDTO, AuthResponseDTO, CredentialDTO, PaginatedResponse)
    styles/index.css           # Tailwind v4 @theme tokens + base + utilities
    test/                      # setup.ts, fixtures.ts, msw/{handlers.ts,server.ts}, TestProviders.tsx
  .env.example / .env.test     # .env.test committed, used by Vitest
  components.json              # shadcn/ui config
  DESIGN_SYSTEM.md             # full visual + engineering spec (87.9K)
  AGENTS.md                    # this file
  README.md
  eslint.config.js / prettier.config.js
  tsconfig.json + tsconfig.app.json + tsconfig.node.json
  vite.config.ts / vitest.config.ts / playwright.config.ts
  package.json
```

## Key Patterns & Conventions

### Module Boundary Rules (HARD)

1. `feature/<X>` may import from `shared/` — **never the reverse**
2. `feature/<X>` may **NOT** import from `feature/<Y>` — share via `shared/` if needed
3. `shared/components/ui/` is the **only** place where Radix primitives are imported
4. `shared/api/client.ts` is the **only** place where axios is imported directly
5. `app/` wires everything; do not put business logic here
6. Avoid deep barrel re-exports; feature folders may have a single top-level `index.ts`

### Path Aliases

Configured in `tsconfig.app.json` + `vite.config.ts` + `vitest.config.ts`:

| Alias        | Resolves to                  |
| ------------ | ---------------------------- |
| `@/*`        | `src/*`                      |
| `@app/*`     | `src/app/*`                  |
| `@feature/*` | `src/feature/*`              |
| `@shared/*`  | `src/shared/*`               |
| `@ui/*`      | `src/shared/components/ui/*` |

### Design System Tokens

All tokens defined in `src/styles/index.css` under `@theme`. Core palette: `navy` (#0F172A), `gold` (#C9A227), `base` (#F8FAFC), `surface` (#FFFFFF), `error` (#B91C1C). Typography: `font-display` (Fraunces), `font-sans` (DM Sans), `font-mono` (JetBrains Mono). Signature: tinted shadows (`shadow-md shadow-navy/20`, `shadow-lg shadow-gold/20`) and a single `<DecorBlob>` per hero area.

See `DESIGN_SYSTEM.md` §§5–6 for the full token block, color usage rules, type scale, component recipes, visual language principles, and anti-patterns.

### State Management (TanStack Query + Zustand)

**Two-layer model — never mix:**

| Layer        | Tool               | What lives here                                   |
| ------------ | ------------------ | ------------------------------------------------- |
| Server state | TanStack Query     | All API data: users, credentials, paginated lists |
| Client state | Zustand `useStore` | Current user session, UI (sidebar, locale)        |

`useStore` is persisted to localStorage via `persist` middleware. Only `user`, `isAuthenticated`, and `locale` are persisted. **Tokens are never persisted** (httpOnly cookies handle them).

Query key conventions (in `feature/*/api/keys.ts`):

```ts
userKeys = { all, list, detail, self };
credentialKeys = { all, list, detail, mine };
```

All mutations invalidate the `all()` key on success.

### API Integration & Axios Interceptors

Single axios instance at `@shared/api/client.ts` with:

- `withCredentials: true` — sends httpOnly cookies automatically
- 30s timeout
- **Request interceptor:** adds `Accept-Language` from Zustand locale
- **Response interceptor:** unwraps `{code, message, data}` envelope → returns just `data`
- **Error interceptor:**
  - 401 → single silent refresh attempt (deduplicated via `refreshInFlight` promise) → retry with `X-Retry: 1` header
  - 429 → maps to `system.rate_limited` or `system.rate_limited_with_retry` if `Retry-After` header present
  - other → wraps in `ApiError` with translated `messageKey`

`ApiError` (`@shared/api/envelope.ts`) carries `status`, `code`, `messageKey`, `fieldErrors`, and original `cause`. Use `isApiError(e)` type guard.

Backend response codes (6-digit `AABBCC`) map to i18n keys via `CODE_TO_MESSAGE_KEY` in `@shared/api/codes.ts`. **Keep in sync with `CredChain_Golang/domain/codes.go`** — when backend adds a code, add it here AND to both locale files.

### Authentication & Silent Refresh

**Flow:** Google OAuth ID token → `POST /api/auth/google` → backend sets httpOnly cookies (access + refresh) → Zustand stores `UserDTO` only (NOT tokens).

**Frontend never reads or writes tokens.** Axios sends them automatically via cookies.

**Silent refresh:** axios interceptor catches 401, calls `POST /api/auth/refresh` once, retries original request. On refresh failure, clears Zustand session and redirects to `/login`.

**Session hydration:** `SessionHydrator` (mounted under `Providers`) calls `GET /users/self` on mount. If 200 → sets user. If 401 → clears session. Renders full-page spinner until first load completes.

**Email update with Google reauth:** `UserSelfEmail` is a 2-step form. Step 1 captures new email. Step 2 prompts Google sign-in for the new address; the resulting ID token is sent to `PUT /users/self/email` along with the email. Backend verifies the token's email matches.

**Logout:** `POST /api/auth/logout` clears cookies, then frontend clears Zustand + Query cache.

### Routing & Lazy Loading

Every route except `/login` is loaded via the `lazyRoute()` helper in `app/router.tsx`. The helper wraps the component in `Suspense` (with `LoadingSpinner` fallback) and attaches `RouteErrorBoundary` automatically. This means **route components must be named exports** — the helper takes the export name as a string.

```ts
lazyRoute(() => import("@feature/user/UserList"), "UserList");
```

`/login` is an **eager** import (`Login` is imported directly, not lazily) since it is the most common cold-start entry.

**Route map** (path → component → guard → shell):

| Path | Component | Guard | Shell |
|---|---|---|---|
| `/` | Landing | None (self-wraps SplitLayout) | — |
| `/credentials/verify` | VerifyCredential | None (public) | PublicLayout |
| `/help` | Help | Adaptive (authenticated→OverviewLayout, anon→PublicLayout) | AdaptiveLayout |
| `/about` | About | Adaptive | AdaptiveLayout |
| `/login` | Login | PublicRoute (redirects if authenticated) | — |
| `/overview` | Overview | ProtectedRoute (any auth) | OverviewLayout |
| `/credentials` | CredentialList | ProtectedRoute (any auth) | OverviewLayout |
| `/credentials/:id` | CredentialDetail | ProtectedRoute (any auth) | OverviewLayout |
| `/account/profile` | UserSelfProfile | ProtectedRoute (any auth) | OverviewLayout |
| `/account/email` | UserSelfEmail | ProtectedRoute (any auth) | OverviewLayout |
| `/users` | UserList | ProtectedRoute (Issuer/Admin/SuperAdmin) | OverviewLayout |
| `/users/:id` | UserDetail | ProtectedRoute (Issuer/Admin/SuperAdmin) | OverviewLayout |
| `/credentials/issue` | CredentialIssue | ProtectedRoute (Issuer/Admin/SuperAdmin) | OverviewLayout |
| `/users/create` | UserCreate | ProtectedRoute (Admin/SuperAdmin) | OverviewLayout |
| `*` | NotFound | None | — |

`AdaptiveLayout` renders `OverviewLayout` when authenticated, `PublicLayout` otherwise. `SplitLayout` is the navy/light split-screen shared by Landing and Login.

### Authorization & Role Guards

**Single source of role logic:** `@shared/auth/role.ts` exports `Role` (a string-valued const object), `ROLE_LEVEL` hierarchy, `canAccess(userRole, minRole)`, `canAccessAny(userRole, allowed[])`, `formatRole`.

```
Role.HOLDER     = "holder"     (level 1)  - receives credentials
Role.ISSUER     = "issuer"     (level 2)  - issues/revokes/verifies
Role.ADMIN      = "admin"      (level 3)  - manages users
Role.SUPER_ADMIN= "super_admin"(level 4)  - bootstrapped via Go CLI only
```

`None(0)` exists only in Solidity/Go (on-chain revocation target) — it is **not** part of the TS `Role` object since the frontend never persists or assigns it.

**Guards** (`@shared/auth/guards.tsx`):

- `ProtectedRoute` — redirects unauthenticated to `/login` (with `state.from`); role-mismatched to `/overview` (HOLDER) or `/overview`. Optional `allowedRoles?: Role[]`.
- `PublicRoute` — redirects authenticated away to `state.from ?? /overview` (login is public-only)
- `RoleGate` — inline UI gating for show/hide based on role, with optional `fallback`

**Sidebar nav** (`@shared/components/layout/nav-items.ts`): `NAV_ITEMS` carry `minRole` (Issuer+ for overview/users/credentials, Admin+ for settings) and `exactRole` (HOLDER-only "My Credentials"). The `inSidebar` flag controls whether an item renders in the sidebar vs. only the global search / profile menu.

### Forms & Validation (RHF + Zod)

**Stack:** React Hook Form + Zod via `@hookform/resolvers/zod`.

**Schemas mirror Go Ozzo rules** (see `feature/*/schemas/`):

- E.164 phone via `STRICT_E164` regex `/^\+[1-9]\d{6,14}$/`
- ISO date via `/^\d{4}-\d{2}-\d{2}$/`
- Email max 256, name 1–256, batch limits 50–100
- `optionalEmptyToNull` helper treats empty strings as undefined

**Field arrays for batch forms** (`UserCreate`, `CredentialIssue`):

```ts
const { fields, append, remove } = useFieldArray({ control: form.control, name: "users" });
```

**Server validation errors:** mutation hooks accept the form via generic param (`useCreateUsers<T>(form)`), and `setServerErrors(form, errors)` from `@shared/lib/forms` maps `{ field: messageKey }` shape onto `form.setError`.

**Always wire `notify` for non-validation errors:**

```ts
onError: (error) => {
  if (isApiError(error) && error.fieldErrors && form) {
    setServerErrors(form, error.fieldErrors);
  } else if (isApiError(error)) {
    notify.error(error.messageKey);
  }
};
```

### Internationalization & Locale Sync

**Locales:** `en` and `id` only, mirroring backend `CredChain_Golang/locales/`.

**Sync verification:** `npm run check-locales` reads both files, flattens keys, and exits 1 if any backend key is missing from frontend. Run in CI or pre-commit.

**Backend code → frontend key:** `CODE_TO_MESSAGE_KEY` map in `@shared/api/codes.ts`. Mirrors `CredChain_Golang/infrastructure/http/responder/mapper.go`. Adding a domain code requires updating: (a) this map, (b) both `locales/{en,id}.json` files, (c) backend's `CodeToMessageKey` and `HttpCodes` maps, (d) backend's locale files.

**Locale state:** `useStore.locale` is the source of truth. `LanguageSwitcher` updates both i18next AND Zustand. `SessionHydrator` syncs `i18next.changeLanguage()` with stored locale on mount. Axios sends `Accept-Language` header so backend serves the matching locale.

**Default locale:** Indonesian (`id`). The persisted locale is read from localStorage in `i18n/config.ts` before i18next initializes, so users never see a flash of English on Indonesian-default pages.

### Component Recipes

**Always use `cn()`** from `@shared/lib/cn` for className composition. Never template-string concatenation:

```tsx
// CORRECT
className={cn("base classes", isActive && "active", className)}

// WRONG — tailwind-merge can't dedupe
className={`base classes ${isActive ? "active" : ""} ${className}`}
```

**Always use `notify`** from `@shared/lib/notify` for toasts. It auto-translates keys via i18n and applies consistent styling. Available: `notify.success`, `notify.error`, `notify.info`, `notify.warning`.

**shadcn primitives** (in `@ui/*` — 14 primitives, the sole Radix import location):

- `Button` — variants: `primary` (navy), `gold`, `destructive`, `outline`, `ghost`, `link`, `dashed`. All use `focus-visible:ring-gold` except `gold`/`destructive`/`link` which keep their own ring colors. Sizes: `sm`, `md`, `lg`, `icon`, `icon-mobile`.
- `Card` + `CardHeader` + `CardTitle` (now `font-sans text-lg font-bold`) + `CardDescription` + `CardContent` + `CardFooter`
- `Input` — accepts `leadingIcon` and `trailingAction` props
- `Label` — Radix-based, supports peer-disabled
- `Select` — full Radix Select with `SelectValue`
- `Dialog` + `ConfirmDialog` + `useConfirm()` hook (NEVER use `window.confirm`); `useConfirm()` returns `{ confirm, dialog }`
- `DropdownMenu` — full Radix DropdownMenu with `destructive` item variant. The shared primitive defaults `modal={false}` (Radix would otherwise mount `react-remove-scroll` and shift the page horizontally — see scroll-lock note below). Pass `modal` explicitly only for true menus that need scroll-trapping.
- `Table` + `TableHeader` + `TableBody` + `TableRow` + `TableHead` + `TableCell`
- `Badge` — tones: navy, gold, error, green, gray
- `Skeleton` — animate-pulse rounded gray box
- `Toaster` — sonner integration with token-styled toasts (hardcoded `theme="light"`)

> The `vaul` `Drawer` primitive is used by `feature/user/components/UserEditDrawer.tsx` (admin batch user edit). It lives in the feature, not in `@ui/`, and is the only content-drawer in the app — the mobile sidebar is NOT a `vaul`/`Sheet` drawer (see Error Handling / layout notes).

**Custom shared components** (`@shared/components/*` — 28):

`BackLink`, `CopyInlineButton`, `CopyrightFooter`, `DecorBlob`, `DetailRow`, `EmptyState`, `ErrorBoundary` (`AppErrorBoundary`), `EyebrowLabel`, `FormField` (in `@ui/form-field`), `LanguageSwitcher`, `LoadMoreBar`, `LoadingSpinner` / `FullPageSpinner`, `MonoId`, `NotFound`, `OfflineBanner`, `PageHeader`, `RouteErrorBoundary`, `StatusPill`, `UserAvatar`, `UserRoleBadge`.

`DetailRow` renders a dt/dd pair (`label` + `value`) with optional icon and error/default tone. Extracted from the repeated pattern in UserDetail, UserSelfProfile, Settings, and CredentialDetail.

`FormField` wraps a `<Label>` + children + optional error/hint/optional tag. Used by `UserCreateRow`, `CredentialIssueRow`, and `UserEditDrawer` (extracted from 3 duplicated inline implementations).

`CopyrightFooter` is the shared copyright strip rendered by `PublicLayout` at the bottom of public pages (and `AdaptiveLayout` when unauthenticated). It uses `font-sans` (DM Sans) for the copyright text — not `font-display` (reserved for headings) or `font-mono` (reserved for identifiers) — and renders the current year dynamically via `new Date().getFullYear()`. The footer background is `bg-transparent` (not `bg-surface`) so the page's `bg-base` shows through, eliminating the "white void" gap between short content and the footer when `bg-base` (#F8FAFC) and `bg-surface` (#FFFFFF) are nearly indistinguishable. Includes `safe-area-bottom` and `no-print` classes. The container that hosts it uses `min-h-dvh` (not `min-h-screen`) so the footer stays anchored to the bottom of the _visible_ viewport on mobile, where `100vh` over-counts due to browser chrome.

`LoadMoreBar` replaces `PaginationBar` for list pagination. Used in `CredentialList`, `UserList`, and `MyCredentials` with `useLoadMore` hook (cumulative offset-based pagination with count label + Load More button).

### Error Handling Layers

**Three-layer error handling:**

1. **App boundary** — `AppErrorBoundary` (react-error-boundary) wraps everything. Last resort.
2. **Route boundary** — `RouteErrorBoundary` attached to every lazy route via `lazyRoute()`. Renders branded fallback with reload + dashboard CTAs. Detects 404 via `isRouteErrorResponse`.
3. **Mutation/query level** — toasts via `notify`, inline form errors via `setServerErrors`.

**OfflineBanner** — uses `useOnline` hook (`navigator.onLine` + online/offline events). Shows fixed-top warning + fires one-time toast on transition.

**Rate limit (429)** — interceptor parses `Retry-After` header. Map keys `system.rate_limited` and `system.rate_limited_with_retry`.

**404 page** — `NotFound` component with branded design, navigation CTAs to dashboard + login. Wired as the catch-all `path: "*"` in router.

### Coding Conventions

**Naming:**

- Component file: `PascalCase.tsx` (e.g. `UserList.tsx`)
- Hook file: `camelCase.ts` starting with `use` (e.g. `useGoogleLogin.ts`)
- Util file: `kebab-case.ts` or single-word `lowercase.ts` (e.g. `cn.ts`, `format.ts`)
- Component: PascalCase named export
- Hook: `useX` named export
- Type/interface: PascalCase (e.g. `interface UserDTO`)
- Constant: `SCREAMING_SNAKE_CASE` (e.g. `ROLE_LEVEL`, `STRICT_E164`)

**Exports:**

- **Named exports only.** No default exports anywhere. The router's `lazyRoute()` helper takes the export name as a string to support this.

**TypeScript:**

- Strict mode + `verbatimModuleSyntax: true` — use `import type` for type-only imports
- No `any` (enforced by ESLint)
- Use `as const` enums via const-object pattern (see `Role` in `shared/auth/role.ts`)

**ESLint key rules** (in `eslint.config.js`):

- `react-refresh/only-export-components`
- `@typescript-eslint/no-explicit-any: error`
- `@typescript-eslint/consistent-type-imports: error`
- `@typescript-eslint/no-unused-vars` (ignore `_` prefix)
- `no-console: warn` (allow `warn`/`error`)

**Prettier:**

- `printWidth 100`, `semi true`, `trailingComma all`, `doubleQuote`
- `prettier-plugin-tailwindcss` auto-sorts Tailwind classes

### When Adding a New Feature

Step-by-step checklist for adding a new domain feature (e.g., `feature/audit-log/`):

1. Create folder structure:
   ```
   feature/<name>/
     api/
       keys.ts            # query keys
       use<Name>s.ts      # list query
       use<Name>.ts       # detail query
       useCreate<Name>.ts # create mutation
     components/          # presentational components
     schemas/<name>.ts    # Zod schemas mirroring Go Ozzo
     <Name>List.tsx
     <Name>Detail.tsx
     index.ts             # named re-exports of public API
   ```
2. Mirror backend Ozzo rules in Zod schemas. Cover: required fields, max lengths, format regexes, enum values, batch size limits.
3. Create TanStack Query hooks. Reuse the `notify` / `isApiError` / `setServerErrors` patterns.
4. Add response codes to `@shared/api/codes.ts`. Mirror entries from `CredChain_Golang/domain/codes.go`.
5. Add locale keys to BOTH `src/shared/i18n/en.json` and `id.json`. Run `npm run check-locales` to verify sync with backend.
6. Add MSW handlers in `src/test/msw/handlers.ts` for the new endpoints.
7. Wire the route in `src/app/router.tsx` using `lazyRoute(() => import("..."), "ExportName")`.
8. Add nav entry to `OverviewSidebar.tsx` if user-facing. Filter by role using `NAV_ITEMS.minRole`.
9. Add Vitest tests:
   - Schema tests (deeply, all edge cases)
   - Component test using `TestProviders` wrapper
10. If user-facing: add Playwright E2E in `e2e/`.
11. Run full verification: `make lint && make build && make test && npm run check-locales`.

### Common Pitfalls (DO NOT DO)

- `export default function ComponentName()` — use named export
- `bg-[#hexcode]` — define in `@theme` and use the token
- `feature/X` importing from `feature/Y` — share via `shared/`
- Direct `import axios` — use `@shared/api/client`
- Direct deep imports from lucide-react paths — use bare named imports
- Role hierarchy logic outside `@shared/auth/role.ts`
- `window.confirm` / `window.alert` — use shadcn `useConfirm` hook
- `useState` for forms — use React Hook Form
- Hardcoded English strings in JSX — use `t("key")` and add to both locale files
- `bg-blue-600` for brand-bearing elements — use `navy` or `gold` token
- Persisting tokens to Zustand or localStorage — backend uses httpOnly cookies
- Reading `import.meta.env` directly — use typed `env` from `@shared/lib/env`
- Manual `toast.success(...)` — use `notify.success(key)` so messages go through i18n
- Concatenated classNames via template strings — use `cn()` so tailwind-merge dedupes
- `safe-area-top` on the same element as `py-*` — `safe-area-top` overrides `padding-top` (CSS utilities-layer source order). Apply it to a dedicated spacer `<div>` when combined with vertical padding.
- `console.log` in committed code (ESLint warns; only `console.warn`/`error` allowed)

### Backend Coordination Items

Documented in `DESIGN_SYSTEM.md` §22.2. These require Go-team agreement before production:

1. `/api/auth/google` must `Set-Cookie: access_token` and `refresh_token` (HttpOnly, Secure, SameSite=Strict).
2. CORS: `Access-Control-Allow-Credentials: true` and explicit origin (not `*`).
3. Validation error response shape: `{ code: 400001, errors: { fieldName: messageKey } }` — confirm field path format (dot-notation for nested? `users[0].email`?).
4. `Retry-After` header on 429 responses (frontend reads it).
5. Confirm `/api/users/self/email` accepts the same Google ID token format as login (audience claim handling).
6. CSRF protection: with httpOnly cookies + `SameSite=Strict`, dedicated CSRF token may not be needed. Confirm with backend security review.

## Configuration / Env Vars

See the **Required env vars** table under [Critical Commands](#critical-commands). All env vars must be prefixed with `VITE_` to be exposed to the browser. Reading `import.meta.env` directly is prohibited — always use the typed `env` export from `@shared/lib/env.ts`.

## Testing

**Layers:**

| Layer       | Tool         | Coverage                                                    |
| ----------- | ------------ | ----------------------------------------------------------- |
| Unit        | Vitest       | Pure functions: `cn`, `role`, `format`, `hash`, Zod schemas |
| Component   | Vitest + RTL | Render, interactions, form validation                       |
| Integration | Vitest + MSW | Feature flows with mocked `/api`                            |
| E2E         | Playwright   | Auth flow, public routes, a11y smoke                        |

**Current count:** **813 unit/component tests across 93 spec files** under `src/`, plus **~85 Playwright tests across 6 e2e specs** (`guest-flow.spec.ts`, `holder-flow.spec.ts`, `issuer-flow.spec.ts`, `admin-flow.spec.ts`, `super-admin-flow.spec.ts`, `a11y.spec.ts`).


**Coverage** (in `vitest.config.ts`): the `coverage` config uses a **selective `include` allowlist** (NOT global). Per-file thresholds of 90% lines / 85% branches / 90% functions / 90% statements apply only to the curated paths:

```
src/shared/lib/jwt.ts
src/shared/hooks/useNavSearch.ts
src/feature/help/**/*.{ts,tsx}
src/feature/about/**/*.{ts,tsx}
src/shared/components/layout/nav-items.ts
src/shared/i18n/config.ts
```

This is intentional: not all of the codebase is covered to threshold yet. Add new paths to the allowlist as features stabilize. Globally-excluded: `src/shared/components/ui/**`, `src/test/**`, `src/main.tsx`, `src/app/router.tsx`, `**/*.test.{ts,tsx}`, `**/*.d.ts`, config files, `scripts/**`.

**MSW handlers** in `src/test/msw/handlers.ts` mock all `/api/*` endpoints with envelope shape. Add new handlers when adding new API hooks.

**TestProviders** (`src/test/TestProviders.tsx`) wraps RTL renders with `QueryClient` (retry disabled), `I18nextProvider`, `MemoryRouter`.

**File API polyfill:** jsdom doesn't implement `File.prototype.arrayBuffer`. `setup.ts` polyfills it from `Blob.prototype.arrayBuffer`. The hash module uses `FileReader` for broad compatibility.

**Playwright** runs against `localhost:5173` by default. Set `E2E_BASE_URL` for staging. Configures `chromium` and `mobile` (Pixel 5) projects. ~85 tests across 5 spec files (`guest-flow.spec.ts`, `holder-flow.spec.ts`, `issuer-flow.spec.ts`, `admin-flow.spec.ts`, `super-admin-flow.spec.ts`).

**E2E test setup — one-time auth recording:**

Role-authenticated tests require `storageState` files. Record once per role via Google OAuth.

**All roles (sequential):** launches a browser for each role. Complete Google OAuth to record, or close the browser window to skip:

```bash
npx tsx e2e/scripts/save-auth.ts
```

**Single role:** record one role only:

```bash
npx tsx e2e/scripts/save-auth.ts issuer
```

Files saved to `e2e/.auth/{role}.json` (gitignored). Guest-flow public page tests work without auth.

**E2E auth auto-refresh:**

The test suite includes automatic token refresh via `e2e/helpers/auth-refresh.ts`:

- **`globalSetup`** (in `playwright.config.ts`) validates all 4 auth files exist at test start
- **`test.beforeAll`** in each spec file calls `refreshAuthState(role)` to refresh the `access_token` via `POST /api/auth/refresh` before tests run. A lock-file mechanism serializes refreshes across parallel workers: each worker checks the file's `mtime` (60s cooldown) and an exclusive lock file (30s TTL) before attempting a refresh
- On success: updated cookies are saved back to the `.auth/{role}.json` file
- On failure (refresh token expired): a warning is logged; the auth file is preserved (tests may fail with stale tokens, but it's safer than deleting the file mid-run)
- The `afterAll` in `issuer-flow.spec.ts` no longer manually extracts `access_token` from JSON — Playwright's `context.request` sends cookies from `storageState` automatically

This means you no longer need to re-run `save-auth` when tokens expire. The refresh happens automatically before each test run.

After recording all roles, run:

```bash
npx playwright test --project=chromium   # all ~85 tests
npx playwright test e2e/guest-flow.spec.ts --project=chromium   # public-only (no auth needed)
```

Screenshots captured to `e2e/screenshots/{spec-file}/{feature-group}/`. Failure screenshots saved to `e2e/screenshots/{spec-file}/{test-slug}-failed-test.png`.

When adding tests, prefer integration tests via MSW over heavy mocking. Schema tests should cover every required field, every max-length boundary, every enum value, and every regex format constraint.

## Tech Stack

| Layer         | Choice                                        | Version                                              |
| ------------- | --------------------------------------------- | ---------------------------------------------------- |
| Language      | TypeScript                                    | ~5.9.3 strict + verbatimModuleSyntax                 |
| Framework     | React                                         | ^19.2                                                |
| Build         | Vite                                          | ^7.3                                                 |
| Styling       | Tailwind CSS v4                               | ^4.2 (`@theme` directive, no config file)            |
| UI primitives | shadcn/ui + Radix UI                          | various (see `package.json`)                         |
| Icons         | lucide-react                                  | ^0.576 (named imports only)                          |
| Routing       | React Router                                  | ^7.13 (lazy via `lazyRoute()` helper)                |
| Server state  | TanStack Query                                | ^5.59                                                |
| HTTP          | axios                                         | ^1.7 (with interceptors)                             |
| Client state  | Zustand                                       | ^5.0 (with persist middleware)                       |
| Forms         | React Hook Form                               | ^7.53                                                |
| Validation    | Zod                                           | ^3.23                                                |
| i18n          | i18next + react-i18next                       | ^23.16 / ^14.1                                       |
| Auth          | @react-oauth/google                           | ^0.12                                                |
| Avatar        | @dicebear/core + @dicebear/identicon          | ^9.4                                                 |
| Toasts        | sonner                                        | ^1.5 (via `notify` helper)                           |
| Class merge   | clsx + tailwind-merge                         | ^2 / ^3 (via `cn()`)                                 |
| Drawer        | vaul                                          | ^1.1 (used by `UserEditDrawer`; not for sidebar nav) |
| Crypto        | ethers                                        | ^6.16                                                |
| PDF           | pdfjs-dist                                    | ^5.6                                                 |
| XLSX          | xlsx                                          | ^0.18                                                |
| Git hooks     | husky + lint-staged                           | ^9 / ^15                                             |
| Tests         | Vitest ^3 + Testing Library ^16 + MSW ^2.4    |                                                      |
| E2E           | Playwright ^1.48 + @axe-core/playwright ^4.10 |                                                      |

## Cross-Repo Integration

- **`../CredChain_Golang/AGENTS.md`** — sole HTTP backend. Frontend mirrors `domain.Code*` constants from `CredChain_Golang/domain/codes.go` into `@shared/api/codes.ts`. Locale files in `src/shared/i18n/{en,id}.json` are mirrored from `CredChain_Golang/locales/` and verified by `npm run check-locales`.
- **`../CredChain_Solidity/AGENTS.md`** — frontend never talks to contracts directly. Role enum (`None/Holder/Issuer/Admin/SuperAdmin`) is mirrored from `CredentialAuthority.Role` via `@shared/auth/role.ts`.
- **`../CredChain_Python/AGENTS.md`** — frontend never talks to the AI service directly. AI flows (OCR, similarity verdict) come through the Go API. Python owns response code category `50` — these codes propagate untouched and resolve to i18n keys via `CODE_TO_MESSAGE_KEY`.

**Role enum (mirrored in all four repos):** `None(0) → Holder(1) → Issuer(2) → Admin(3) → SuperAdmin(4)`. Same enum in Solidity (`CredentialAuthority.Role`), Go (`domain.Role`), and React (`@shared/auth/role.ts`).

**Response code format (mirrored in all four repos):** 6-digit `AABBCC`. Categories: `10` (system), `20` (auth), `30` (user), `40` (credential), `50` (AI service).

**Cross-repo sync workflow:** when the Go backend adds a new domain code, four files must be updated atomically:

1. `CredChain_Golang/domain/codes.go` — new constant
2. `CredChain_Golang/infrastructure/http/responder/mapper.go` — `CodeToMessageKey` + `HttpCodes`
3. `CredChain_Golang/locales/{en,id}.json` — message templates
4. `CredChain_React/src/shared/api/codes.ts` + `src/shared/i18n/{en,id}.json` — mirror entries

Run `npm run check-locales` from the React repo after step 4 to verify drift is resolved.

## Deployment

**Push to master branch only when build succeeds. Do not create feature branches, bugfix branches, or any other branch types — commit directly to master.**

Before pushing, run the repo's canonical verification command and confirm it passes:

- `CredChain_Golang`: `make test && make lint`
- `CredChain_Solidity`: `make compile && make test`
- `CredChain_Python`: `make check`
- `CredChain_React`: `make lint && make build && make test && npm run check-locales`

## Change Log

- **2026-08-29 — User detail page: inline editing + visual consistency with the list.** `UserDetail.tsx` rebuilt around `canEditUser`/`canDeleteUser` (`role.ts`, previously zero callers) instead of a hand-rolled `canAccessAny` check that wrongly offered Edit to an Admin viewing a peer Admin or themself. Width `max-w-5xl`→`max-w-4xl` to match every sibling detail screen. Duplicate `<dl>` and metadata collapsible (identical data to `DetailEditForm`'s read mode) deleted; page is now two cards — Identity (`DetailEditForm`) and Audit (wallet/created/updated/deleted). Role editing moved out of the header's bare `<Select>` (which fired an on-chain write with no confirm) into the inline form behind a confirm dialog (`user.role.confirm.*`, 3 new i18n keys, `PUT /users/batch/role` only — never `/users/batch`). Email added as an editable field (backend already permitted it; frontend simply never asked). Both fields render as locked, hinted boxes (new `DetailEditForm` `lockedReason` support) when a Super Admin edits their own record — the backend already rejects self-email and self-role changes (`user_policy.go:69-72`, `UpdateRolePreFetch:98-101`); this is UI honesty, not new enforcement. Unit now renders its full hierarchical path via newly-exported `pathSegments()` and is edited through the existing `UnitPicker` instead of a flat `<Select>`. Delete/Restore buttons added to the header, wired to the already-existing `useDeleteUsers`/`useRestoreUsers` hooks used by `UserList`; a trashed target hides Edit and shows a "must be restored before editing" hint instead of letting the user hit a 403 after filling out the form. `handleSave` now diffs profile and role changes separately so a role-only change no longer gets swallowed by the old single-payload no-op check. No backend, Solidity, or Python changes — `user_policy.go` was audited and found already correct. Tests 802→813 (93 spec files, unchanged). All 813 tests pass. Modified: `units.ts`, `DetailEditForm.tsx`, `schemas/user.ts`, `UserDetail.tsx`, `UserDetail.test.tsx`, `schemas/user.test.ts`, `en.json`, `id.json`, `AGENTS.md`.

- **2026-08-27 — User List URL params renamed to backend field names.** `unit` → `unit_id` (matches `CredentialList`, which already used `unit_id`), and `yearFrom`/`yearTo` collapsed into a single `joined_year` param whose value is a `from..to` range — `joined_year=2025..2026`, `joined_year=2025..` (Dari-only), `joined_year=..2026` (Sampai-only). `..` is the backend's BETWEEN operator; open-ended sides are frontend-only because the backend rejects a single BETWEEN value. The wire format is unchanged (`unit_id=`, `joined_year>=`/`joined_year<=`) — only the browser URL changed. `useUserListParams` gained `parseYearRange`/`serializeYearRange` + a dedicated `setYearRange`; the now-dead `setMany` was removed. `JoinedYearFilterMenu` and `HolderUnitFilterMenu` untouched (param-name agnostic). No backend change, no i18n change. Tests 801→802. Modified: `useUserListParams.ts`, `UserList.tsx`, `useUserListParams.test.tsx`, `UserList.test.tsx`.

- **2026-08-26 — Joined-year filter, hierarchical unit picker, import template alignment.** **Units API consolidated:** three copies of `useUserUnits` (`feature/user`, `feature/credential`, `feature/user-unit`) collapsed into `shared/api/useUserUnits.ts` with `userUnitKeys` folded in. The consolidated hook sends **no `limit` param**, so the endpoint's own 1000 default applies — this is the fix for the 100-unit cap that silently truncated the unit tree. Eight import sites re-pointed; three test files deleted, one added. **New `shared/components/UnitPicker`:** hierarchical, indented, searchable unit selector (search input appears past `SEARCH_THRESHOLD = 8`) replacing the flat Radix `<Select>` on `UserCreateRow`. Content uses `w-(--radix-dropdown-menu-trigger-width)` so the panel tracks field width at every breakpoint instead of a fixed `w-56`. **Joined-year range filter:** new `JoinedYearFilterMenu` (two in-panel year columns + Reset, generated client-side from `YEAR_FLOOR = 1990` to the current year — no lookup request). `useUserListParams` gains `yearFrom`/`yearTo` with a `parseYear` trust boundary; `UserList` pushes `joined_year>=`/`joined_year<=` (two bounds, not `..` BETWEEN, which cannot express a one-sided range). MSW `applyFilters` extended to parse `>=`/`<=` before `=`. **Import fixes:** template headers `unit_id`/`number_id` → `unit`/`number`, with a `LEGACY_HEADERS` alias so pre-rename files still import rather than silently falling through to `meta_entries`. The `unit` column accepts a ULID, a bare name, or a `Faculty > Department` path via new `createUnitResolver` in `shared/lib/units.ts`; duplicate names error per-row naming all candidate paths. `XLSX.read` now runs with `cellDates: true` and dates format through new `formatISODate` (local getters, not `toISOString`, which shifts the day across the UTC boundary). Unrecognised `gender`/`role` now hard-error instead of failing open into a `holder` default. Template example units are drawn from real units so it round-trips its own first import. **Terminology:** `MetaEditor` stops rendering its own label (the duplication is now impossible at any of its five call sites) and `selfLabeled` was deleted from `DetailEditForm`; `meta.label` and `cred.field.meta` are both "Informasi Tambahan" / "Additional Information", `userCreate.customFields.toggle` deleted. Joined-year placeholder `"mis. 2024"` → `"2024"`, matching every sibling field. 11 new FE-only i18n keys (`user.filter.year.*`, `userImport.validation.unit*`/`.genderInvalid`/`.roleInvalid`). Tests 545→801 across 93 spec files. New: `UnitPicker.tsx`, `UnitPicker.test.tsx`, `JoinedYearFilterMenu.tsx`, `JoinedYearFilterMenu.test.tsx`, `shared/api/useUserUnits.ts` + test. Modified: `units.ts`, `format.ts`, `UserImportModal.tsx`, `UserCreateRow.tsx`, `MetaEditor.tsx`, `DetailEditForm.tsx`, `UserDetail.tsx`, `CredentialDetail.tsx`, `UserList.tsx`, `useUserListParams.ts`, `msw/handlers.ts`, `en.json`, `id.json`.

- **2026-06-21 — PaginationBar → LoadMoreBar migration + Credential filter/sort menus.** Deleted `PaginationBar` and `PageSizeMenu`. New shared `LoadMoreBar` component (count label + Load More button). New `useLoadMore` hook (cumulative offset-based pagination). `CredentialList` uses `useLoadMore` + `LoadMoreBar` + new `CredentialStatusFilterMenu` + `CredentialSortMenu`. `UserList` uses `useLoadMore` + `LoadMoreBar`. `MyCredentials` uses `useLoadMore` + `LoadMoreBar`. `useUserListParams` simplified: removed `page`, `limit`, `ALLOWED_LIMITS`, `parsePage`, `parseLimit`. Updated AGENTS.md: test count 343→545 (40→59 spec files), hooks list, shared component list, architecture diagram. All 545 tests pass. Modified: `LoadMoreBar.tsx`, `useLoadMore.ts`, `CredentialStatusFilterMenu.tsx`, `CredentialSortMenu.tsx`, `CredentialList.tsx`, `UserList.tsx`, `MyCredentials.tsx`, `useUserListParams.ts`, `AGENTS.md`.

- **2026-06-13 — UserCreate page polish: header, birth date width, custom fields toggle.** Matched Add User page header to About page pattern (`<BackLink />` + `<PageHeader>` without circular icon `onBack`). Fixed Birth Date input taking full width on mobile by constraining to `max-w-[13rem]`. Replaced native `<details>/<summary>` custom fields toggle with controlled `useState` button + `ChevronDown` icon that rotates 180° on open. Changed i18n label from `+ Add custom fields` → `Custom Fields` (en) / `Kolom Kustom` (id). All 343 tests pass. Modified: `UserCreate.tsx`, `UserCreateRow.tsx`, `en.json`, `id.json`.

- **2026-06-13 — Align PaginationParams with backend QueryRequest + default sort → updated_at.** Replaced `sort`/`order` pair in `PaginationParams` with `sorts`/`filters`/`includes` string arrays matching the Go backend `QueryRequest` struct field-for-field. `SortMenu` now accepts a single `value` sort string (`-column`/`column` convention). `StatusFilterMenu` renamed `DeletedFilter` → `StatusFilter` with values `all`/`active-only`/`trashed-only` (matching button labels). `useUsers` `buildQuery` replaced with inline pass-through; filter-string construction moved to `UserList.tsx`. URL param `deleted` → `status`. Default sort changed from `-created_at` to `-updated_at`. Added `staleTime: 0` to user list query to prevent stale cache between filter toggles. Updated `CredentialIssue.tsx` to use `filters` array. Updated test assertions for new param names. All 343 tests pass. Modified: `api.ts`, `useUserListParams.ts`, `SortMenu.tsx`, `StatusFilterMenu.tsx`, `useUsers.ts`, `UserList.tsx`, `CredentialIssue.tsx`, `useUserListParams.test.tsx`, `UserList.test.tsx`.

- **2026-06-13 — Filter dropdown UX polish + row View action.** Filter dropdowns (Role, Status, Sort) now display the selected option label in the trigger button (e.g. `Role: All ▼`, `Status: All ▼`, `Sort: Newest ▼`) matching the `PageSizeMenu` pattern. Removed left-side icons from filter triggers for visual consistency across all four controls. Renamed sort options: `Newest first` → `Newest`, `Oldest first` → `Oldest`, `Role` → `Role ↑`. Simplified filter labels: `All Roles` → `All`, `Show all` → `All`. Reordered button sequence to `Role → Status → Sort → Limit`. Added View menu item (`Eye` icon) above Edit in row action dropdown menu with TODO comment to wire user-detail navigation. New i18n key `common.view` (en: "View", id: "Lihat"). Updated test selectors for the changed button labels. No new test files; all 343 tests pass. Modified: `SortMenu.tsx`, `StatusFilterMenu.tsx`, `RoleFilterMenu.tsx`, `UserList.tsx`, `UserList.test.tsx`, `en.json`, `id.json`.

- **2026-06-13 — Unify filter dropdowns + extract shared PaginationBar.** Replaced inline Status filter with extracted `StatusFilterMenu` component (gold `Check` icon, `font-bold` active state, `w-48` dropdown). Replaced Radix `Select` pagination limit with `PageSizeMenu` (uses `DropdownMenu` to eliminate scroll-lock layout shift). Extracted shared `PaginationBar` component from UserList and CredentialList. New files: `StatusFilterMenu.tsx`, `PageSizeMenu.tsx` (`feature/user/components/`), `PaginationBar.tsx` (`shared/components/`). Updated AGENTS.md architecture diagram and shared component count (19 → 20). No new i18n keys, no test changes (343/343 pass).

- **2026-06-11 — Design consistency audit & refactor (v1 + v2 merged).** Comprehensive audit and fix of 21 inconsistency categories across ~35 files. **Focus rings:** `primary`/`outline`/`ghost`/`dashed` Button variants changed from `focus-visible:ring-navy` → `focus-visible:ring-gold` to match canonical focus ring (§5.1). Input and Select focus rings also changed to `ring-gold`. **Shadows:** select/toaster/Login card shadows changed from `shadow-gray-200/50` → `shadow-navy/20`. NavbarOverview search dropdown gained `shadow-navy/20`. OfflineBanner gained `shadow-error/20`. **Font families:** `CardTitle` changed from `font-display` → `font-sans` (§6.1 card title recipe). `EmptyState` title changed to `font-sans`. `CredentialCard` title changed to `font-sans`. **Viewport units:** `NotFound`, `AppErrorBoundary`, `RouteErrorBoundary`, `FullPageSpinner` changed `min-h-screen` → `min-h-dvh`. **i18n:** credential feature fully wired (~90 new keys across en.json/id.json — `cred.*`, `user.detail.*`, `user.status.*`, `not_found.*`, `offline.*`, `error_boundary.*`). `UserDetail` labels, `UserStatusBadge`, `CredentialStatusBadge` wired to i18n. **Shared component replacements:** `NotFound` reduced to single DecorBlob. `OfflineBanner` and `RouteErrorBoundary` use i18n keys. `UserStatusBadge` and `CredentialStatusBadge` now use `StatusPill` instead of hand-rolled spans. `CredentialCard` uses `Card` component instead of raw div. `Settings` uses `PageHeader` instead of inline heading. `About`/`Help` email buttons use `Button` component instead of raw `<a>`. `CredentialIssue` submit button changed from `gold` → `primary` to match UserCreate. **New shared components:** `FormField` (`@ui/form-field`) — extracted from 3 duplicated `Field`/`FormField` inline implementations in UserCreateRow, CredentialIssueRow, UserEditDrawer. `DetailRow` (`@shared/components/DetailRow`) — extracted dt/dd pattern from 5 feature files with icon + tone support. **Token fixes:** `DecorBlob` blue tone `bg-blue-500/10` → `bg-info/10`. `Table` body `bg-white` → `bg-surface`. `OverviewSidebar` `bg-white/15` → `bg-surface/15`. `UserDetail` width `max-w-3xl` → `max-w-4xl`. `VerifyCredential` result banner `bg-green-500` → `bg-success`. `Landing` subtitle removed conflicting `text-base` (resolves `text-gray-600` conflict with `--color-base` token). All remaining template-string classNames replaced with `cn()`. **Tailwind v4 deprecation fixes:** `flex-shrink-0` → `shrink-0` (11 instances), `data-[*=*]:` → `data-*-*:` syntax (28 instances across select/dialog/dropdown-menu), `min-w-[8rem]` → `min-w-32`, `var(--radix-*)` → `(--radix-*)`, `[scrollbar-gutter:stable]` → `scrollbar-gutter-stable`. **Tests:** 9 new test files (49 new tests) — Button, StatusPill, EmptyState, DetailRow, FormField, NotFound, OfflineBanner, AppErrorBoundary, RouteErrorBoundary. Tests now 343 across 40 spec files. No new dependencies, no behavioral changes. Changed `SplitLayout` from `min-h-screen` to `h-dvh overflow-hidden` on both outer container and right panel, preventing any content from exceeding the viewport. Mobile brand band now uses `h-[33dvh]` with `flex items-center justify-center` to center brand content. Content area uses `flex-1` to fill the remaining 67dvh, and `min-h-0 overflow-hidden` (critical `min-h-0` allows flex children to shrink). Added `className` prop to `AttestationStamp` component so callers can override sizing; mobile brand band now renders `AttestationStamp` with `className="max-w-[min(160px,18vh)]"` to scale it down on short screens instead of hiding it entirely. `Landing` section now has `flex items-center justify-center` to vertically center content in the white area. `Login` root div now has `flex items-center justify-start lg:justify-center` so content is top-aligned on mobile (better UX when keyboard appears) and centered on desktop. `Login` `<BackLink>` now uses `self-start` so it aligns to the left of the card instead of centering. `Landing` and `Login` content refactored to use viewport-relative units: `py-[2dvh]` instead of fixed `py-10`/`py-8`, `space-y-[1.5dvh]` instead of `space-y-6`, card padding reduced to `p-6 sm:p-8`. Removed forced `min-h-[2.1lh]`, `min-h-[5lh]`, `min-h-[2lh]` from headings and subtitles — these min-heights prevented content from shrinking to fit short viewports. Added `SplitLayout.test.tsx` (5 tests) asserting `h-dvh`, `overflow-hidden`, `min-h-0`, `h-[33dvh]`, and `flex-shrink-0` classes. No new i18n keys.
- **2026-06-10 — Make `CopyrightFooter` background transparent.** Switched the footer from `bg-surface` (#FFFFFF) to `bg-transparent` so the page's `bg-base` (#F8FAFC) shows through. Previous setup created a visible "white void" between short content and the footer — `bg-surface` and `bg-base` are only ~3% apart in lightness, so on most screens the footer area looked like a different section from the page background. Transparent background eliminates this contrast entirely. Added a test asserting the footer renders with `bg-transparent`. No new i18n keys, no logic changes.
- **2026-06-10 — Unify all back buttons + logout redirects to landing.** Extracted the smart-back logic from `BackLink` into a new shared hook `useSmartBack` (`src/shared/hooks/useSmartBack.ts`) that returns a callback: goes back in browser history if `location.key !== "default"`, else falls back to `/dashboard` (authed) or `/` (unauthed). `BackLink` is now a thin wrapper around the hook. `PageHeader` accepts `onBack?: (() => void) | true` — when `true` it uses the smart back (was a hardcoded `navigate("/users")` / `navigate("/credentials")` that broke on refresh); when a function is provided it uses that. Updated 4 callers (`UserDetail`, `UserCreate`, `CredentialDetail`, `CredentialIssue`) to pass `onBack` (shorthand for `true`) and dropped their now-unused `useNavigate` / `navigate("/users")` imports. Side effect: UserDetail no longer always goes to `/users` after a refresh — it falls back to `/dashboard` like BackLink already did. Logout now redirects to `/` (landing) instead of `/login` or staying on the current page: moved the navigation into the `useLogout` hook's `onSettled` callback (`navigate("/", { replace: true })`), removed the manual `navigate("/login")` from `OverviewSidebar`'s logout handler, and `NavbarOverview` (which previously had no post-logout redirect) now also lands on the landing page. New tests: 4 for `useSmartBack` (history, auth fallback, unauth fallback, stable identity) + 6 for `PageHeader` (omit hides, `true` renders, history, auth fallback, unauth fallback, custom callback).
- **2026-06-10 — Unify back navigation + logout redirect.** Extracted `useSmartBack()` hook (`src/shared/hooks/useSmartBack.ts`) from `BackLink`'s inline logic — checks `location.key !== "default"` for browser history; falls back to `/dashboard` (auth) or `/` (unauth) when no history (e.g., page refresh). `BackLink` now uses the hook (no behavior change). `PageHeader` extended to use the hook when `onBack={true}` is passed, replacing the old hardcoded `navigate("/users")` / `navigate("/credentials")` callbacks on `UserDetail`, `UserCreate`, `CredentialDetail`, and `CredentialIssue`. Net effect: all back affordances (text links in `BackLink`, icon buttons in `PageHeader`) share the same smart history-aware fallback. `useLogout` now also navigates to `/` via `navigate("/", { replace: true })` in its `onSettled`, replacing the per-call `onSettled: () => navigate("/login")` shim in `OverviewSidebar` and giving `NavbarOverview` logout (which previously stayed on the current page) a landing redirect. 10 new tests: 4 for the hook, 6 for `PageHeader`. No new i18n keys, no logic change beyond navigation.
- **2026-06-10 — Navbar extraction + specific naming for Sidebar/TopNav.** Extracted `PublicLayout`'s inline header into a standalone `NavbarPublic` component. Renamed `TopNav` → `NavbarOverview` and `Sidebar` → `OverviewSidebar` for consistency (all layout chrome now follows the `Navbar{Context}` / `{Context}{Piece}` convention). Removed redundant `py-4` from `NavbarOverview`'s inner div so it renders at exactly 64px (matching `NavbarPublic`) instead of 76px. Renamed Zustand store state `sidebarOpen` → `dashboardSidebarOpen` (and corresponding setters/togglers) — currently unused by any component but kept for future cross-component coordination. Updated `DESIGN_SYSTEM.md` (§8.1 layout table, §8.6 sidebar pattern, §8.7 mobile drawer, store example, search input rows) to reflect the new names. No behavior change beyond the 12px height correction.
- **2026-06-10 — Extract `CopyrightFooter` component + fix mobile bottom-anchoring.** New shared component `@shared/components/CopyrightFooter` (`@shared/components/CopyrightFooter.tsx`) replaces the inline `<footer>` previously duplicated in `PublicLayout`. Renders `© {year} · CredChain · All rights reserved` in `font-sans` (DM Sans) at `text-xs` — copyright text is functional/legal copy, not a heading (`font-display`) or an identifier (`font-mono`). Carries `safe-area-bottom` and `no-print` classes. `PublicLayout` container switched from `min-h-screen` to `min-h-dvh` so the footer stays anchored to the bottom of the _visible_ viewport on mobile browsers where `100vh` over-counts (mobile browser chrome collapses/expands the viewport, leaving the old `100vh` footer below the fold or cropped against the bottom bar). 9 tests in `CopyrightFooter.test.tsx` cover year rendering, role, classes, font choice, transparent background, and custom `className` passthrough. DESIGN_SYSTEM.md §8.1 updated to reference the new component.
- **2026-06-09 — Flatten all header heights to `min-h-[64px]` (no `sm:` breakpoint).** Reverted `NavbarOverview` desktop height from `min-h-[64px] sm:min-h-[72px]` to flat `min-h-[64px]` — the extra 8px on desktop was unnecessary for the search input + avatar combo, and the user found it too tall on responsive screens. Updated `PublicLayout` header to match (was `min-h-[64px] sm:min-h-[72px]` from the previous unification). Both headers now render identically at 64px on every breakpoint. `SplitLayout` (Landing, Login) still uses its own navy band pattern. Updated DESIGN_SYSTEM.md §8.1 to reflect the flat height.
- **2026-06-09 — Unify BackLink top spacing on AdaptiveLayout pages.** Removed redundant `pt-2` from Help and About page wrappers. All four pages with `<BackLink />` (Help, About, Profile, Update Email) now share an identical wrapper pattern: `max-w-{N}xl mx-auto space-y-6` (no `pt-*`). The 16px `pt-4` on `<main>` already provides the top breathing room, so `pt-2` only created an 8px inconsistency between Help/About and Profile/Email.
- **2026-06-09 — Unify PublicLayout chrome with OverviewLayout.** Public header height now `min-h-[64px]` matching `NavbarOverview` (was fixed `h-16`, 8px shorter on desktop). Public `<main>` padding now `px-4 pt-4 pb-12 sm:px-8` matching `OverviewLayout` (was `px-4 sm:px-6 lg:px-8 py-6`). Effect: unauthed Help / About / VerifyCredential now render with identical navbar height and content offset to their authed (`OverviewLayout`) counterparts. `SplitLayout` (Landing, Login) intentionally unchanged — it uses its own centered-content pattern. Documented BackLink behavior + placement in DESIGN_SYSTEM.md §6.2.1.
- **2026-06-09 — Reset scroll on navigation.** Added `useScrollToTop()` hook (`src/shared/hooks/useScrollToTop.ts`) that resets both the window scroller and the `#main` overflow container to `(0, 0)` whenever the pathname changes. Wired into `OverviewLayout`, `PublicLayout`, and `SplitLayout` so every page transition starts at the top. React Router v7's built-in `ScrollRestoration` only manages the document scroller; `OverviewLayout`'s `main#main` uses `overflow-y-scroll` so the document never scrolls — both containers must be reset.
- **2026-05-31 — Dark mode removed.** `ThemeProvider`, `ThemeToggle`, the `theme` slice in Zustand, the `:root.dark` CSS overrides, the `.text-fg` utility, and the no-flash inline script in `index.html` were all deleted. The app now renders only in light mode, faithful to `DESIGN_SYSTEM.md`. `text-navy` replaced every `text-fg` usage. `LanguageSwitcher`'s `variant="dark"` prop remains — it is a _background-aware_ styling switch (for placement on the navy header/sidebar), not a theme switch.
- **2026-06-09 — Help email button alignment fix.** Help Contact email button now uses `self-start sm:self-auto` matching the About Contact email button. Without these classes, the mobile button was stretching to full container width (flex-column stretch default) while About's hugged its content.
- **2026-06-09 — Help card title typography consistency.** Help Contact card title now uses `font-display` (Fraunces) matching the FAQ card title and the parallel About Contact title. Same fix as the About card; both pages were built from the same template and shared the bug.
- **2026-06-09 — About card title typography consistency.** Contact card title now uses `font-display` (Fraunces) matching all other card titles on the page. Was the only `font-bold`-only title (DM Sans) on the page. No test changes.
- **2026-06-09 — Add landing page CTA to About.** New explore card at bottom of About page with gold pill button linking to `/`. Added i18n keys `about.explore.title/body/action` (en + id). Added test asserting landing link renders with correct href.
- **2026-06-09 — BackLink wiring across pages.** `BackLink` (browser-history back with role-aware fallback to `/dashboard` or `/`) now used on Help, About, Login, Profile, and Update Email pages. Replaced inline `<Link to="/">` / `t("common.backToHome")` with `<BackLink />`. Added `common.back` i18n key ("Back" / "Kembali"), removed `common.backToHome`. Added `BackLink.test.tsx` (4 tests) covering history-back, auth fallback, and unauth fallback.
- **2026-06-09 — Navbar + dropdown polish.** Fixed NavbarOverview vertical centering (separated `safe-area-top` from flex row's `py-*` to avoid CSS utilities-layer cascade override). OverviewLayout `main` now uses `overflow-y-scroll [scrollbar-gutter:stable]` so route-switches with different content heights no longer reflow the navbar. Profile dropdown set to `modal={false}` to avoid scroll-lock layout shifts; trigger button uses `focus-visible:[outline:none]` to defeat the global `:focus-visible` gold outline; focus indicator moved onto the avatar itself via `group-focus-visible:ring-gold` (clean circular ring, keyboard-only). Avatar gets adaptive ring (`ring-surface` on mobile navy header, `ring-gray-200` on desktop light header). Removed the gold `<DecorBlob>` from the mobile navy band in `SplitLayout` (was clipped by `overflow-hidden` and the safe-area gap on notched iOS). Tinted all dropdown shadows `shadow-navy/20` (was `shadow-gray-200/50` which appeared as a white smudge on dark backgrounds).
- **2026-06-09 — Docs resync to as-built.** AGENTS.md + DESIGN_SYSTEM.md reconciled with actual codebase. Major corrections: added `feature/landing/` (was undocumented); replaced `AuthLayout` references with `SplitLayout`/`AdaptiveLayout`; removed `RootRedirect` (deleted), added `BackLink`; shadcn count corrected to 12 primitives (not 13); test count updated to 244 + 20 E2E (was 179); coverage documented as selective allowlist (not global); env-var table extended with `VITE_API_PROXY` and `VITE_SUPPORT_EMAIL`; documented husky/lint-staged pre-commit flow; removed `ethers` from tech stack (unused dep). DESIGN_SYSTEM.md preserve design-philosophy sections intact.
- **2026-06-09 — Responsive polish for create/issue forms + shared header.** `PageHeader` back button now scales with viewport (`h-8 w-8` on mobile → `h-10 w-10` at `sm+`; icon `w-4 h-4` → `w-5 h-5`) so it stops looking oversized on phones/tablets — improves every page that passes `onBack` (UserCreate, UserDetail, UserSelfEmail, CredentialIssue, CredentialDetail). `UserCreateRow` + `CredentialIssueRow` tighten mobile padding (`p-4 sm:p-6`) and grid gaps (`gap-4 sm:gap-6`), bump grid right-padding (`pr-8` → `pr-12`) so the absolute trash button no longer overlaps the rightmost inputs, and shrink the trash button itself on mobile (`h-8 w-8 sm:h-9 sm:w-9`, offset `top-3 right-3 sm:top-4 sm:right-4`). `MetaEditor` key/value rows stack vertically on `<sm` screens (key+value grouped in a nested `grid grid-cols-1 sm:grid-cols-2` with the remove `X` held at the row level via `flex` so it never orphans onto its own line). `CredentialDetail` status card header stacks on mobile (`flex-col sm:flex-row`) so the "Public verification" button no longer squeezes. No new i18n keys, no logic changes — CSS-only, existing tests unaffected.
- **2026-06-09 — Fix dropdown scroll-lock layout shift.** Opening any Radix `Select` (Role/Gender on Add-Users, etc.) shifted the whole page ~12px on the x-axis and the scrollbar flickered. Cause: `react-remove-scroll` (mounted unconditionally by `@radix-ui/react-select@2.2.6`, which has **no** `modal` prop) sets `body[data-scroll-locked]` and injects `padding-right`/`margin-right` equal to the scrollbar width — but `<html>` already reserves that space via `scrollbar-gutter: stable`, so the compensation double-counts. Fix: global `body[data-scroll-locked] { margin-right: 0 !important; padding-right: 0 !important; }` in `styles/index.css` (gutter is already stable, so no compensation is needed). Separately, `@ui/dropdown-menu` `DropdownMenu` now defaults `modal={false}` at the primitive level (it _does_ support the prop), so action menus (UserList row `⋯`, filters) no longer scroll-lock; removed the now-redundant explicit `modal={false}` on the NavbarOverview profile menu. CSS + primitive-default change only, no i18n or logic changes.
- **2026-06-11 — Unify layout max-widths + fix login back-button redirect loop.** Aligned every page width to its category per §8.2 (lists `max-w-7xl`, forms `max-w-6xl`, detail/settings `max-w-4xl`, email `max-w-2xl`): `UserDetail` and `UserSelfProfile` (was `max-w-3xl`) + `About` and `VerifyCredential` (was `max-w-3xl`) bumped to `max-w-4xl`. Navbar and main content now share `max-w-7xl` everywhere — `NavbarOverview` inner div and `PublicLayout` `<main>` both gained `mx-auto max-w-7xl` so the navy header band and the page content below it share the same outer boundary. `CopyrightFooter` gained `mx-auto max-w-7xl` so the footer text aligns with the navbar edge too. NavbarPublic padding simplified from `px-4 sm:px-6 lg:px-8` to `px-4 sm:px-8` to match `<main>`. `OverviewLayout` height/background corrected to `min-h-dvh bg-base` (was `min-h-screen bg-gray-100`, the inner content wrapper was the hardcoded hex `bg-[#F4F7F6]`) and the sidebar to `sm:h-dvh` (was `sm:h-screen`) per the desktop-footer `min-h-dvh` rule documented in §8.1. Login back-button fix: `useSmartBack` now special-cases `location.pathname === "/login" && location.state?.from` (set by `ProtectedRoute` on a guarded redirect). `ProtectedRoute` uses `replace: true` so the protected entry is consumed — a naive `navigate(-1)` then either lands back on `/login` (loop) or skips the user's actual previous page. When the guard detects this state it navigates to `/dashboard` (authenticated) or `/` (unauthenticated) instead. 3 new tests in `useSmartBack.test.ts` (login + redirect unauth → `/`, auth → `/dashboard`, and still-back-when-no-redirect-state-on-`/login`) and 2 new tests in `BackLink.test.tsx` (same two login-redirect scenarios) — 7 + 6 tests, 287 total. No new i18n keys.
- **2026-06-11 — Revert OverviewLayout/NavbarOverview `max-w-7xl` + add UserList table horizontal scroll.** Reverted the `mx-auto max-w-7xl` that was added to `NavbarOverview` inner div and `OverviewLayout` `<main>` — that constraint was wrong for a sidebar layout: with the sidebar at `w-72` and the main content in `flex-1`, imposing `max-w-7xl` on the main container double-constrained list pages (which are themselves `max-w-7xl`) and pushed the navbar items into a 1280px band. Both are now full width: `<main>` drops to `flex-1 [scrollbar-gutter:stable] overflow-y-scroll px-4 pt-4 pb-12 sm:px-8` and the navbar inner div drops to `flex min-h-[64px] items-center justify-between px-4 shadow-md sm:px-8 sm:shadow-none`. PublicLayout's `mx-auto max-w-7xl` is kept because it correctly aligns the public navbar with the public content area (no sidebar). Also wrapped `<Table>` in `UserList.tsx` with a `<div className="overflow-x-auto">` so the 4-column table (entity, role, wallet/status, actions) scrolls horizontally on narrow viewports instead of squishing columns past their `truncate max-w-[12rem]/[14rem]` limits. `CredentialList` uses the same `Table` primitive but is admin-only and not user-reported broken — left as-is for now. No new i18n keys, no new tests (UserList table is the same component, just wrapped in a scroll container).
- **2026-06-11 — Re-add `max-w-7xl` to NavbarOverview inner row (background stays full-width).** Re-adding `mx-auto max-w-7xl` to the NavbarOverview flex row — the `<header>` background still spans full width but the menu/search/avatar row is now centered at `max-w-7xl` and aligns with the list pages below. The previous "full width" revert was correct for the _content area_ (OverviewLayout `<main>`) but not for the _navbar_ — navbar items need a container boundary so ultra-wide screens don't push the avatar cluster 2000px away from the menu button. This matches the same pattern as NavbarPublic: full-width background, centered content. No test changes (no behavioral change beyond visual containment).

## See Also

- `DESIGN_SYSTEM.md` — full visual + engineering specification (87.9K)
- `README.md` — quickstart for human contributors
- `package.json` — frozen tech-stack version pins + npm scripts
- `vite.config.ts` — proxy setup, manual chunks, ES2022 target
- `vitest.config.ts` — jsdom env, coverage thresholds, setup files
- `playwright.config.ts` — chromium + mobile projects
- `eslint.config.js` / `prettier.config.js` — formatting + lint rules
- `scripts/check-locales-sync.mjs` — locale drift verification
- `../AGENTS.md` (workspace root, uncommitted) — multi-repo reference
- `../CredChain_Golang/AGENTS.md` — backend contract reference
- `../CredChain_Solidity/AGENTS.md` — smart contract reference
- `../CredChain_Python/AGENTS.md` — AI service reference
