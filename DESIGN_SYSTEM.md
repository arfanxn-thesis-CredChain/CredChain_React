# CredChain React - Design System & Engineering Specification

> For AI assistants and engineers building CredChain_React/. This document is the single source of truth for the production frontend's design and engineering decisions. It supersedes CredChain_React_Demo/ (reference only - do not import from it).
>
> **Document responsibilities:** For operational instructions (commands, patterns, conventions, checklists, pitfalls), see `AGENTS.md`. This file owns design decisions — tokens, typography, layout, component recipes, visual philosophy, accessibility. When updating design decisions, update this file; when updating how to work in the repo, update `AGENTS.md`.

Status: Draft v1.10 | Last updated: 2026-11-11 | Related: ../AGENTS.md, ../CredChain_Golang/

---

## Table of Contents

1. Purpose & Audience
2. Product Context
3. Tech Stack
4. Project Architecture
5. Design Tokens
6. Typography
7. Component Recipes
8. Layout System
9. State Management
10. API Integration Layer
11. Authentication Flow
12. Routing & Authorization
13. Forms & Validation
14. Internationalization
15. Error Handling
16. Accessibility
17. Testing Strategy
18. Performance & Build
19. Coding Conventions
20. Migration Notes from Demo
21. AI Development Prompts
22. Open Questions / Decision Log

---

## 1. Purpose & Audience

This document defines how CredChain's production React frontend is built, styled, and extended. It targets:

- Engineers writing new features and maintaining the codebase
- AI assistants (Claude, GPT, Copilot, opencode) generating components, screens, and integrations
- Designers translating Figma decisions into tokens and recipes
- Reviewers auditing PRs against established patterns

The aesthetic is locked: premium decentralized credential platform - navy + gold, modern fintech with blockchain cues. Architecture, tokens, and recipes below are the authoritative reference.

---

## 2. Product Context

CredChain is a decentralized credential platform. The role hierarchy (same in Go backend and Solidity contracts):

| Role       | Level | On-chain | Capabilities                                            |
| ---------- | ----- | -------- | ------------------------------------------------------- |
| SuperAdmin | 4     | yes      | Manages Admins; only one; bootstrapped via Go CLI only  |
| Admin      | 3     | yes      | Manages users, settings; can promote to Issuer          |
| Issuer     | 2     | yes      | Issues, revokes, verifies credentials                   |
| Holder     | 1     | yes      | Receives credentials, manages own profile               |
| None       | 0     | yes      | On-chain revocation target only - never persisted in DB |

Frontend surfaces:

- Public: credential public verification page (no auth required)
- Auth: Google OAuth login only (no email/password)
- Overview: role-aware shell with sidebar; gates Admin/Issuer/Holder views

Backend contract (see ../CredChain_Golang/AGENTS.md):

- All routes under /api
- Response envelope: { code: number, message: string, data?: T }
- 6-digit response codes (AABBCC): category 10/20/30/40/50, feature, status; Python owns category 50 and Go translates downstream failures
- Locales: en, id - frontend keys must match backend message keys
- Auth: Google OAuth only -> access (JWT, stateless) + refresh (DB-rotated) tokens
- Rate limits: login 300/min, refresh 200/min, logout 100/min, API 1200/min

---

## 3. Tech Stack

| Layer         | Choice                                 | Version   | Rationale                                                        |
| ------------- | -------------------------------------- | --------- | ---------------------------------------------------------------- |
| Language      | TypeScript                             | ~5.9      | Strict mode; end-to-end type safety with Zod                     |
| Framework     | React                                  | ^19       | Demo already on 19; ecosystem alignment                          |
| Build         | Vite                                   | ^7        | Fast HMR, native ESM, Tailwind v4 plugin                         |
| Styling       | Tailwind CSS v4                        | ^4.2      | @theme directive, no tailwind.config.js                          |
| UI primitives | shadcn/ui + Radix UI                   | latest    | Copy-paste source on Radix; owned in-repo, accessible by default |
| Icons         | lucide-react                           | latest    | Single icon source; matches demo                                 |
| Routing       | React Router                           | ^7        | Data router with lazy routes                                     |
| Server state  | TanStack Query                         | ^5        | Caching, refetch, optimistic updates, mutations                  |
| HTTP client   | axios                                  | ^1        | Interceptors for auth + envelope unwrapping                      |
| Client state  | Zustand                                | ^5        | Auth, UI, ephemeral state                                        |
| Forms         | React Hook Form                        | ^7        | Performance; batch/dynamic forms                                 |
| Validation    | Zod                                    | ^3        | Mirrors Go Ozzo rules; type inference                            |
| i18n          | i18next + react-i18next                | ^23 / ^14 | Statically imported en/id catalogs; backend-key presence check   |
| Auth (OAuth)  | @react-oauth/google                    | ^0.12     | Google Sign-In button, ID token retrieval                        |
| Toasts        | sonner                                 | ^1.5      | Headless, Tailwind-friendly                                      |
| Class utils   | clsx + tailwind-merge                  | ^2 / ^3   | cn() helper                                                      |
| Drawer        | vaul                                   | ^1.1      | Declared dependency; no current production source usage          |
| Tests         | Vitest + Testing Library               | ^3 / ^16  | Vite-native, Jest-compatible API                                 |
| API mocking   | MSW                                    | ^2        | Service worker fetch interception                                |
| E2E           | Playwright                             | ^1        | Cross-browser, trace viewer                                      |
| Lint          | ESLint + typescript-eslint             | ^9 / ^8   | Same as demo                                                     |
| Format        | Prettier + prettier-plugin-tailwindcss | ^3 / ^0.6 | Auto-sort Tailwind classes                                       |
| Git hooks     | husky + lint-staged                    | ^9 / ^15  | Pre-commit format/lint                                           |

### Why shadcn/ui over hand-rolled

The demo hand-rolls everything (selects, modals via window.confirm, no popovers). Production needs accessible select dropdowns, dialogs, command palettes, dropdown menus, toasts, tabs - building all of that from scratch is months of work and an accessibility liability. shadcn/ui gives us Radix primitives (WAI-ARIA compliant, keyboard navigation, focus traps) as source files in our repo that we restyle to our tokens. We own the code; we don't depend on a versioned package. This is the 2026 default for Tailwind apps.

**Components installed in `src/shared/components/ui/`:** badge, button, card, confirm-dialog, dialog, dropdown-menu, file-dropzone, form-field, input, label, select, skeleton, table, textarea, toaster.

All shadcn components live in `src/shared/components/ui/` and are restyled to use our tokens (`navy`, `gold`, `error`) before any feature code consumes them. `vaul` remains declared, but current production source has no `Drawer` usage or `UserEditDrawer.tsx`. The mobile sidebar is hand-rolled (see §8.7).

---

## 4. Project Architecture

### 4.1 Folder Structure

Feature-driven, evolved from the demo:

```
CredChain_React/
  public/
  e2e/                  # session-refresh.spec.ts (mocked browser regressions)
  scripts/
    check-locales-sync.mjs
  src/
    app/                  # cross-cutting app wiring
      App.tsx              # mounts Providers → SessionHydrator → RouterProvider
      providers.tsx        # QueryClient + I18n + GoogleOAuth + AppErrorBoundary + OfflineBanner + Toaster
      router.tsx           # createBrowserRouter (lazy via lazyRoute() helper)
      SessionHydrator.tsx  # GET /users/self for persisted auth only; syncs locale
      store/
        index.ts           # combined auth + UI slices in one file (with persist middleware)
    feature/                 # one folder per business domain
      auth/
        api/                 # useGoogleLogin, useLogout
        Login.tsx
        index.ts
      user/
        api/                 # user queries and mutations + keys.ts
        components/          # user forms, import modal, filters and sort menus
        hooks/               # useUserListParams
        schemas/             # user (Zod)
        UserList.tsx / UserDetail.tsx / UserCreate.tsx
        UserSelfProfile.tsx / UserSelfEmail.tsx
      credential/
        api/                 # credential queries, mutations and keys
        components/          # issue/submit rows, filters, preview and review modals
        schemas/             # credential (Zod)
        CredentialList.tsx / CredentialDetailModal.tsx / CredentialIssue.tsx
        CredentialSubmit.tsx / VerifyCredential.tsx
      credential-type/       # CredentialTypesPage
      issuer-organization/   # IssuerOrganizationsPage
      competency/            # CompetenciesPage
      user-unit/             # UserUnitsPage
      notification/          # NotificationsPage
      overview/
        Overview.tsx            # Main overview/dashboard page
        Settings.tsx            # @deprecated (2026-07-08), not in routes
        api/
          useOverview.ts        # TanStack Query hook
          keys.ts               # Query keys
        components/
          DateFilterMenu.tsx    # Date range filter
      landing/
        Landing.tsx          # self-wraps SplitLayout, route: "/"
        index.ts
      about/  About.tsx + index.ts
      help/   Help.tsx + index.ts
    shared/
      api/
        client.ts            # axios instance + interceptors (refresh dedup, X-Retry, 429 mapping)
        codes.ts             # backend response codes -> i18n keys
        envelope.ts          # ApiResponse<T>, ApiError, isApiError
        query-client.ts      # TanStack QueryClient config
      auth/
        role.ts              # Role, ROLE_LEVEL, ROLE_LABEL_KEY, access/edit/delete/transfer helpers
        guards.tsx           # ProtectedRoute, PublicRoute, RoleGate
      components/
        ui/                  # shared primitives and form wrappers (sole Radix import location)
        layout/
          AdaptiveLayout.tsx # renders OverviewLayout if authed, PublicLayout otherwise
          OverviewLayout.tsx
          PublicLayout.tsx
          SplitLayout.tsx    # 50/50 navy+light; used by Landing + Login
          OverviewSidebar.tsx
          NavbarOverview.tsx
          NavbarPublic.tsx
          nav-items.ts       # NAV_ITEMS with minRole + exactRole + inSidebar flags
         BackLink.tsx
         CopyrightFooter.tsx
         DecorBlob.tsx
         DetailRow.tsx
         EmptyState.tsx
        CopyInlineButton.tsx
        ErrorBoundary.tsx    # AppErrorBoundary
        EyebrowLabel.tsx
        LanguageSwitcher.tsx
        LoadingSpinner.tsx   # + FullPageSpinner
        MonoId.tsx
        NotFound.tsx
        OfflineBanner.tsx
        PageHeader.tsx
        RouteErrorBoundary.tsx
        UserStatusBadge.tsx
        CredentialStatusBadge.tsx
         UserAvatar.tsx
         UserRoleBadge.tsx
       hooks/                 # useDebouncedValue, useLoadMore, useNavSearch, useOnline,
                              # useReferenceStatusFilter, useScrollToTop, useSearchParam, useSmartBack, useT
      i18n/
        config.ts
        en.json              # mirrors backend locales/en.json
        id.json              # mirrors backend locales/id.json
      lib/                   # cn, env, format, forms, hash, jwt, notify
      types/
        api.ts               # UserDTO, AuthResponseDTO, CredentialDTO, PaginatedResponse, PaginationParams
    styles/
      index.css              # Tailwind v4 entry + @theme tokens + base + utilities
    test/                    # setup.ts, fixtures.ts, msw/{handlers,server}.ts, TestProviders.tsx
    main.tsx
    vite-env.d.ts
  .env.example / .env.test   # .env.test committed, used by Vitest
  components.json            # shadcn/ui config
  eslint.config.js
  index.html
  package.json
  prettier.config.js
  tsconfig.json + tsconfig.app.json + tsconfig.node.json
  vite.config.ts / vitest.config.ts / playwright.config.ts
  README.md
  AGENTS.md
  DESIGN_SYSTEM.md           # this file
```

### 4.2 Module Boundary Rules

1. `feature/<X>` may import from `shared/` - never the reverse.
2. `feature/<X>` may NOT import from `feature/<Y>` - share via `shared/` if needed.
3. `shared/components/ui/` (shadcn) is the only place where Radix imports live.
4. `shared/api/` is the only place that imports `axios` directly.
5. `app/` wires everything; do not put business logic here.
6. Avoid re-export barrels in deep paths to prevent circular imports; feature folders may have a single top-level `index.ts`.

### 4.3 Path Aliases

Define in `tsconfig.app.json` and `vite.config.ts`:

```json
{
  "paths": {
    "@/*": ["src/*"],
    "@app/*": ["src/app/*"],
    "@feature/*": ["src/feature/*"],
    "@shared/*": ["src/shared/*"],
    "@ui/*": ["src/shared/components/ui/*"]
  }
}
```

Required import order (the current ESLint configuration does not enforce `import/order`):

1. node/react builtins
2. third-party packages
3. `@app/*`
4. `@feature/*`
5. `@shared/*` / `@ui/*`
6. relative imports
7. side-effect imports (CSS) last

---

## 5. Design Tokens

All tokens live in `src/styles/index.css` under `@theme`. No hex codes in components - always use token names.

```css
/* src/styles/index.css */
@import "tailwindcss";

@theme {
  /* === BRAND COLORS === */
  --color-navy: #0f172a; /* primary brand, text, sidebar */
  --color-gold: #c9a227; /* accent, premium CTAs, focus ring */
  --color-base: #f8fafc; /* app background */
  --color-surface: #ffffff; /* card / elevated surface */
  --color-error: #b91c1c; /* destructive, revoked state */

  /* === EXTENDED NEUTRALS === */
  --color-gray-50: #f8fafc;
  --color-gray-100: #f1f5f9;
  --color-gray-200: #e2e8f0;
  --color-gray-300: #cbd5e1;
  --color-gray-400: #94a3b8;
  --color-gray-500: #64748b;
  --color-gray-600: #475569;
  --color-gray-700: #334155;
  --color-gray-800: #1e293b;
  --color-gray-900: #0f172a;

  /* === SEMANTIC ALIASES (used by shadcn/ui) === */
  --color-primary: var(--color-navy);
  --color-primary-foreground: var(--color-surface);
  --color-secondary: var(--color-gold);
  --color-secondary-foreground: var(--color-navy);
  --color-destructive: var(--color-error);
  --color-destructive-foreground: var(--color-surface);
  --color-muted: var(--color-gray-100);
  --color-muted-foreground: var(--color-gray-500);
  --color-accent: var(--color-gray-100);
  --color-accent-foreground: var(--color-gray-800);
  --color-border: var(--color-gray-200);
  --color-input: var(--color-gray-200);
  --color-ring: var(--color-gold);
  --color-background: var(--color-base);
  --color-popover: var(--color-surface);
  --color-popover-foreground: var(--color-gray-900);
  --color-card: var(--color-surface);
  --color-card-foreground: var(--color-gray-900);

  /* === STATUS COLORS === */
  --color-success: #10b981; /* emerald-500 */
  --color-info: #3b82f6; /* blue-500 */
  --color-warning: #f59e0b; /* amber-500 */

  /* === BORDER RADIUS === */
  --radius-xs: 0.125rem; /* 2px  - tiny badges */
  --radius-sm: 0.25rem; /* 4px  - small elements */
  --radius-md: 0.375rem; /* 6px  - default shadcn */
  --radius-lg: 0.5rem; /* 8px  */
  --radius-xl: 0.75rem; /* 12px - inputs, buttons */
  --radius-2xl: 1rem; /* 16px - cards, panels */
  --radius-3xl: 1.5rem; /* 24px - mobile header */
  --radius-full: 9999px; /* pills, avatars */

  /* === FONT FAMILY === */
  --font-sans: "DM Sans", system-ui, sans-serif;
  --font-display: "Fraunces", Georgia, serif;
  --font-mono: "JetBrains Mono", ui-monospace, monospace;

  /* === SIDEBAR === */
  --sidebar-width: 18rem; /* 288px = w-72 */
}

/* === BASE LAYER === */
body {
  @apply bg-base font-sans text-navy antialiased;
}
```

### 5.1 Color Usage Rules

| Context                               | Token to use                                                                                 |
| ------------------------------------- | -------------------------------------------------------------------------------------------- |
| Page background                       | `bg-base`                                                                                    |
| Card / panel background               | `bg-surface`                                                                                 |
| Primary CTA background                | `bg-navy`                                                                                    |
| Premium / positive CTA                | `bg-gold`                                                                                    |
| Destructive action                    | `bg-error`                                                                                   |
| Body text                             | `text-navy`                                                                                  |
| Muted / helper text                   | `text-gray-500`                                                                              |
| Eyebrow / meta labels                 | `text-gray-500`                                                                              |
| Mono identifiers                      | `text-gray-500` (or `text-gray-600`)                                                         |
| Card border                           | `border-gray-100`                                                                            |
| Input border                          | `border-gray-200`                                                                            |
| Focus ring                            | `ring-gold` (via `focus:ring-2 focus:ring-gold`)                                             |
| OverviewSidebar background            | `bg-navy`                                                                                    |
| OverviewSidebar text                  | `text-gray-300` (inactive), `text-surface` (active)                                          |
| Brand mark (shield icon + wordmark)   | `text-gold` — always, on every chrome (OverviewSidebar, PublicLayout, mobile NavbarOverview) |
| OverviewLayout desktop top area       | transparent over page background; no static title — each page renders its own `PageHeader`   |
| NavbarOverview search input (resting) | `bg-gray-50 text-navy placeholder-gray-400 border-gray-200 rounded-full`                     |
| NavbarOverview search input (focus)   | `bg-white ring-2 ring-gold border-transparent`                                               |

### 5.2 Role-Color Mapping

Used consistently in badges, pills, and icon blocks:

| Role                | Background     | Text             |
| ------------------- | -------------- | ---------------- |
| super_admin         | `bg-error/10`  | `text-error`     |
| admin               | `bg-navy/10`   | `text-navy`      |
| issuer              | `bg-gold/20`   | `text-navy`      |
| holder              | `bg-gray-100`  | `text-gray-600`  |
| active status       | `bg-green-100` | `text-green-700` |
| revoked / suspended | `bg-error/10`  | `text-error`     |

### 5.3 Tinted Shadow Convention

Signature demo pattern - use on brand-colored cards and primary buttons:

```
bg-gold  -> shadow-lg shadow-gold/20
bg-navy  -> shadow-md shadow-navy/20
bg-error -> shadow-lg shadow-error/20
```

**Floating surfaces (popovers, dropdowns, tooltips):** Use `shadow-xl shadow-navy/20`. The navy tint blends into dark backgrounds (where a gray-tinted shadow reads as a white smudge) and gives a subtle premium elevation on light backgrounds. Codified in `dropdown-menu.tsx` for `DropdownMenuContent` and `DropdownMenuSubContent`.

**Scroll-lock / layout-shift guard:** Radix overlays that mount `react-remove-scroll` (`Select`, `Dialog` — both default `modal={true}`; `@radix-ui/react-select@2.2.6` has no `modal` prop and always locks) set `body[data-scroll-locked] { overflow: hidden !important; ... }` on open. A CSS-only counter-rule (reserving the scrollbar gutter on `<html>`, zeroing the injected `margin-right`/`padding-right` on `body[data-scroll-locked]`) was tried and shipped once, but it never neutralized that `overflow: hidden`. Per CSS overflow-propagation rules, `<html>`'s own `overflow: visible` means the UA propagates `<body>`'s overflow to the viewport — so locking `<body>` collapses the _window's_ scrollbar regardless of what gutter `<html>` reserves, since the reservation lives on the wrong box. Fixed structurally instead: `OverviewLayout`'s shell is `h-dvh overflow-hidden` (same pattern as `SplitLayout`), so the window is never a scroll surface on authenticated routes — `#main` (`overflow-y-scroll scrollbar-gutter-stable`) is the only thing that scrolls. With no window scrollbar to collapse, Radix's body-lock is a no-op there. `@ui/dropdown-menu`'s `DropdownMenu` defaults `modal={false}` and never locks in the first place, so it was never part of the problem. The same fix was applied to `PublicLayout`, which mounts a Radix `Dialog` (`CredentialFileModal`, opened from `VerifyCredential`'s file-preview expand button on `/credentials/verify`) and was window-scrolling (`min-h-dvh`) — same latent shift, same structural fix: the root is now the scroll container itself (`h-dvh overflow-y-scroll scrollbar-gutter-stable`, `id="main"`) wrapping `NavbarPublic` + `<main>` + `CopyrightFooter` as one unit, matching the pre-fix visual behavior (navbar/footer were never sticky — they scrolled with the page) while eliminating the window as a second scroll surface. **Caveat:** this guard is scoped to `OverviewLayout` and `PublicLayout`. If a `Select`/`Dialog` is ever added to `SplitLayout` (already `h-dvh overflow-hidden`, so safe by default) or any new layout, verify it isn't window-scrolling before shipping — a window-scrolling layout plus any Radix `Select`/`Dialog` reproduces this exact bug.

---

## 6. Typography

The design commits to a **distinctive editorial pairing**: `Fraunces` (optical serif) for display + `DM Sans` (refined geometric sans) for body + `JetBrains Mono` for identifiers. All free via Google Fonts. This deliberately avoids the generic Inter/Roboto/system-ui pattern that signals "AI-generated startup".

### 6.0 Font Loading

Fonts are loaded via `@fontsource` npm packages using `@import` in `src/styles/index.css:1-12`:

```css
@import "@fontsource/dm-sans/400.css";
@import "@fontsource/dm-sans/500.css";
@import "@fontsource/dm-sans/600.css";
@import "@fontsource/dm-sans/700.css";
@import "@fontsource/fraunces/500.css";
@import "@fontsource/fraunces/600.css";
@import "@fontsource/fraunces/700.css";
@import "@fontsource/fraunces/800.css";
@import "@fontsource/fraunces/900.css";
@import "@fontsource/jetbrains-mono/400.css";
@import "@fontsource/jetbrains-mono/500.css";
@import "@fontsource/jetbrains-mono/600.css";
```

**Packages:**

- `@fontsource/dm-sans` (^5.2.8) — body text, 4 weights
- `@fontsource/fraunces` (^5.2.9) — headings, 5 weights
- `@fontsource/jetbrains-mono` (^5.2.8) — code/monospace, 3 weights

No Google Fonts CDN is used. Fonts are bundled with the app.

### 6.1 Type Scale

> For the design philosophy behind these choices, see Section 6.5 Visual Language Principles.

| Tier            | Tailwind                                                               | Use case                                        |
| --------------- | ---------------------------------------------------------------------- | ----------------------------------------------- |
| Hero            | `font-display text-4xl md:text-5xl font-extrabold tracking-tight`      | Auth landing, public verification page          |
| Page title (H2) | `font-display text-2xl md:text-3xl font-bold text-navy tracking-tight` | All page titles                                 |
| Section (H3)    | `font-display text-xl font-semibold text-navy tracking-tight`          | Card section headers                            |
| Card title      | `font-sans text-lg font-bold text-navy`                                | Credential cards, settings, CardTitle primitive |
| Stat value      | `font-display text-4xl font-extrabold tracking-tight`                  | Dashboard metrics                               |
| Body            | `font-sans text-sm text-navy`                                          | Default body                                    |
| Label           | `font-sans text-sm font-semibold text-gray-700`                        | Form labels                                     |
| Eyebrow         | `font-sans text-xs font-bold uppercase tracking-wider text-gray-500`   | Meta labels above values                        |
| Status pill     | `font-sans text-xs font-bold uppercase tracking-wider`                 | Badge text                                      |
| Helper          | `font-sans text-xs text-gray-500`                                      | Subtitles, muted helper text                    |
| Mono            | `font-mono text-xs`                                                    | Hashes, IDs, addresses                          |

**Pairing rules:**

- Display font (`font-display` / Fraunces) is reserved for **headings, hero text, and prominent stat values only**. Never use it for body, labels, or buttons.
- Body font (`font-sans` / DM Sans) carries everything else — buttons, inputs, labels, helper text, body paragraphs.
- Mono (`font-mono` / JetBrains Mono) is exclusively for cryptographic identifiers, addresses, and hash values.
- Never mix three fonts in one component cluster. Headings + body is the maximum pairing within a single card.

### 6.2 Heading Component

Wrap heading patterns in a `PageHeader` component to avoid drift:

```tsx
// shared/components/PageHeader.tsx
interface PageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  onBack?: () => void;
}

export function PageHeader({ title, description, action, onBack }: PageHeaderProps) {
  return (
    <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
      <div className="flex items-center gap-4">
        {onBack && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            aria-label="Go back"
            className="h-8 w-8 shrink-0 rounded-full text-gray-400 hover:bg-white hover:text-navy sm:h-10 sm:w-10"
          >
            <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
        )}
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight text-navy md:text-3xl">
            {title}
          </h2>
          {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
        </div>
      </div>
      {action && <div className="w-full sm:w-auto">{action}</div>}
    </div>
  );
}
```

**Responsive icon-button rule.** Shared headers that host icon-only controls (back, close, overflow) scale their hit-area with the viewport: `h-8 w-8` on mobile, `h-10 w-10` at `sm+`, with the inner icon stepping `w-4 → w-5`. This keeps touch targets proportional to the surrounding type ramp on phones and tablets, instead of dominating the header at fixed `h-10 w-10`. Apply the same pattern to other shared icon buttons placed alongside title text.

### 6.2.1 BackLink Component

`BackLink` (`shared/components/BackLink.tsx`) is the standalone "Back" affordance placed at the top of a page's content (above `PageHeader`). It is distinct from `PageHeader`'s `onBack` icon button — use `BackLink` when the page wants a labelled text link rather than an inline icon next to a title.

Behavior:

- Navigates to the previous in-app URL via `navigate(-1)` when prior history exists (`location.key !== "default"`).
- Falls back to `/overview` when authenticated, `/` when not, when there is no prior history (e.g. deep-linked or fresh tab).
- Renders an `ArrowLeft` icon + `t("common.back")` label in `text-gray-500 hover:text-navy` with a gold focus ring.

Placement:

- On `AdaptiveLayout` / `PublicLayout` / `OverviewLayout` pages (Help, About, Profile, Update Email), drop `<BackLink />` as the first child of the page's `space-y-6` wrapper — the page rhythm provides spacing, so no margin prop is needed.
- On `SplitLayout` pages (Login), content is vertically centered with no `<main>` padding, so pass an explicit margin: `<BackLink className="mb-6" />`.

### 6.3 Eyebrow Label Component

The demo uses this pattern 30+ times - extract it:

```tsx
// shared/components/EyebrowLabel.tsx
export function EyebrowLabel({
  children,
  tone = "muted",
}: {
  children: React.ReactNode;
  tone?: "muted" | "navy";
}) {
  const colorClass = tone === "navy" ? "text-navy" : "text-gray-500";
  return (
    <dt className={`text-xs font-bold ${colorClass} mb-1 tracking-wider uppercase`}>{children}</dt>
  );
}
```

### 6.4 Mono Identifier Component

```tsx
// shared/components/MonoId.tsx
export function MonoId({
  value,
  mode = "truncate",
  className,
}: {
  value: string;
  mode?: "truncate" | "address" | "full";
  className?: string;
}) {
  const display =
    mode === "full"
      ? value
      : mode === "address"
        ? `${value.slice(0, 10)}...${value.slice(-4)}`
        : `${value.slice(0, 16)}...`;
  return <span className={`font-mono text-xs text-gray-500 ${className ?? ""}`}>{display}</span>;
}
```

### 6.5 Visual Language Principles

The design system commits to a specific aesthetic position. These principles guard against drift toward generic AI-generated UI.

#### Aesthetic Position

**Confident restraint with editorial gravitas.** The reference points are Linear, Stripe, Mercury, and Coinbase Institutional - premium SaaS dashboards that feel authoritative without being austere. The blockchain layer adds typographic weight (mono identifiers, generous numerals) and material seriousness (tinted shadows, deep navy). NOT maximalist. NOT generic startup. NOT skeuomorphic.

#### Signature Moves to Preserve

These are the things that make CredChain visually distinct. Touch them only with intent.

1. **Navy + gold pairing** - Never substitute purple gradients, blue-to-cyan washes, or rainbow accents. The palette is the brand. The brand mark cluster (shield icon + "CredChain" wordmark) always renders in `text-gold` regardless of background — `OverviewSidebar`, `PublicLayout` header (`NavbarPublic`), and mobile `NavbarOverview` shield all use `text-gold`. Never `text-surface` for the wordmark.
2. **Tinted colored shadows** - `shadow-md shadow-navy/20`, `shadow-lg shadow-gold/20`, `shadow-error/20` under brand-colored elements. This is the signature material treatment.
3. **Single decorative blob per hero area** - One soft radial gradient, never multiple competing blobs. Restraint is the move.
4. **Mono-font identifiers** - Every hash, address, and ID renders in `font-mono`. This is the blockchain visual cue. Never sans-serif a hash.
5. **Eyebrow labels** - `text-xs font-bold uppercase tracking-wider text-gray-500` precedes data values. Editorial typographic device.
6. **Generous rounded-2xl on cards** - Default to `rounded-2xl` (16px) for content cards. Avoid `rounded-md` (6px) on anything larger than a button - it reads as default Bootstrap.
7. **Display serif for headings** - Fraunces optical-size headings. Sans-serif headings would lose the editorial weight.
8. **Asymmetric stat cards on dashboard** - One gold card sits among neutral cards. The chromatic anchor draws the eye. Never four identical cards.

**Overview credential statistics:** One Credentials panel contains compact, equal-span cards ordered Active, Total, Pending review, Rejected, Expired, Revoked. Holders see these six cards in `grid-cols-2 lg:grid-cols-3`. Issuer/Admin/Super Admin also see Extraction pending and Extraction failed at the end, using `grid-cols-2 lg:grid-cols-4` for eight cards. Loading skeletons match each role's card count and columns. Both layouts use `gap-3 sm:gap-4`. Active alone uses gold; the others stay neutral. Keep existing compact padding and typography, natural label wrapping, native filter links, and gold keyboard-focus rings. No subgroup headings, dividers, or extra panels.

#### Anti-Patterns (Forbidden)

These signal AI-generated UI and are explicitly prohibited:

1. **Purple-to-blue gradients on white** - The most overused AI cliche.
2. **Glassmorphism / frosted-glass everywhere** - Acceptable only as a single intentional moment, never as a default surface treatment.
3. **Symmetric perfect-grid layouts** - Four identical metric cards in a row signals a template, not a designed interface.
4. **Default `shadow-md` on every card** - Use `shadow-sm` for resting cards. Reserve heavier shadows for elevation moments.
5. **Skeuomorphic blockchain imagery** - No 3D chain links, no gear icons for settings, no padlock for security. Use type and color.
6. **Bootstrap-style alerts and badges** - `bg-yellow-100 text-yellow-800 border-yellow-300` is the default-Bootstrap fingerprint. Use the role-color mapping in Section 5.2 instead.
7. **Default Tailwind colors for brand-bearing elements** - Buttons, headers, navigation must use `navy` or `gold`. `bg-blue-600` is forbidden.
8. **System-ui fonts** - Settled in 6.0. Always Fraunces + DM Sans + JetBrains Mono.
9. **Rounded-full on rectangular cards** - Pills are rounded-full. Cards are rounded-2xl. Don't blur the line.
10. **Generic stock illustrations** - No isometric people, no abstract crypto art, no Storyset/unDraw imagery.

#### Density Philosophy

Density choice depends on screen purpose:

| Surface             | Density             | Treatment                                                  |
| ------------------- | ------------------- | ---------------------------------------------------------- |
| Auth / hero         | Generous whitespace | `py-12` to `py-20`, large display type, single blob        |
| Public verification | Medium              | Editorial layout, focus on the claim being verified        |
| Dashboard overview  | Medium-high         | Stat cards at `h-40`, controlled grid, room to breathe     |
| List / table views  | High                | `py-4` rows, `text-sm`, scannable density                  |
| Form views          | Medium              | `py-3` inputs, `space-y-6` between sections, never cramped |
| Detail views        | Medium              | Two-column on desktop, eyebrow + value pattern             |

**Rule:** Never let a list view feel like a hero, and never let a hero feel like a database admin tool.

**Notifications:** Use compact neutral `py-4` rows with a plain muted icon, a normal-weight sentence (only the credential name is bold), and a muted timestamp beneath. Keep the separate mark-as-read action vertically centered at the right on every breakpoint: a 44×44 ghost icon button below `sm`, then icon plus a single-line label at `sm` and wider. Give it a localized accessible label and title; never wrap its visible label or place it on a second action row. No status badges, colored icon tiles, unread dots, credential numbers, or row shadows. Rejected and revoked notifications share `FileX2`. Show localized relative time below seven days; at seven days and older show localized date and time, with the full timestamp available on hover. Place `BackLink` above `PageHeader`. Row activation opens `/credentials?search=<credential ID>`; marking read never navigates.

**Review summaries and reference navigation:** Keep the credential queue and three reference queues in one neutral card with matching bold `text-sm` titles, muted descriptions, dividers, and outlined 44px actions. Summary rows have no leading status icons or reserved icon column; counts and text communicate state. Inbox event icons remain unchanged. Review links share one trailing navigation icon. Preserve independent loading, unavailable/retry, zero, and positive-count states. Changed review actions and the References trigger use navy focus rings for contrast. The credentials-page References dropdown shows a right-aligned gold live pending-count badge per resource for Issuer+ only; holders retain plain links. Display successful zero as `0`, loading/unavailable as an ellipsis with distinct localized accessible labels. Counts reuse the shared account/role-scoped pending queries, never unread notification totals.

#### Asymmetry and Grid-Breaking

The demo's dashboard splits 2:1 (`lg:col-span-2`) and inserts a single gold card among three neutrals. Continue this pattern - **deliberate imbalance signals design intent**. Grid-breaking moves to use sparingly:

- One card in a metric row carries the brand color (gold or navy)
- A decorative blob extends slightly past a card edge (`-translate-y-12 translate-x-12`)
- Hero areas use vertical stacking on the visible side, horizontal on the affordance side
- Empty states center their content even when the surrounding layout is left-aligned

Do not break the grid on data tables, list rows, or form fields - density flows on those surfaces.

---

## 7. Component Recipes

The nine signature patterns from the demo, formalized as reusable components or `cn()` recipes.

### 7.1 cn() Helper (foundation)

```ts
// shared/lib/cn.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

All conditional/composed classNames go through `cn()`. Never concatenate Tailwind classes with template strings.

### 7.2 Card Recipe

The foundational container for content panels:

```
bg-surface rounded-2xl shadow-sm border border-gray-100
```

Codify in shadcn `card.tsx`:

```tsx
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-2xl border border-gray-100 bg-surface shadow-sm", className)}
      {...props}
    />
  );
}
```

### 7.3 Primary CTA (navy)

```
including shadow tint and hover translate on trailing icon
```

shadcn `button.tsx` variant `primary`:

```tsx
const buttonVariants = cva(
  "inline-flex justify-center items-center font-bold transition-all rounded-xl focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none group",
  {
    variants: {
      variant: {
        primary:
          "bg-navy text-surface shadow-md shadow-navy/20 hover:bg-navy/90 focus-visible:ring-gold",
        gold: "bg-gold text-navy shadow-md shadow-gold/20 hover:bg-gold/90 focus-visible:ring-gold",
        destructive:
          "bg-error text-surface shadow-md shadow-error/20 hover:bg-error/90 focus-visible:ring-error",
        outline:
          "border border-gray-200 bg-surface text-navy hover:bg-gray-50 focus-visible:ring-gold",
        ghost: "text-navy hover:bg-gray-100 focus-visible:ring-gold",
        dashed:
          "border-2 border-dashed border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 hover:border-gray-300 focus-visible:ring-gold",
      },
      size: {
        sm: "h-9 px-3 text-xs",
        md: "h-11 px-4 text-sm",
        lg: "h-12 px-6 text-sm",
        icon: "h-11 w-11 p-2 [&>svg]:w-5 [&>svg]:h-5",
        "icon-mobile": "h-12 w-12 p-3 [&>svg]:w-6 [&>svg]:h-6",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);
```

**Height scale.** Height is an explicit token, never a by-product of padding
and line-height. The base class list already centres the label, so a fixed
height needs nothing else at the call site.

| Size | Height        | Pairs with             |
| ---- | ------------- | ---------------------- |
| `sm` | `h-9` (36px)  | `Input size="compact"` |
| `md` | `h-11` (44px) | `Input size="default"` |
| `lg` | `h-12` (48px) | — CTA only             |

Pair a button with the input beside it by size, and the row lines up by
construction. **Never hand-tune a height at a call site** — `items-stretch`,
`h-full` on an input, and `sm:mt-6` are all symptoms of a mismatched pair and
each has drifted at least once.

Usage with trailing icon hover-slide:

```tsx
<Button>
  Sign in to Dashboard
  <ArrowRight className="ml-2 h-4 w-4 transform transition-transform group-hover:translate-x-1" />
</Button>
```

### 7.4 Icon-Prefixed Input

Build on top of shadcn `input.tsx` with a `leadingIcon` prop:

The native `size` attribute (a character-width hint, unused here) is omitted so
the prop can carry the height token from §7.3 instead.

```tsx
interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  leadingIcon?: LucideIcon;
  trailingAction?: React.ReactNode;
  size?: "compact" | "default";
}

const inputSizes = {
  compact: "h-9 text-xs", // pairs with Button size="sm"
  default: "h-11 text-sm", // pairs with Button size="md"
} as const;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ leadingIcon: Icon, trailingAction, className, size = "default", ...props }, ref) => (
    <div className="relative">
      {Icon && (
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          <Icon className="h-5 w-5 text-gray-400" />
        </div>
      )}
      <input
        ref={ref}
        className={cn(
          "block w-full rounded-xl border border-gray-200 pr-3 shadow-sm",
          "bg-gray-50 text-navy placeholder-gray-400",
          inputSizes[size],
          "focus:border-transparent focus:bg-white focus:ring-2 focus:ring-gold focus:outline-none",
          "transition-all",
          Icon ? "pl-10" : "pl-4",
          trailingAction ? "pr-10" : "",
          className,
        )}
        {...props}
      />
      {trailingAction && (
        <div className="absolute inset-y-0 right-0 flex items-center pr-3">{trailingAction}</div>
      )}
    </div>
  ),
);
```

### 7.5 Status Pill

This design recipe is retained as a requirement, not a current source listing. `StatusPill.tsx` is absent; `UserStatusBadge` and `CredentialStatusBadge` currently use `@ui/badge`. The recipe and implementation differ and need a design decision before reconciliation.

```tsx
// Design recipe: shared/components/StatusPill.tsx
const toneClasses = {
  navy: "bg-navy/10 text-navy",
  gold: "bg-gold/20 text-navy",
  error: "bg-error/10 text-error",
  green: "bg-green-100 text-green-700",
  gray: "bg-gray-100 text-gray-600",
};

export function StatusPill({
  tone,
  children,
  icon: Icon,
}: {
  tone: keyof typeof toneClasses;
  children: React.ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-bold tracking-wider uppercase",
        toneClasses[tone],
      )}
    >
      {Icon && <Icon className="mr-1 h-3 w-3" />}
      {children}
    </span>
  );
}
```

### 7.6 Decorative Blob

```tsx
// shared/components/DecorBlob.tsx
export function DecorBlob({
  tone = "gold",
  position = "top-right",
  size = "lg",
}: {
  tone?: "gold" | "navy" | "blue" | "error";
  position?: "top-right" | "top-left" | "bottom-right" | "bottom-left";
  size?: "md" | "lg" | "xl";
}) {
  const toneClass = {
    gold: "bg-gold/10",
    navy: "bg-navy/10",
    blue: "bg-blue-500/10",
    error: "bg-error/10",
  }[tone];

  const positionClass = {
    "top-right": "top-0 right-0 -translate-y-12 translate-x-12",
    "top-left": "top-0 left-0 -translate-y-12 -translate-x-12",
    "bottom-right": "bottom-0 right-0 translate-y-24 translate-x-12",
    "bottom-left": "bottom-0 left-0 translate-y-24 -translate-x-12",
  }[position];

  const sizeClass = {
    md: "w-32 h-32 blur-2xl",
    lg: "w-64 h-64 blur-3xl",
    xl: "w-96 h-96 blur-3xl",
  }[size];

  return (
    <div
      className={cn(
        "pointer-events-none absolute rounded-full",
        toneClass,
        positionClass,
        sizeClass,
      )}
    />
  );
}
```

### 7.7 Tinted Icon Block

Used in dashboard activity feeds, credential cards, role indicators:

```tsx
export function TintedIcon({
  icon: Icon,
  tone = "navy",
  size = "md",
}: {
  icon: LucideIcon;
  tone?: "navy" | "gold" | "error" | "green";
  size?: "sm" | "md" | "lg";
}) {
  const toneMap = {
    navy: "bg-navy/5 text-navy",
    gold: "bg-gold/10 text-navy",
    error: "bg-error/10 text-error",
    green: "bg-green-100 text-green-600",
  };
  const sizeMap = {
    sm: "p-2 rounded-lg [&>svg]:w-4 [&>svg]:h-4",
    md: "p-3 rounded-xl [&>svg]:w-6 [&>svg]:h-6",
    lg: "h-12 w-12 rounded-xl flex items-center justify-center [&>svg]:w-6 [&>svg]:h-6",
  };
  return (
    <div className={cn("inline-flex items-center justify-center", toneMap[tone], sizeMap[size])}>
      <Icon />
    </div>
  );
}
```

### 7.8 Empty State

```tsx
// shared/components/EmptyState.tsx
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-surface p-12 text-center shadow-sm">
      <Icon className="mx-auto mb-4 h-12 w-12 text-gray-300" />
      <h3 className="mb-2 text-lg font-bold text-navy">{title}</h3>
      {description && <p className="mb-6 text-sm text-gray-500">{description}</p>}
      {action}
    </div>
  );
}
```

### 7.9 Confirm Dialog (replaces window.confirm)

The demo uses `window.confirm` which is jarring on mobile and can't be styled. Production uses shadcn `dialog` + a `useConfirm` hook in `@ui/confirm-dialog`:

```tsx
// shadcn/ui/confirm-dialog.tsx — useConfirm()
export function useConfirm() {
  const [state, setState] = useState<{
    open: boolean;
    resolve?: (v: boolean) => void;
    opts?: ConfirmOptions;
  }>({ open: false });

  const confirm = (opts: ConfirmOptions) =>
    new Promise<boolean>((resolve) => setState({ open: true, resolve, opts }));

  const dialog = (
    <Dialog open={state.open} onOpenChange={(o) => !o && state.resolve?.(false)}>
      {/* renders state.opts.title / description / confirmLabel / tone */}
    </Dialog>
  );

  return { confirm, dialog };
}
```

Usage — note `dialog` (lowercase) must be rendered alongside the trigger:

```tsx
const { confirm, dialog } = useConfirm();
const handleDelete = async () => {
  const ok = await confirm({
    title: t("user.delete.confirm.title"),
    description: t("user.delete.confirm.body"),
    confirmLabel: t("user.delete.confirm.action"),
    cancelLabel: t("common.cancel"),
    tone: "destructive",
  });
  if (ok) deleteUser.mutate(id);
};

return (
  <>
    <Button onClick={handleDelete}>Delete</Button>
    {dialog}
  </>
);
```

### 7.10 FormField (shared form control wrapper)

Wraps a `<Label>` + children + optional error/hint/optional tag. Current callers include UserCreateRow, CredentialIssueRow, CredentialSubmitRow, and credential review modals. For explicit accessibility associations, pass `htmlFor` matching the control's `id`, and `errorId` matching its conditional `aria-describedby` (used by inline reference rejection):

```tsx
// shared/components/ui/form-field.tsx
export function FormField({
  label,
  htmlFor,
  errorId,
  hint,
  error,
  optional,
  children,
}: {
  label: string;
  htmlFor?: string;
  errorId?: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-1">
      <Label htmlFor={htmlFor}>
        {label}
        {optional && <span className="ml-1 font-normal text-gray-400">{t("common.optional")}</span>}
      </Label>
      {children}
      {error ? (
        <p id={errorId} className="mt-1 text-xs text-error" role="alert">
          {t(error)}
        </p>
      ) : hint ? (
        <p className="mt-1 text-xs text-gray-400">{hint}</p>
      ) : null}
    </div>
  );
}
```

### 7.11 DetailRow (dt/dd pair for read-only detail views)

Renders the shared `<dt>`/`<dd>` pattern used by UserDetail, UserSelfProfile, CredentialSystemFacts, and VerificationResult. Supports optional icon and error tone:

```tsx
// shared/components/DetailRow.tsx
export function DetailRow({
  label,
  value,
  icon: Icon,
  tone = "default",
  className,
}: {
  label: string;
  value: React.ReactNode;
  icon?: LucideIcon;
  tone?: "default" | "error";
  className?: string;
}) {
  return (
    <div className={className}>
      <dt
        className={cn(
          "mb-1 flex items-center gap-1.5 text-xs font-bold tracking-wider uppercase",
          tone === "error" ? "text-error" : "text-gray-500",
        )}
      >
        {Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
        {label}
      </dt>
      <dd className={cn("text-sm", tone === "error" ? "text-error" : "text-navy")}>{value}</dd>
    </div>
  );
}
```

---

### 7.12 UnitPicker (hierarchical select inside a form grid)

`shared/components/UnitPicker` selects an organisational unit from an indented tree. Use it anywhere a unit is chosen — never a flat `<Select>` over `flattenUnitTree`, which loses the hierarchy the tree exists to convey.

```tsx
<FormField label={t("user.field.unit")} error={errors?.unit_id?.message} optional>
  <UnitPicker
    value={unitId}
    onChange={(id) => form.setValue("unit_id", id, { shouldValidate: true })}
    label={t("user.field.unit")}
    placeholder={t("userCreate.field.unit.placeholder")}
    error={errors?.unit_id?.message}
  />
</FormField>
```

`value` accepts any falsy for not-set and `onChange` always emits `undefined` for it, so callers adapt at the edge (`v ?? null` for a nullable DTO field, `v ?? ""` for a URL param) rather than the component carrying a sentinel-config prop.

Three details are load-bearing:

- **Trigger is a plain `<button type="button">` carrying the shared form-picker trigger classes** (`min-h-11 … px-4 py-2.5`, `rounded-xl border border-gray-200 bg-gray-50 text-sm text-navy shadow-sm`, chevron rotating 180° while open), so it is pixel-identical to the `<Select>` fields beside it in the same form grid and to the credential-page pickers. `type="button"` matters: inside a `<form>` the default `submit` would post on every open. Keep it a `<button>` — `UnitPicker.test.tsx` reaches it via `getByRole("button", { name: "Unit" })`.
- **Content uses `w-(--radix-dropdown-menu-trigger-width)`, never a fixed width.** Radix sets that custom property on the content element. A fixed `w-56` (correct for a filter pill, which sits outside any grid) overflows or under-fills a form cell that is full-width at `grid-cols-1`, half at `md:grid-cols-2`, and a third at `lg:grid-cols-3`. Tracking trigger width is what keeps the panel correct at every breakpoint without a media query.
- **The search input appears only past `SEARCH_THRESHOLD = 8` units**, and stops keydown propagation so typing does not reach the menu's type-ahead. A search box over five rows is chrome, not help.

Indentation is `paddingLeft: ${0.5 + depth * 0.85}rem` and the active row carries the gold `<Check className="h-4 w-4 text-gold" />` — the same treatment as `HolderUnitFilterMenu`, which is deliberately **not** built on `UnitPicker`: it needs a `FilterTrigger` pill and `""` semantics, so unifying would mean a `renderTrigger` prop for zero visible change.

### 7.13 SearchableCreateSelect / HolderSearchDropdown (multi-value + async search)

`shared/components/SearchableCreateSelect` and `shared/components/HolderSearchDropdown` are `UnitPicker`'s siblings for the cases it doesn't cover: a server-searched (not client-filtered) option list, an inline "create" row, and — for `SearchableCreateSelect` in `multiple` mode — more than one selected value at once. All four dropdowns in the app (`UnitPicker`, `SearchableCreateSelect`, `HolderSearchDropdown`, and the filter menus under `feature/*/components/*FilterMenu.tsx`) now share one mechanism: `@ui/dropdown-menu`, never a `Dialog`. A modal is the wrong primitive for a form-field dropdown — it dims and scroll-locks the page for what should be an anchored panel.

Two details go beyond `UnitPicker` because of the multi-value case:

- **The trigger is a `div`, not a `button`.** `SearchableCreateSelect`'s selected values render as removable chips, each chip's "x" is its own `<button>`, and a `<button>` cannot contain a `<button>` — nesting them is invalid HTML and some browsers drop the inner element entirely. The fix is `DropdownMenuTrigger asChild` around a `div role="combobox" tabIndex={0}`, which keeps every keyboard affordance Radix gives a real trigger (Enter/Space/ArrowDown open it, Escape closes it) and keeps existing `getByRole("combobox")` test queries working.
- **Multi-select rows need `onSelect={(e) => e.preventDefault()}`.** Radix's `DropdownMenuItem` closes the menu on select by default — correct for a single-value picker, wrong for toggling competencies, where the user expects to pick several in one visit. The same guard already existed for the load-more row in `CredentialFilterMenu.tsx` for the same reason (loading the next page must not close the menu); multi-select rows are the second case of the identical problem.

Selected values in `multiple` mode render as `Badge tone="gold"` chips with a trailing lucide `X` button (`aria-label={t("cred.submit.removeSelection", { name })}`), each calling `e.stopPropagation()` before removing its id — without the stop, the click bubbles to the trigger `div` and reopens the panel it just closed. Single-select mode keeps a plain text label; there's only one value, so a comma-joined list or a chip would be over-built for it.

**Unavailable selections.** When previously selected references are withheld by the backend (e.g., approved inactive references for Holder users) and by-ID lookups resolve to empty:

- In `SearchableCreateSelect` single-select mode: renders localized `t("cred.submit.unavailable")`, keeps the remove button accessible (`aria-label={t("cred.submit.removeSelection", { name: t("cred.submit.unavailable") })}`), and clears via `deselect(id)` without silently clearing form state behind the scenes.
- In `SearchableCreateSelect` multi-select mode: maps over `selectedIds` rather than resolved rows only. Unresolved rows render as `Badge tone="gray"` with `t("cred.submit.unavailable")` and a removable `X` button calling `deselect(id)`.
- In `CredentialFilterMenu`: when a selected reference cannot be resolved in loaded rows or by-ID lookup, the trigger renders an explicit status (`t("cred.filter.unavailable")` or `t("cred.filter.loading")`) instead of masquerading as "All", while preserving the option to reset to All.

**A gold chip in a form field means exactly one thing: this field holds several values.** Only Competencies qualifies today. A single-value picker that draws its selection as a chip (as Type and Organization briefly did) makes the reader hunt for a second value that cannot exist, and makes two identical controls in the same grid look like different kinds of field. Single value → plain text, every time.

**Exception — provisional state.** A single-value field whose content is _proposed rather than confirmed_ (`SearchableCreateSelect`'s `mode="propose"`, holding a free-text `proposed` name instead of a resolved id) carries an inline marker, never a chip: a gray `CircleDashed` glyph before the name and `text-xs text-gray-400` status text (`pending review`) after it. The chip rule is unchanged — chips still mean multi-value — and gold still means confirmed, so a proposal is never gold. The same marker (glyph + text) appears on a proposed name's `Badge` in multi-value mode, so single and multi read identically for the same state.

`SearchableCreateSelect`'s create/propose row is a **pinned panel footer**, not a list item — a `border-t` div sibling of the scrolling option list, always visible regardless of scroll position or list length. It is gated on an **exact case-insensitive match** against the loaded rows, not on result count: a partial match (typing `AK` against a loaded `Akuntansi`) never hides it, since the user may still mean the literal typed string.

Form pickers and **filter pills are deliberately two looks, not a drift to be unified.** A form picker is a full-width grid cell that holds a value the user is about to submit; a `FilterTrigger` is a small `variant="outline" size="sm"` pill (`rounded-xl h-9`) in a toolbar whose gold state means "a filter is applied to the list below". Same panel, different trigger — keep it that way.

`HolderSearchDropdown` is single-select only (one holder per credential) and stays on plain text for the same YAGNI reason, but is built on the identical `DropdownMenu` shell — search input with `onKeyDown` stopPropagation, gold `Check` on the selected row — so it no longer diverges from the other three as the one hand-rolled `absolute`-div dropdown with no keyboard support.

#### 7.13.1 Credential list sorting & URL contract

Credential list sorting on `/credentials` (`CredentialList.tsx`) and the credentials table on `/users/:id` (`UserDetail.tsx`) is driven by `@shared/lib/credentialSort.ts` and `CredentialSortMenu.tsx`:

- **Canonical sort keys:**
  - Newest: `-lifecycle_at` (default; canonical URL omits `sort` / `credential_sort`)
  - Oldest: `lifecycle_at` (URL: `?sort=lifecycle_at` or `?credential_sort=lifecycle_at`)
  - Name A–Z: `name`
  - Name Z–A: `-name`
- **Status-independent:** Changing review status or user credential status filters preserves the selected sorting direction. Sort keys never dynamically swap to `revoked_at` or `expires_at`.
- **Legacy URL normalization:** Legacy URL parameters (`±issued_at`, `±revoked_at`, `±expires_at`, and uncanonical aliases) are normalized via `normalizeCredentialSortParam`:
  - `±issued_at`, `±revoked_at`, `±expires_at` in descending form map to `-lifecycle_at` and the non-canonical parameter is removed with `replace: true`.
  - Ascending forms (`issued_at`, `+issued_at`, etc.) map to canonical `sort=lifecycle_at` (or `credential_sort=lifecycle_at`).
  - Unsupported values fall back to `-lifecycle_at`.
- **Backend mapping:** The backend GORM repository maps `lifecycle_at` to `COALESCE(credentials.revoked_at, credentials.rejected_at, credentials.activated_at, credentials.created_at)` with `credentials.id ASC` tiebreaker.

---

### 7.14 Reference management tables

Credential Types, Issuer Organizations, and Competencies share `ReferenceToolbar`, `ReferenceTable`, and `ReferenceName`.

- No Status column or approved badges. Pending names carry a static gray 14px `CircleDashed` before the name, with localized screen-reader text and a native title. Pending names remain readable even when inactive.
- Rejected names and reasons use `text-error`, without strikethrough or another icon; hidden localized status text keeps rejection accessible without color. Only approved inactive names use muted strikethrough.
- Review actions use `Button variant="ghost" size="icon"` (44×44px), green `Check` / red `X`, localized `aria-label` and `title`. Approve opens the existing primary-tone `ConfirmDialog` with the reference name; only confirmation sends the approval request. Cancel sends none. Account, role, search, filter, or target eligibility changes dismiss stale approval; competing row mutations/dialogs are locked during confirmation or submission.
- Reject keeps the name left and `ReferenceRejectForm` right on roomy screens, using one spanning table cell via optional `renderRowContent`; no modal or additional row. The compact single-line input has an associated visually hidden label, is required after trimming, and permits at most 1,000 characters. Small destructive Reject and ghost Cancel controls sit beside the input; errors appear beneath the editor. On narrow screens the editor stacks beneath the name and actions wrap. Enter submits; Escape cancels unless submitting. Pending disables form actions; failures retain the draft with an inline error. Only one editor opens at a time; account, role, search, filter and missing-target changes clear stale editors. Existing review permissions remain unchanged.
- Toolbar uses vertical `space-y-4`: search first, visible status buttons second, existing create/request controls third. Status buttons use a localized `role="group"`, native `type="button"`, and `aria-pressed`; selected uses `primary`, others use `outline`. Use `size="sm"` for status and count-retry buttons (36px height, `px-3 text-xs`, shared `rounded-xl`), matching credentials-page `FilterTrigger` sizing. Keep navy keyboard focus and `flex-wrap gap-2` so labels remain readable on narrow screens. Keep option order Active, All, Approved, Inactive (Issuer+), Pending review, Rejected. The gold pending-count badge remains Issuer+ only and distinguishes zero, loading, error, and retry. Search stays 44px; existing create/request controls keep their compact 36px sizing and expand below the filters. Expanded create/request inputs match Search width: full available width below `md`, capped at 28rem from `md`. Action buttons sit beside the input when space permits and wrap below without shrinking it. Reference and credential pending-review labels match: “Pending review” / “Menunggu tinjauan”. This toolbar recipe does not alter tables or the credentials-page combined review/extraction dropdown.
- Reference status lives in URL `status`: `all`, `approved`, `inactive`, `pending`, `rejected`; default `active` is omitted. Missing/invalid or role-disallowed values resolve synchronously to Active; explicit Active/invalid/disallowed parameters are removed with replace. User selections push history, retaining search and unrelated parameters. Search replaces URL immediately while only API search is debounced, so reload, links and Back/Forward restore controls without stale debounce writes.
- All three lists default to Active (`status=approved` and `active=true`). All omits lifecycle/activation filters; Approved includes both activation states. Inactive is an Issuer+ filter, not a lifecycle status: request `status=approved` and `active=false` together. Holder role changes immediately display/query Active instead of retaining hidden Inactive selection. Holders can select All, Pending Review, or Rejected to track their own requests; the default filter does not change backend visibility.
- Reference queries distinguish omitted/true/false active values and scope caches by account and role. Infinite-query pages refetch together after mutations so rows that leave a filter disappear even after Load More.
- **Holder reference visibility:** Holder collections omit approved inactive references across all three reference endpoints (`/api/credential-types`, `/api/issuer-organizations`, `/api/competencies`). Holders receive approved active items plus their own pending or rejected proposals; approved inactive items (even if self-submitted) and other users' proposals remain hidden. Historical credentials retain inactive names through embedded relations.

---

### 7.15 Verification result and shared Credential Details modal

`/credentials/verify` keeps a compact `max-w-3xl` result: outcome and applicable lifecycle warning, Text Similarity when returned by text comparison, then six fields in order: Verification method, Credential status, Credential name, Credential number, Credential type and Issuer organization. Use shared `DetailRow` label/value hierarchy with CSS-uppercase labels, a two-column desktop grid and one mobile column; translations stay sentence case. Missing name/number uses Not set; missing linked type/organization display names use Unavailable, never raw IDs or an assertion that the relation was never set. Type and organization names come from the eleven-field public summary for anonymous and authenticated visitors; qualified exact details remain nineteen fields. Candidate attribution precedes the fields: they describe the compared credential, not confirmed details of the uploaded file. No credential means no empty credential grid. Similarity uses only finite numeric scores in [0,1] for text-comparison outcomes; format as a percentage with at most one fractional digit. Even 100% text similarity does not establish authenticity or prove alteration. Never invent an exact-match score. Blockchain service unavailability is an operational error with Retry, not an integrity verdict. Verification-owned EN/ID copy uses credential/kredensial, uploaded file/berkas unggahan, registered file/berkas terdaftar and credential data on the blockchain/data kredensial di blockchain, not vague record/catatan substitutes. Keep issuer account distinct from issuer organization.

Keep `CredentialFileInput` in the same Card before, during and after verification: existing thumbnail, filename, size/MIME, Eye preview and X remove. No separate completed filename bar or text Preview/Change controls. Escape returns preview focus to Eye; removal/reset clears the result and focuses the restored upload dropzone. Validate replacements before discarding the accepted file/result and ignore late responses for removed/replaced uploads.

Use one permission-aware action: **View credential details** for confirmed live exact evidence; **View compared credential** for a text-comparison candidate with existing private access. Anonymous and unrelated Holders open the public snapshot from the same verification response. Own Holders and Issuer+ open the existing private modal. A denied private lookup preserves exact public fallback. AI 100%, cached verdicts and token presence alone grant no public details. Keep concise, contextual limits on the result, not inside the modal: always state that recipient identity and direct issuance confirmation with the issuer organization are outside this check; add current organization/type-name provenance when a summary exists; add current Holder-account provenance only when qualified public details contain Holder information. This yields one, two or three relevant bullets, not a fixed count or different verification strictness. Do not repeat organization/type provenance in the Holder notice.

Both adapters reuse `CredentialDetailLayout`, `buildCredentialReadFields`, `UserContactBlock`, `CredentialFilePreview` and `CredentialSystemFacts`. Preserve original `max-w-5xl`, padding, typography, badges, copy controls and responsive grid. Body order: file panel; applicable protected rejection/revocation notices; Details; Holder and authorized lifecycle parties; always-visible original technical/lifecycle footer. Read-field order: Name, Number, Credential Type, Issuer Organization, Issued Date, Expiry Date, Competencies, Additional Information. No verification strip, separate lifecycle section or collapsed technical disclosure. Pending-only private editing/save/cancel stays in the private adapter.

Public details require explicit live evidence, an exact-compatible verdict and matching summary/details IDs. Render the explicit public Holder DTO without profile links or protected user/unit queries; missing Holder stays unavailable, not an invented active account. Competencies and credential Additional Information are intentionally public only after that gate. Other lifecycle parties, reasons and extraction controls stay private. Holder fields and reference names are current account/database data, not immutable issuance-time identity or independent issuer attestation.

The public file panel previews the uploaded `File` with original filename/size and an Uploaded file label; omit Download and never request protected stored bytes. The private panel uses the credential's own protected stored file and existing download policy, especially for nonmatching text candidates. Share thumbnail/view/object-URL cleanup code. Escape closes nested preview first and returns focus to View; closing parent returns focus to the details action. Accepted replacement/reset/new verification closes dialogs and invalidates stale results. Session identity/role changes close details; protected record/file cache keys include account and role.

---

## 8. Layout System

### 8.1 Three Layout Shells

| Layout           | Used by                   | Pattern                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ---------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PublicLayout`   | `/credentials/verify` | Navy header (`min-h-[64px]` flat, no `sm:` breakpoint) with **gold brand mark** + gold underline, white card body, `<CopyrightFooter />` strip (transparent background; see §8.1.1). Container is `h-dvh overflow-y-scroll scrollbar-gutter-stable` (NOT `min-h-dvh`, NOT `min-h-screen`) with `id="main"`; the root itself is the sole scroll surface (window never scrolls), keeping the footer anchored to the _visible_ viewport on mobile the same way `min-h-dvh` did (`h-dvh` is also a dynamic-viewport unit, so mobile chrome collapse/expand is still handled) while also closing the `VerifyCredential` → `CredentialFileModal` Radix `Dialog` scroll-lock shift (see §5.3). `NavbarPublic`/`<main>`/`CopyrightFooter` all scroll together inside this one container, same as before. `<main>` has `mx-auto max-w-7xl` so the public content area (About/Help at `max-w-4xl`, VerifyCredential at `max-w-3xl`) centers within a 1280px band that aligns with the `NavbarPublic` width. `<main>` padding `px-4 pt-4 pb-12 sm:px-8` mirrors `OverviewLayout` so unauthed Help/About sit identically to their authed counterparts.                                                                                                                                                                                                                        |
| `SplitLayout`    | `/` (Landing), `/login`   | Fixed 100dvh — no scrollbars. Outer container and right panel both use `h-dvh overflow-hidden`. Mobile: 33/67 vertical split — navy brand band `h-[33dvh]` with `flex items-center justify-center` to center brand content; white content area `flex-1` fills remaining 67dvh. Desktop: 50/50 horizontal split with navy brand panel left + light content right, gold + blue `<DecorBlob>`s. Mobile: navy band on top + content below, no blobs (too cramped). `AttestationStamp` now accepts a `className` prop for responsive sizing; mobile brand band renders it with `max-w-[min(160px,18vh)]` to scale down on short screens instead of hiding. Landing content vertically centered (`flex items-center justify-center`). Login content top-aligned on mobile (`justify-start`) and centered on desktop (`lg:justify-center`). Login `<BackLink>` uses `self-start` to align left within the card. Language switcher floats top-right on desktop (light variant), inside the navy band on mobile (dark variant). No copyright footer (Landing/Login are conversion surfaces). Landing/Login content refactored to viewport-relative units: `py-[2dvh]`, `space-y-[1.5dvh]`, card padding `p-6 sm:p-8`. Forced `min-h-[Xlh]` removed from headings and subtitles so content can shrink to fit short viewports.                                         |
| `OverviewLayout` | All authenticated routes  | Fixed navy sidebar (`w-72`) with **gold brand mark cluster**, transparent top navbar (`min-h-[64px]` flat, no `sm:` breakpoint) with `mx-auto max-w-7xl` content row so menu/search/avatar align with the widest page content below, scrollable `main` (`flex-1 overflow-y-scroll [scrollbar-gutter:stable]` — the **sole** scroll surface on this layout) so route-switches with differing content heights don't reflow the navbar. Container is `h-dvh overflow-hidden` (NOT `min-h-dvh`, NOT `min-h-screen`) with `bg-base` (NOT `bg-gray-100` or hardcoded `bg-[#F4F7F6]`) so the page background matches `PublicLayout` and the window itself never scrolls — see §5.3's scroll-lock guard for why. Sidebar uses `sm:h-dvh` (NOT `sm:h-screen`) to match the container. On every route change, `useScrollToTop()` resets both the window scroller and the `#main` overflow container to the top so the next page never opens mid-scroll inherited from the previous one. Mobile: hand-rolled CSS-transform slide (`-translate-x-full` ↔ `translate-x-0`) with `bg-navy/80` click backdrop. `<main>` padding `px-4 pt-4 pb-12 sm:px-8` (full width — no `max-w-7xl` on the main wrapper; the sidebar takes the fixed `w-72` and the content area fills the remaining space). No copyright footer (authenticated chrome; brand presence is the sidebar). |
| `AdaptiveLayout` | `/help`, `/about`         | Renders `OverviewLayout` if `isAuthenticated`, `PublicLayout` otherwise. Because both layouts use identical `<main>` padding (`px-4 pt-4 pb-12 sm:px-8`) and matching header heights, unauthed and authed Help/About pages render identically — the only delta is the copyright strip, which appears only on the unauthenticated `PublicLayout` branch.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

#### Copyright Footer

The `<CopyrightFooter />` shared component (`@shared/components/CopyrightFooter.tsx`) is the only place that renders the copyright line. **Always consume it via the component — never inline the `<footer>` element.** It:

- Renders `© {year} · CredChain · All rights reserved` with `{year}` pulled from `new Date().getFullYear()` at render time (no hardcoded year).
- Uses `font-sans` (DM Sans) at `text-xs` in `text-gray-400`. Copyright text is functional/legal copy — `font-display` (Fraunces) is reserved for headings and would feel out of place at this size; `font-mono` (JetBrains Mono) is reserved for cryptographic identifiers. Neither belongs in a copyright strip.
- Carries `bg-transparent` (not `bg-surface`) so the page's `bg-base` (#F8FAFC) shows through. The previous `bg-surface` (#FFFFFF) created a visible "white void" between short content and the footer — the two colors are only ~3% apart in lightness, so on most screens the footer area looked like a separate section from the page background. Transparent background eliminates this contrast entirely; the footer becomes a line of muted text floating in the page's continuous background.
- Carries `mx-auto max-w-7xl` so the footer text is centered within the same 1280px band as `PublicLayout` `<main>` and `NavbarPublic` — footer edges align with the navbar edges and the main content boundary.
- Carries `safe-area-bottom` (iOS home indicator padding) and `no-print` (hidden when printing) classes.
- Has `mt-auto` baked in so it pins to the bottom of any flex-column container with `min-h-dvh` and a `flex-1` main slot.
- Accepts a `className` prop for layout-level overrides.

**Where it appears:** only on `PublicLayout` and the unauthenticated branch of `AdaptiveLayout` (Help, About). It does NOT appear on `OverviewLayout` (authenticated chrome) or `SplitLayout` (Landing, Login — conversion surfaces).

### 8.2 Container Widths

| Width          | Tailwind                   | Use case                                                                                                                                    |
| -------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Form / detail  | `max-w-md`                 | Auth card                                                                                                                                   |
| Detail view    | `max-w-4xl`                | Single-record screens                                                                                                                       |
| UserDetail     | `max-w-5xl`                | Exception to Detail view: hosts a 3-col credential card grid; 4xl would cramp the cards. Was 5xl since its first commit — do not re-narrow. |
| Settings       | `max-w-4xl`                | Settings                                                                                                                      |
| Verification   | `max-w-3xl`               | VerifyCredential (public)                                                                                                                   |
| Batch forms    | `max-w-6xl`                | UserCreate, CredentialIssue                                                                                                                 |
| Lists / tables | `max-w-7xl`                | UserList, CredentialList                                                                                                                    |

All containers center via `mx-auto`.

#### 8.2.1 Modal Widths (Strict Two-Tier System)

Modals strictly enforce a two-tier width system to eliminate awkward middle sizes and ensure layout consistency across the app:

| Tier                  | Tailwind    | Pixel Width | Use Case & Components                                                                                                                   |
| --------------------- | ----------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Standard / Action** | `max-w-lg`  | 512px       | Default base size in `@ui/dialog.tsx`. Used for forms and confirmation alerts: `ConfirmDialog`, `CredentialRejectReasonModal`.          |
| **Wide / Content**    | `max-w-5xl` | 1024px      | Complex, data-dense modals with multi-column forms or rich previews: `CredentialDetailModal`, `CredentialFileModal`, `UserImportModal`. |

### 8.3 Vertical Rhythm

| Class       | Use                           |
| ----------- | ----------------------------- |
| `space-y-6` | Page-level rhythm (default)   |
| `space-y-4` | Sub-section spacing           |
| `space-y-8` | Generous form section spacing |
| `space-y-1` | Label + input pair            |
| `space-y-2` | Tight clusters                |

### 8.4 Card Padding

| Use              | Padding                       |
| ---------------- | ----------------------------- |
| Standard card    | `p-6`                         |
| Prominent form   | `p-6 sm:p-8` or `p-6 sm:p-10` |
| Compact pill row | `p-4 sm:p-6`                  |

### 8.5 Grid Patterns

| Pattern                 | Tailwind                                                        |
| ----------------------- | --------------------------------------------------------------- |
| Stat cards (4-up)       | `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6`          |
| Credential cards (3-up) | `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6`          |
| Dashboard split         | `grid grid-cols-1 lg:grid-cols-3 gap-6` (main: `lg:col-span-2`) |
| Form fields (3-up)      | `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6`          |
| Form fields (2-up)      | `grid grid-cols-1 md:grid-cols-2 gap-6`                         |

### 8.6 Dashboard Sidebar Pattern

```tsx
// shared/components/layout/OverviewSidebar.tsx
<aside
  className={cn(
    "fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-navy text-gray-300 shadow-2xl transition-transform duration-300 sm:static sm:flex-shrink-0 sm:translate-x-0",
    open ? "translate-x-0" : "-translate-x-full",
  )}
>
  {/* Logo cluster — both icon and wordmark in gold */}
  <div className="flex flex-col items-center pt-10 pb-8">
    <ShieldCheck className="mb-2 h-12 w-12 text-gold" aria-hidden="true" />
    <span className="font-display text-2xl font-bold tracking-tight text-gold">CredChain</span>
  </div>
  {/* Nav items - role-filtered via canAccess() helper */}
  {/* Mt-auto logout button */}
</aside>
```

Nav items use `NavLink` with active state styling. The active state must read clearly at every screen size (mobile drawer + desktop sidebar share this one component), so it pairs a **gold left-accent bar** with a brighter background and a gold icon. Inactive items carry a transparent left border of the same width to prevent layout shift on activation:

```tsx
className={({ isActive }) => cn(
  "flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all border-l-[3px]",
  isActive
    ? "border-gold bg-white/15 text-surface shadow-sm"
    : "border-transparent hover:bg-white/5 hover:text-surface"
)}
```

The icon color follows the active state via the `children` render prop (`isActive ? "text-gold" : "text-gray-400"`). `NavLink` auto-applies `aria-current="page"` to the active link — no manual ARIA needed.

### 8.7 Mobile Drawer

**As-built:** the mobile sidebar is hand-rolled in `OverviewLayout.tsx`, not a shadcn `Sheet`. The `<aside>` is fixed-position and slides via CSS transform, toggled by a `overviewSidebarOpen` local state (the store state is reserved for cross-component coordination, currently unused); a `bg-navy/80` backdrop (`sm:hidden`) closes it on click. `OverviewSidebar` accepts an `onClose` prop that renders a close (`X`) button and dismisses the drawer on nav-item click.

```tsx
// OverviewLayout.tsx (abbreviated)
<aside
  className={cn(
    "fixed inset-y-0 left-0 z-50 w-72 shadow-2xl transition-transform duration-300",
    "sm:sticky sm:top-0 sm:h-screen sm:flex-shrink-0 sm:translate-x-0",
    overviewSidebarOpen ? "translate-x-0" : "-translate-x-full",
  )}
>
  <OverviewSidebar onClose={() => setOverviewSidebarOpen(false)} />
</aside>
```

> A shadcn `Sheet` was originally specced for this but never adopted; the hand-rolled transform is the live implementation. `vaul` is declared but unused in current production source. Content-drawer guidance does not describe an existing admin edit panel.

### 8.8 Responsive Breakpoints

> For comprehensive responsive guidance (touch targets, safe areas, mobile keyboards, container queries, print, dark mode), see Section 8.9 Responsive Design.

Mobile-first using Tailwind defaults:

| Breakpoint | Min width | Used for                                                  |
| ---------- | --------- | --------------------------------------------------------- |
| `sm:`      | 640px     | Tables visible, side-by-side rows                         |
| `md:`      | 768px     | 2-column grids, search bar visibility                     |
| `lg:`      | 1024px    | Sidebar (OverviewSidebar) visible, split auth, 4-up grids |
| `xl:`      | 1280px    | (rarely used) ultra-wide refinements                      |

### 8.9 Responsive Design

Responsive is not just breakpoints. This section consolidates everything required for the app to feel native on phones, comfortable on tablets, and authoritative on desktop.

#### Mobile-First Methodology

All component styles default to mobile. Add complexity at larger breakpoints, never the reverse:

```tsx
// CORRECT - mobile is the base, desktop layers on
<div className="flex flex-col gap-4 md:flex-row md:gap-6">

// WRONG - desktop is base, mobile is afterthought
<div className="flex flex-row gap-6 max-md:flex-col max-md:gap-4">
```

#### Viewport Meta

In `index.html`, support iOS safe areas:

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
```

`viewport-fit=cover` enables `env(safe-area-inset-*)` to expose notch/home-indicator insets.

#### Touch Targets

Every interactive element on touch devices must be at minimum **44x44px** (Apple HIG) and ideally **48x48px** (Material). Tailwind sizing for buttons:

| Use case              | `Button size` | Resulting size |
| --------------------- | ------------- | -------------- |
| Primary CTA           | `lg`          | 48px tall      |
| Default               | `md`          | 44px tall      |
| Icon button (desktop) | `icon`        | 44px square    |
| Icon button (mobile)  | `icon-mobile` | 48px square    |

Heights come from the §7.3 scale, not from padding — see that table for the
matching `Input` size.

`OverviewSidebar` nav items already meet target with `px-4 py-3`.

**Deviation: the inline create row uses the 36px pair.** `InlineCreateRow`
(`Button size="sm"` + `Input size="compact"`) sits under the 44px minimum. It
is a secondary, admin-only, desktop-first affordance, and the shorter height is
what distinguishes it from the 44px page search bar directly above it — at 44px
the two read as two search bars. Deliberate exception, not an oversight.

**Deviation: reference status filters use compact 36px buttons.** Status and count-retry buttons match the existing credentials-page filter triggers at every viewport. These controls retain an 8px wrapping gap, native keyboard activation, and visible focus. This intentionally falls below the preferred 44px touch target; it is not a claim of 44px target compliance.

#### Safe-Area Insets

Apply to elements that touch the viewport edges on iOS:

```css
.safe-area-bottom {
  padding-bottom: env(safe-area-inset-bottom);
}
.safe-area-top {
  padding-top: env(safe-area-inset-top);
}
.safe-area-x {
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
}
```

Apply to:

- `PublicLayout` footer
- `OverviewLayout` mobile top nav (when navy bar reaches edge)
- Mobile sidebar `Sheet` content
- Bottom-sheet dialogs (when added)
- Toast container (sonner provides this, but verify on iOS)

**Cascade gotcha:** `safe-area-top` (and `-bottom`/`-x`) sets `padding-top: env(safe-area-inset-top)` directly. When co-located with Tailwind's `py-*` utilities on the same element, `safe-area-top` overrides the `padding-top` from `py-*` (CSS utilities-layer source order), leaving the element with `padding-top: 0` on devices without a notch. Apply `safe-area-top` to a dedicated zero-height spacer `<div>` _inside_ the element instead of co-locating it with `py-*`. Pattern in use: `NavbarOverview.tsx`.

#### Mobile Keyboard Hints

Guide the on-screen keyboard with the right semantics:

```tsx
<input type="email"   inputMode="email"   autoComplete="email"        autoCapitalize="off" />
<input type="tel"     inputMode="tel"     autoComplete="tel"          />
<input type="text"    inputMode="numeric" autoComplete="one-time-code" /> {/* OTP */}
<input type="search"  inputMode="search"  enterKeyHint="search"        />
<input type="url"     inputMode="url"     autoComplete="url"          autoCapitalize="off" />
```

`enterKeyHint` controls the return-key label: `enter`, `done`, `go`, `next`, `previous`, `search`, `send`.

#### Reduced Motion

Respect `prefers-reduced-motion`. The decorative blob is the most aggressive animation candidate; disable for users who opt out:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
  }
}
```

Honor it in JS too:

```ts
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
```

#### Container Queries

Use for components that should respond to **their parent container's width**, not the viewport. Useful for cards that appear in different contexts (sidebar list vs main grid):

```css
.credential-card {
  container-type: inline-size;
  container-name: card;
}

@container card (min-width: 320px) {
  .credential-card .meta {
    display: flex;
  }
}
```

In Tailwind v4 via the `@container` plugin or `[@container]` arbitrary variants. Reserve for genuinely reusable components - viewport breakpoints handle most cases.

#### Tablet Treatment (768-1024px)

The `md:` to `lg:` range needs explicit decisions:

| Element          | md (tablet portrait)  | lg (tablet landscape / desktop) |
| ---------------- | --------------------- | ------------------------------- |
| OverviewSidebar  | Mobile drawer (Sheet) | Fixed `w-72`                    |
| Navigation       | Hamburger menu        | Fixed sidebar                   |
| Stat cards       | 2-up grid             | 4-up grid                       |
| Credential cards | 2-up                  | 3-up                            |
| Form fields      | 2-up where logical    | 3-up where logical              |
| Auth screen      | Stacked               | Split-screen                    |
| Detail views     | Single column         | Two-column with side panel      |

#### Print Styles

The public credential verification page must print cleanly (employers, registrars):

```css
@media print {
  .no-print {
    display: none;
  }
  .print-only {
    display: block;
  }
  body {
    background: white;
    color: black;
  }
  .navy-card {
    background: white;
    color: black;
    border: 2px solid black;
  }
  a::after {
    content: " (" attr(href) ")";
    font-size: 0.875em;
    color: #666;
  }
  .credential-hash {
    word-break: break-all;
  }
}
```

Apply `.no-print` to: nav, footer, action buttons, decorative blobs.
Apply `.print-only` to: a print header with verification timestamp + URL.

#### Orientation

Mobile auth screen in landscape can feel cramped. Consider:

```tsx
<div className="flex min-h-screen flex-col landscape:flex-row">
  {/* Branding panel: top in portrait, left in landscape */}
</div>
```

Not every screen needs orientation handling - reserve for full-screen experiences (auth, public verification). Lists and forms should scroll naturally.

#### Mobile UX Patterns

| Pattern            | When to use                          | Implementation                                              |
| ------------------ | ------------------------------------ | ----------------------------------------------------------- |
| Side sheet         | Navigation (mobile sidebar)          | shadcn `Sheet side="left"`                                  |
| Bottom sheet       | Actions / filters / detail preview   | shadcn `Drawer` (Vaul-based)                                |
| Full-screen dialog | Multi-step flows on mobile           | shadcn `Dialog` with `h-screen` override at `sm:max-w-none` |
| Pull-to-refresh    | List views on mobile only            | Defer to Phase 2 unless requested                           |
| Swipe-to-delete    | Soft-delete in user/credential lists | Defer to Phase 2                                            |
| Long-press menu    | Context actions on cards             | Defer to Phase 2; right-click handles desktop               |

#### Dark Mode Hooks (Phase 2)

The token structure already supports dark mode. When prioritized, add to `styles/index.css`:

```css
@layer base {
  :root.dark {
    --color-base: #0f172a;
    --color-surface: #1e293b;
    --color-navy: #f8fafc; /* invert: text becomes light */
    /* ... rest of overrides ... */
  }
}
```

Toggle by adding/removing `.dark` on `<html>`. Persist choice via `useStore.theme`. shadcn/ui components consume the same tokens, so they reskin automatically.

#### Verification Checklist

Before shipping any new screen:

- [ ] Renders correctly at 375px (iPhone SE), 768px (iPad portrait), 1024px (iPad landscape), 1440px (desktop)
- [ ] All interactive elements >= 44x44px on touch
- [ ] No horizontal scrollbars at any breakpoint
- [ ] Safe-area insets honored on iOS
- [ ] Reduced motion gracefully degrades animations
- [ ] Mobile keyboard shows correct type for each input
- [ ] Tested at 200% browser zoom (accessibility requirement)
- [ ] Print preview is legible (for verification page)

---

## 9. State Management

See [AGENTS.md §State Management](AGENTS.md) for TanStack Query + Zustand architecture.

---

## 10. API Integration

See [AGENTS.md §API Integration](AGENTS.md) for axios client setup and interceptors.

---

## 11. Authentication Flow

### 11.1 Google OAuth Button Pattern

```tsx
// feature/auth/components/GoogleButton.tsx
import { GoogleLogin } from "@react-oauth/google";

export function GoogleButton() {
  const login = useGoogleLogin();
  return (
    <GoogleLogin
      onSuccess={(credentialResponse) => {
        if (credentialResponse.credential) {
          login.mutate({ id_token: credentialResponse.credential });
        }
      }}
      onError={() => toast.error(t("auth.login.failed"))}
      theme="outline"
      size="large"
      width="100%"
    />
  );
}
```

### 11.2 Post-Login Navigation

After successful login, navigate to `/overview`. The backend sets httpOnly cookies; the frontend only persists the `UserDTO` from the response.

### 11.3 Logout Pattern

`useLogout` calls `POST /api/auth/logout`, then clears Zustand session + Query cache and navigates to `/` on settlement, including failure. Failed revocation shows an error instead of a success toast. Refresh/logout serialization and its limits are documented in `AGENTS.md`.

### 11.4 Email Update with Google Reauth

`UserSelfEmail` displays the current email read-only and offers Google sign-in. It reads the new email from the returned ID token, asks for confirmation, then sends that email and token to `PUT /users/self/email`. There is no editable new-email input. Backend verifies the token's email matches.

For token management, refresh flow, and backend auth coordination, see [AGENTS.md §Authentication](AGENTS.md).

---

## 12. Routing & Authorization

### 12.1 Route Guards

- `ProtectedRoute`: redirects unauthenticated to `/login` (with `state.from`); role-mismatched Holders to `/credentials`, other roles to `/overview`. Optional `allowedRoles?: Role[]`.
- `PublicRoute` — redirects authenticated away to `state.from ?? /overview` (login is public-only).
- `RoleGate` — inline UI gating for show/hide based on role, with optional `fallback`.

See the route guard implementations in `@shared/auth/guards.tsx`.

### 12.2 Sidebar Nav Items

`NAV_ITEMS` in `@shared/components/layout/nav-items.ts` currently show Overview and Credentials for Holder+, Users for Issuer+. Profile, Help, and About are not sidebar items. The item type supports `minRole`, `exactRole`, and `inSidebar`; no current entry uses `exactRole`. Settings and a separate My Credentials entry are absent.

For the complete route table with paths, components, guards, and shells, see [AGENTS.md §Route Map](AGENTS.md).

---

## 13. Forms & Validation

**Stack:** React Hook Form + Zod via `@hookform/resolvers/zod`.

**FormField:** Use `@ui/form-field` which wraps `<Label>` + children + optional error/hint/optional tag:

```tsx
<FormField label={t("user.name")} error={errors.name?.message}>
  <Input leadingIcon={User} {...register("name")} />
</FormField>
```

For batch forms, use `useFieldArray({ control, name: "users" })`.

For Zod schema definitions and RHF integration, see [AGENTS.md §Forms & Validation](AGENTS.md).

---

### 13.4 Server-Side Validation Errors

Backend validation returns HTTP `400` with per-field arrays of already-localized messages. Generic system validation uses `100040`; endpoint-specific codes also exist. Map available field errors to RHF rather than gating on one code:

```ts
import { setServerErrors } from "@shared/lib/forms";

const createUsers = useMutation({
  mutationFn: ...,
  onError: (error: ApiError) => {
    if (error.fieldErrors) {
      setServerErrors(form, error.fieldErrors);
    } else {
      notify.error(error.messageKey);
    }
  },
});
```

---

## 14. Internationalization

### 14.1 Translation Hook

```tsx
import { useTranslation } from "react-i18next";

export function MyComponent() {
  const { t } = useTranslation();
  return <p>{t("user.fetch.success")}</p>;
}
```

### 14.2 Language Switcher

Lives in `NavbarOverview` and `NavbarPublic`. Persists choice to `useStore.locale`. Authenticated changes also save through `PUT /users/self/language`, with same-account cache updates and rollback on failure. The following local-only sketch is not the complete account-save implementation:

```tsx
export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const setLocale = useStore((s) => s.setLocale);

  const change = (lng: "en" | "id") => {
    void i18n.changeLanguage(lng);
    setLocale(lng);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="text-sm font-medium text-navy">
        {i18n.language === "id" ? "ID" : "EN"}
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={() => change("en")}>English</DropdownMenuItem>
        <DropdownMenuItem onClick={() => change("id")}>Bahasa Indonesia</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

For i18n configuration see [AGENTS.md §Internationalization](AGENTS.md).

---

## 15. Error Handling

### 15.1 Error Surfaces

| Error type                 | UI surface                | Resolution                |
| -------------------------- | ------------------------- | ------------------------- |
| Validation (generic `100040` or endpoint-specific code) | Inline form field error | Fix input |
| Session-authentication 401 | Coordinated refresh; redirect on definitive rejection | Auto |
| Domain reauthentication 401 | Error without clearing the session | Complete required reauthentication |
| Forbidden (`status 403`)   | Toast + route fallback    | Sign in as different user |
| Not Found (`status 404`)   | Empty state on page       | Navigate back             |
| Server (5xx)               | Toast                     | Retry button              |
| Network                    | Toast                     | Retry button              |
| Boundary crash             | Full-page ErrorBoundary   | Reload                    |

### 15.2 ErrorBoundary

Use `react-error-boundary` (small, well-maintained):

```tsx
// shared/components/ErrorBoundary.tsx
import { ErrorBoundary as REB } from "react-error-boundary";

export function AppErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <REB
      fallbackRender={({ error, resetErrorBoundary }) => (
        <div className="flex min-h-screen items-center justify-center p-6">
          <Card className="max-w-md p-8 text-center">
            <ShieldAlert className="mx-auto mb-4 h-12 w-12 text-error" />
            <h2 className="mb-2 text-2xl font-bold text-navy">Something broke</h2>
            <p className="mb-6 text-sm text-gray-500">{error.message}</p>
            <Button onClick={resetErrorBoundary}>Try again</Button>
          </Card>
        </div>
      )}
      onError={(error) => console.error("App boundary:", error)}
    >
      {children}
    </REB>
  );
}
```

### 15.3 Toast Conventions

```ts
// shared/lib/notify.ts
import { toast } from "sonner";

export const notify = {
  success: (key: string, opts?: { description?: string }) => toast.success(i18n.t(key), opts),
  error: (key: string, opts?: { description?: string }) => toast.error(i18n.t(key), opts),
  info: (key: string, opts?: { description?: string }) => toast.info(i18n.t(key), opts),
};
```

Mutation success/error always passes through `notify`:

```ts
onSuccess: () => notify.success("user.store.success"),
onError: (e: ApiError) => notify.error(e.messageKey),
```

### 15.4 Inline Validation Errors

Use `@ui/form-field` with the RHF field's error message. There is no installed `FormMessage` component. Backend errors use `Record<string, string[]>`; preserve their localized messages and dot paths:

```ts
// shared/lib/forms.ts
export function setServerErrors<T extends FieldValues>(
  form: UseFormReturn<T>,
  errors: Record<string, string[]>,
) {
  Object.entries(errors).forEach(([path, messages]) => {
    const message = Array.isArray(messages) ? messages[0] : String(messages);
    if (!message) return;
    form.setError(path as Path<T>, { type: "server", message });
  });
}
```

---

## 16. Accessibility

### 16.1 Non-Negotiables

1. All interactive elements reachable via keyboard (Tab, Shift-Tab, Enter, Space)
2. Visible focus indicator on every focusable element (`:focus-visible`)
3. Modals trap focus and return it to the trigger on close
4. Form fields paired with explicit `<label>` (or `aria-labelledby`)
5. Icons-only buttons carry `aria-label`
6. Color contrast >= 4.5:1 for body text, 3:1 for large text
7. Color is never the sole signal (always pair with icon or text)
8. Live regions for async updates (`aria-live="polite"` for toasts, `assertive` for errors)

### 16.2 Pattern Compliance

| Element              | shadcn coverage               | Manual work                        |
| -------------------- | ----------------------------- | ---------------------------------- |
| Dialog / AlertDialog | Focus trap, ESC, return focus | Set `aria-describedby` for body    |
| DropdownMenu         | Keyboard nav, ARIA            | Provide accessible trigger label   |
| Select               | Combobox semantics            | Pair with `<Label>`                |
| Tabs                 | Roving tabindex               | Use `<TabsList>` + `<TabsTrigger>` |
| Toast (sonner)       | `aria-live="polite"`          | Avoid critical-only-color states   |
| Tooltip              | `aria-describedby`            | Avoid as the only label            |

### 16.3 Focus Ring

Never disable. Use `focus-visible:` so mouse users don't see rings, keyboard users do:

```css
@layer base {
  :focus {
    outline: none;
  }
  :focus-visible {
    outline: 2px solid var(--color-gold);
    outline-offset: 2px;
  }
}
```

### 16.4 Skip Link

```tsx
<a
  href="#main"
  className="sr-only rounded-xl bg-navy px-4 py-2 text-surface focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50"
>
  Skip to main content
</a>
```

### 16.5 Testing

Unit/integration:

```tsx
// In RTL
userEvent.tab();
expect(document.activeElement).toBe(screen.getByLabelText(/email/i));
expect(screen.getByRole("alert")).toHaveTextContent(/invalid/i);
```

E2E with axe-core:

```ts
import AxeBuilder from "@axe-core/playwright";

test("login page has no a11y violations", async ({ page }) => {
  await page.goto("/login");
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
```

---

## 17. Testing

See [AGENTS.md §Testing Strategy](AGENTS.md) for Vitest/RTL/MSW/Playwright configuration.

---

## 18. Performance & Build

### 18.1 Code Splitting

Lazy-load every route remains the design requirement. Current page routes use the `lazyRoute()` helper built on React `lazy` and `Suspense`, not React Router's `lazy:` property. Login, the credential-detail redirect, and NotFound are eager. Shared imports and manual chunks mean output is not guaranteed to be one chunk per route. See the routing section in `AGENTS.md`.

### 18.2 Vite Config

Selected build/proxy configuration is shown below. The complete file also loads `VITE_PORT` (default 5173), defines `__APP_VERSION__`, excludes `pdfjs-dist` from dependency optimization, and configures development allowed hosts.

```ts
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@app": path.resolve(__dirname, "./src/app"),
      "@feature": path.resolve(__dirname, "./src/feature"),
      "@shared": path.resolve(__dirname, "./src/shared"),
      "@ui": path.resolve(__dirname, "./src/shared/components/ui"),
    },
  },
  build: {
    target: "es2022",
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          "react-vendor": ["react", "react-dom", "react-router-dom"],
          "query-vendor": ["@tanstack/react-query", "axios"],
          "form-vendor": ["react-hook-form", "@hookform/resolvers", "zod"],
          "ui-vendor": ["lucide-react", "sonner", "clsx", "tailwind-merge"],
        },
      },
    },
  },
  server: {
    proxy: {
      "/api": {
        target: process.env.VITE_API_PROXY ?? "http://localhost:8080",
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
```

### 18.3 Icon Tree-Shaking

lucide-react auto tree-shakes when imported by name. Always:

```ts
// CORRECT
import { ShieldCheck } from "lucide-react";

// WRONG - imports everything
import * as Icons from "lucide-react";
```

### 18.4 Image Strategy

- Use SVG icons (lucide-react) over raster
- For static images, use `?url` Vite import or `public/` folder
- Lazy-load below-the-fold images with `loading="lazy"`

### 18.5 Bundle Budget

| Chunk                        | Target      |
| ---------------------------- | ----------- |
| Initial (login + auth shell) | < 150 kB gz |
| Per-route chunk              | < 50 kB gz  |
| Total app                    | < 500 kB gz |

Monitor via `npx vite-bundle-visualizer` or `rollup-plugin-visualizer`.

### 18.6 Production Optimizations

- Brotli compression (handled by hosting platform or nginx)
- Cache `assets/*` for 1 year (Vite hashes filenames)
- Cache `index.html` for 0 seconds (must always re-fetch)
- HTTP/2 server push for critical CSS

---

## 19. Coding Conventions

See [AGENTS.md §Coding Conventions](AGENTS.md) for naming conventions and ESLint rules.

---

## 20. Migration Notes from Demo

**Decision:** Hard migration. `CredChain_React_Demo/` is reference only. The new `CredChain_React/` is greenfield. Do not import or copy from the demo - reproduce only the design intent.

### 20.1 What Carries Over

| From demo                                                   | To production                                |
| ----------------------------------------------------------- | -------------------------------------------- |
| Color tokens (navy, gold, base, surface, error)             | Same (extended in @theme)                    |
| Component recipes (card, CTA, input, pill, eyebrow)         | Reified as named components                  |
| Layout shells (3 layouts)                                   | Same shape, hardened with shadcn primitives  |
| Routing structure                                           | Same paths, lazy-loaded, single role-utility |
| Role hierarchy logic                                        | Single source: `shared/auth/role.ts`         |
| Feature folders                                             | Same                                         |
| `lucide-react` icons                                        | Same                                         |
| Form structures (batch user create, batch credential issue) | Same UX, RHF + Zod-driven                    |

### 20.2 What Gets Replaced

| Demo                                             | Production                                 |
| ------------------------------------------------ | ------------------------------------------ |
| Mock Zustand store with seed data                | TanStack Query against real `/api`         |
| Hand-rolled `<select>`                           | shadcn `<Select>`                          |
| `window.confirm`                                 | shadcn `<AlertDialog>` + `useConfirm`      |
| Plain `useState` forms                           | RHF + Zod                                  |
| Demo account dropdown                            | Google OAuth button                        |
| `password123` readonly input                     | Removed entirely                           |
| Hardcoded `bg-[#F4F7F6]`                         | Token-based                                |
| Duplicated `roleHierarchy` map                   | `shared/auth/role.ts`                      |
| `App.css` (Vite scaffold)                        | Deleted                                    |
| Empty `shared/{api,component,hook,util}` folders | Populated per Section 4                    |
| Inline `clsx` everywhere                         | `cn()` helper (`shared/lib/cn.ts`)         |
| Raw `bg-blue-100 text-blue-800` role badge       | Token-based via the `<StatusPill tone="navy">` design recipe (§7.5); current status badges use `@ui/badge` |

### 20.3 What Gets Deleted

- `App.css` (dead Vite scaffold)
- `password123` readonly input
- Demo account dropdown UI
- Mock seed data (`MOCK_USERS`, `MOCK_CREDENTIALS`)
- `walletAddress` hand-generation in UserCreate (backend handles wallet creation now)
- `firstName`/`lastName` split (backend uses single `name` field)

### 20.4 Backend Contract Differences

The demo's DTO doesn't match the real backend. Production must use:

| Demo field              | Backend field                          |
| ----------------------- | -------------------------------------- |
| `firstName`, `lastName` | `name` (single string)                 |
| `phone`                 | `phone_number` (E.164 format)          |
| `walletAddress`         | Backend manages, not exposed in create |
| `status`                | (not in backend response)              |
| (none)                  | `number` (employee/student ID)         |
| (none)                  | `birth_date` (YYYY-MM-DD)              |
| (none)                  | `meta` (arbitrary JSON object)         |
| (none)                  | `deleted_at` (soft delete)             |

Mirror `response.User` from `infrastructure/http/response/user.go` exactly:

```ts
// shared/types/api.ts
export interface UserDTO {
  id: string;
  name: string | null;
  number: string | null;
  phone_number: string | null;
  email: string;
  birth_date: string | null; // YYYY-MM-DD
  role: Role;
  meta: Record<string, unknown> | null;
  wallet_address: string; // 0x...
  created_at: string; // ISO 8601
  updated_at: string;
  deleted_at: string | null;
}

export interface AuthResponse extends UserDTO {
  // The backend returns user fields inline + tokens
  access_token: string;
  refresh_token: string;
  access_token_expires_in: number;
  refresh_token_expires_in: number;
  token_type: "Bearer";
}
```

Note: backend's `response.Auth` has `User` embedded with `json:",inline"` — fields appear at the top level of the JSON body alongside the token fields. Although our cookie strategy means tokens are not consumed by the frontend, types match the wire format.

### 20.5 Missing-from-Demo Surfaces

Production must add:

- `/users/self/profile` (PUT) - update own profile
- `/users/self/email` (PUT) - update own email with Google reauth
- Pagination + sort + search query params on list endpoints
- Rate limit handling (429 toasts: "Too many attempts, try again in X seconds")
- Soft-deleted user filter (default hides deleted, admin toggle to show)
- Multi-language (id/en) toggle

### 20.6 New Layout Pieces

- `LanguageSwitcher` in NavbarOverview (and NavbarPublic)
- User menu dropdown (replace static avatar with shadcn `DropdownMenu`)
- Search command palette (shadcn `Command` triggered by Cmd+K) - optional Phase 2
- Notifications bell (real-time toast feed) - optional Phase 2

### 20.7 Feature Cutover Order (suggested)

1. Bootstrap project + design tokens + shadcn base
2. Auth flow (login, refresh interceptor, session hydrator)
3. Dashboard shell (layouts, sidebar, top nav, role guards)
4. User feature (list, detail, create batch, self profile)
5. Credential feature (list, detail, issue, my credentials, public verify)
6. Settings + i18n switcher
7. Polish: loading states, empty states, error pages, toasts
8. E2E tests against staging

---

## 21. AI Development Prompts

These prompts are designed to be used with the `frontend-design` skill or any AI assistant working on this codebase.

### 21.1 AGENTS.md for CredChain_React

Create `CredChain_React/AGENTS.md` with the following content when bootstrapping the project:

```
# CredChain React - Agent Instructions

## Critical Commands

npm run dev          # Start dev server (Vite, port 5173)
npm run build        # TypeScript check + Vite build
npm run lint         # ESLint
npm run format       # Prettier
npm run test         # Vitest (unit + component + integration)
npm run test:e2e     # Playwright E2E
npm run check-locales # Verify locale sync with backend

## Architecture

See DESIGN_SYSTEM.md for full reference. Key rules:
- Feature folders under src/feature/ - never cross-import between features
- All API calls via TanStack Query hooks in feature/*/api/
- All tokens via @theme in styles/index.css - no raw hex codes
- All classNames via cn() helper - no template string concatenation
- shadcn/ui components in shared/components/ui/ - restyle to tokens before use
- Role logic only in shared/auth/role.ts
- No default exports anywhere

## Design System

Palette: navy (#0F172A), gold (#C9A227), base (#F8FAFC), surface (#FFFFFF), error (#B91C1C)
Radius: rounded-xl (inputs/buttons), rounded-2xl (cards)
Shadows: tinted - shadow-navy/20, shadow-gold/20, shadow-error/20
Typography: system-ui, no web fonts
Icons: lucide-react only, named imports only
```

### 21.2 Component Generation Prompt

Use this when asking an AI to build a new component:

```
Build a [ComponentName] component for CredChain React.

Design system rules:
- Palette: navy (#0F172A) primary, gold (#C9A227) accent, error (#B91C1C) destructive
- Cards: bg-surface rounded-2xl shadow-sm border border-gray-100
- Buttons: rounded-xl font-bold, primary=bg-navy text-surface shadow-md shadow-navy/20
- Inputs: rounded-xl border-gray-200 bg-gray-50 focus:ring-2 focus:ring-navy focus:bg-white
- Status pills: inline-flex rounded-md text-xs font-bold uppercase tracking-wider
- Eyebrow labels: text-xs font-bold uppercase tracking-wider text-gray-500
- Mono IDs: font-mono text-xs text-gray-500
- All classNames via cn() from shared/lib/cn.ts
- Icons from lucide-react, named imports only
- No default exports
- TypeScript strict, named export

Component requirements:
[describe what the component does]
```

### 21.3 Feature Scaffolding Prompt

Use this when adding a new feature domain:

```
Scaffold a new feature folder for CredChain React: feature/[name]/

Create these files following existing patterns in feature/user/:
- api/use[Name]s.ts       (TanStack Query list hook)
- api/use[Name].ts        (TanStack Query detail hook)
- api/useCreate[Name].ts  (useMutation for POST)
- schemas/[name].ts       (Zod schema mirroring Go Ozzo rules)
- components/[Name]Card.tsx
- [Name]List.tsx
- [Name]Detail.tsx
- index.ts                (named re-exports only)

Backend endpoint: [describe the API endpoint]
DTO fields: [list fields from backend response]
Role access: [which roles can access]
```

### 21.4 Backend Integration Prompt

Use this when wiring a new API endpoint:

```
Wire the [METHOD] /api/[path] endpoint into CredChain React.

Backend contract:
- Response envelope: { code: number, message: string, data?: T }
- Success code: [code]
- Error codes: [list codes]
- Request body: [describe fields]
- Response data: [describe shape]

Create:
1. Zod schema in feature/[name]/schemas/[name].ts mirroring Go Ozzo rules
2. TanStack Query hook in feature/[name]/api/use[Action][Name].ts
3. Add response code mappings to shared/api/codes.ts
4. Add locale keys to shared/i18n/en.json and shared/i18n/id.json
5. Wire into the relevant screen component

Follow patterns in feature/user/api/useCreateUsers.ts.
```

### 21.5 Design System Audit Prompt

Use this when reviewing a component for design system compliance:

```
Audit this CredChain React component for design system compliance.

Check for:
1. Raw hex codes (should use token names)
2. classNames not using cn() helper
3. Hardcoded colors not in @theme (e.g. bg-[#F4F7F6])
4. window.confirm or window.alert (replace with useConfirm)
5. Default exports (should be named exports)
6. Direct axios imports (should use shared/api/client.ts)
7. Role logic outside shared/auth/role.ts
8. Cross-feature imports (feature/X importing from feature/Y)
9. Missing aria-label on icon-only buttons
10. Missing focus:ring on interactive elements

For each violation, show the line and the correct fix.
```

---

## 22. Open Questions / Decision Log

### 22.1 Decided

| Decision       | Choice                             | Rationale                                                       |
| -------------- | ---------------------------------- | --------------------------------------------------------------- |
| Doc location   | `CredChain_React/DESIGN_SYSTEM.md` | Co-located with package; Go and Solidity repos can xref         |
| UI primitives  | shadcn/ui + Radix UI               | Owned in-repo, accessible by default, 2026 default for Tailwind |
| Server state   | TanStack Query + axios             | Industry standard, handles caching/refetch/mutations            |
| Forms          | React Hook Form + Zod              | Best DX for batch/dynamic forms, Zod mirrors Ozzo               |
| Token storage  | httpOnly cookies (backend-set); SameSite=Strict required | HttpOnly prevents script access to cookie values, not XSS itself; cookie policy and CSRF protection still require backend review |
| i18n           | i18next + react-i18next            | Mature, ICU-style, matches backend go-i18n keys                 |
| Demo migration | Hard - greenfield                  | Demo DTOs do not match real backend                             |
| AI prompts     | Section 21                         | Component, feature, backend integration, audit prompts          |

### 22.2 Open Questions for Backend

1. **Cookie strategy on `/api/auth/google`**: HttpOnly access and refresh cookies are implemented. Tokens also remain in the response DTO; omitting body tokens is still a coordination decision. Cookie Secure/SameSite settings are configurable. Credentialed CORS requires explicit origins.
2. **CSRF token endpoint** - With cookies, do we need a `/api/csrf-token` endpoint, or rely on SameSite=Strict alone?
3. **`/api/users/self/email` Google reauth** - Does backend accept the same Google ID token format as login? Audience claim?
4. **Pagination response shape**: list data uses `{ items, total, page, limit, last_page, from, to, ...URL helpers }` inside the response envelope. See `PaginatedResponse<T>` and Go `response.Pagination`.
5. **Validation error shape**: `errors` maps field paths to localized string arrays, including dot paths such as `users.0.email`. Generic validation uses `100040`; endpoint-specific codes also exist.
6. **Rate limit headers** - Does backend return `Retry-After` or `X-RateLimit-Reset` so frontend can show "try again in X seconds"?

### 22.3 Open Questions for Frontend

1. **Search/sort/filter params** - URL-state driven (use `useSearchParams`) or local state? URL recommended.
2. **Empty `meta` field UX** - JSON editor vs key-value input grid?
3. **Date display locale** - `Intl.DateTimeFormat` with user locale, or fixed format?
4. **Mobile-only screens** - Do any flows need mobile-only UX (camera-based credential scanning)?
5. **Dark mode**: future consideration. Current application is light-only; `:root.dark` overrides were removed. Older dark-mode recipes elsewhere in this document remain unresolved design guidance, not current functionality.
6. **Real-time updates** - WebSocket from backend for credential issuance notifications? Phase 2.
7. **Public verification page UX** - QR code support? File drag-and-drop?

### 22.4 Phase 2 Considerations

Historical initial-release deferrals follow. CSV/Excel user import and a persisted notification inbox now exist; a real-time feed remains separate from that inbox.

- Cmd+K command palette (`shadcn/ui` Command primitive)
- Notifications bell with real-time feed
- Dark mode toggle
- Bulk import users from CSV/Excel
- Credential template builder UI
- On-chain transaction viewer in user/credential detail pages
- Audit log viewer (Admin+)
- Multi-tenant theming via `--color-primary` override

### 22.5 Document Maintenance

This document should be updated whenever:

- A new design token is added
- A new component recipe emerges
- The backend contract changes (new endpoint, new response code, new field)
- A new architectural pattern is adopted
- An open question is resolved

Keep `Last updated` at the top current. Reviewers should reject PRs that introduce new patterns without documenting them here.

#### Changelog

| Version | Date       | Changes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| v1.10   | 2026-08-29 | **§7.13 added** — `SearchableCreateSelect` and `HolderSearchDropdown` rebuilt on `@ui/dropdown-menu`, replacing `SearchableCreateSelect`'s Radix `Dialog` (a modal) and `HolderSearchDropdown`'s hand-rolled `absolute`-div panel. All four app dropdowns now share one mechanism. Records the two details beyond `UnitPicker`: the trigger is a `div role="combobox"` (not a `button`) because multi-select chips need their own `<button>` inside, and multi-select `DropdownMenuItem`s need `onSelect={(e) => e.preventDefault()}` so picking one doesn't close the panel. Selected values in `SearchableCreateSelect`'s `multiple` mode now render as removable gold `Badge` chips instead of comma-joined text. Submit Credential's name field now auto-fills from the uploaded filename (already true of Issue Credential), gets a file-preview modal, and switches to the `cred.field.name*` i18n keys to match.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| v1.0    | 2026-05-29 | Initial draft. Sections 1-22 + Appendix A.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| v1.1    | 2026-05-29 | Typography migrated from system-ui to Fraunces + DM Sans + JetBrains Mono. Added Section 6.5 Visual Language Principles. Added Section 8.9 Responsive Design (touch targets, safe areas, mobile keyboards, reduced motion, container queries, tablet, print, orientation, dark mode hooks).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| v1.2    | 2026-05-31 | Dark mode removed from spec to match codebase (light-only).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| v1.3    | 2026-06-09 | As-built reconciliation pass. Design philosophy (§5 tokens, §6 typography, §6.5 visual language, §8.9 responsive) preserved verbatim — those still describe the intended design faithfully. Architectural sections updated to match codebase: §3 tech versions synced and `ethers` row removed; §3 install list replaced with the 12 actual primitives; §4.1 folder structure rewritten as as-built (single `store/index.ts`, `feature/landing/`, `AdaptiveLayout` + `SplitLayout`, no `AuthLayout`/`interceptors.ts`/`useConfirm.ts`); §7.9 `useConfirm` rewritten to match the real `{confirm, dialog}` shape in `@ui/confirm-dialog`; §8.1 layout shells table updated; **§8.7 mobile drawer rewritten** (hand-rolled CSS-transform `<aside>`, never adopted shadcn `Sheet`; `vaul` reserved for content drawers); §9.2 store consolidated to single-file shape with `partialize` + Indonesian default; §10.1/§10.2 axios example updated with `paramsSerializer`, `Accept-Language`, `refreshInFlight` dedup, `X-Retry: 1`, and 429 handling; §11.1 token strategy moved from "backend coordination required" to "implemented" (Go side ships cookies).                                                                                                                                                                                                                                                                                                                                                                                                                               |
| v1.4    | 2026-06-10 | `SplitLayout` forced to exactly 100dvh with no scrollbars. §8.1 table updated: outer container and right panel use `h-dvh overflow-hidden`; mobile brand band uses `h-[33dvh] flex items-center justify-center`; content area `flex-1` fills remaining 67dvh with `min-h-0 overflow-hidden`. `AttestationStamp` now accepts `className` prop for responsive sizing; mobile brand band renders it with `max-w-[min(160px,18vh)]` instead of hiding. Landing content vertically centered (`flex items-center justify-center`); Login content top-aligned on mobile (`justify-start`) and centered on desktop (`lg:justify-center`). Login `<BackLink>` uses `self-start` for left alignment. Landing/Login content refactored to viewport-relative units (`py-[2dvh]`, `space-y-[1.5dvh]`, card padding `p-6 sm:p-8`). Removed forced `min-h-[Xlh]` from headings/subtitles so content shrinks to fit short viewports. Added `SplitLayout.test.tsx` (5 tests).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| v1.5    | 2026-06-11 | Layout max-width alignment pass. **§8.1 table** updated: `PublicLayout` `<main>` now has `mx-auto max-w-7xl` so the public content area (About/Help/VerifyCredential, which are `max-w-4xl`) centers within a 1280px band that aligns with `NavbarPublic` width. `OverviewLayout` row expanded: container is now `min-h-dvh bg-base` (was `min-h-screen bg-gray-100` with the inner wrapper at hardcoded `bg-[#F4F7F6]`), sidebar uses `sm:h-dvh` (was `sm:h-screen`), `<main>` drops to `flex-1 overflow-y-scroll` with **no** `max-w-7xl` (the sidebar takes the fixed `w-72` and the content area fills the remaining space — adding `max-w-7xl` would double-constrain list pages like UserList). Navbar row now documents `mx-auto max-w-7xl` on the dashboard navbar's flex row (the `<header>` background still spans full width but menu/search/avatar are centered at 1280px and align with the widest page content below). **§8.1.1 CopyrightFooter** updated: footer now carries `mx-auto max-w-7xl` so footer text centers within the same 1280px band as the navbar and `<main>`. **Page-width standardization** per §8.2: `UserDetail` and `UserSelfProfile` (was `max-w-3xl`) + `About` and `VerifyCredential` (was `max-w-3xl`) bumped to `max-w-4xl` so all detail/settings pages share the same reading width. **UserList table** wrapped in `<div className="overflow-x-auto">` so the 4-column table (entity, role, wallet/status, actions) scrolls horizontally on narrow viewports instead of squishing columns past their `truncate max-w-[12rem]/[14rem]` limits. |
| v1.9    | 2026-08-27 | **Scroll-lock fix extended to `PublicLayout`.** Follow-up sweep after v1.8 found `VerifyCredential` (`/credentials/verify`, rendered by `PublicLayout`) mounts a Radix `Dialog` (`CredentialFileModal`, the file-preview expand button) while `PublicLayout` was still window-scrolling (`min-h-dvh`) — same latent shift the v1.8 fix eliminated for `OverviewLayout`, still live on this one public route. §8.1 `PublicLayout` row: container changed from `min-h-dvh` to `h-dvh overflow-y-scroll scrollbar-gutter-stable` with `id="main"` moved onto the root (was on `<main>`); `NavbarPublic`/`<main>`/`CopyrightFooter` all scroll together inside that one container — same visual behavior as before (none of the three was ever sticky), window just no longer scrolls independently. `useScrollToTop` needed no change (`getElementById("main")` still resolves). §5.3 caveat updated: guard now covers `OverviewLayout` and `PublicLayout`; `SplitLayout` was already `h-dvh overflow-hidden` so it was never exposed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| v1.8    | 2026-08-27 | **Scroll-lock layout-shift fixed for real.** The `body[data-scroll-locked]` margin/padding-zeroing guard (v1.4-era) never neutralized `react-remove-scroll`'s `overflow: hidden !important` on `<body>`, which propagates to the viewport per CSS overflow-propagation rules and collapses the window scrollbar `<html>`'s `scrollbar-gutter: stable` was reserving — the actual cause of the ~12px shift on every Select/Dialog open (Role/Gender dropdowns, delete confirmations, credential search-create dialogs). §8.1 `OverviewLayout` row: container changed from `min-h-dvh` to `h-dvh overflow-hidden` (matches `SplitLayout`'s existing pattern), making `#main` the layout's sole scroll surface — the window no longer scrolls, so the body-lock has nothing to collapse. `html { scrollbar-gutter: stable }` and the `body[data-scroll-locked]` override removed from `styles/index.css` (dead once the window stopped scrolling). §5.3 guard paragraph rewritten with the real mechanism and a scoped caveat for `PublicLayout`/`SplitLayout` if a Select/Dialog is ever added there.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| v1.7    | 2026-08-26 | **§7.12 `UnitPicker` added** — hierarchical, indented, searchable unit selector, replacing the flat `<Select>` on the Create User form. Records the three load-bearing details: the trigger is a plain `<button type="button">` wearing `SelectTrigger`'s class list so it matches the `<Select>` fields beside it; the content uses `w-(--radix-dropdown-menu-trigger-width)` rather than a fixed width, which is what keeps a dropdown correct inside a `grid-cols-1 / md:grid-cols-2 / lg:grid-cols-3` form cell at every breakpoint (a fixed `w-56` is right only for a filter pill, which sits outside any grid); and the search input appears only past `SEARCH_THRESHOLD = 8`. Also records why `HolderUnitFilterMenu` is deliberately not built on it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| v1.6    | 2026-08-25 | **Height scale introduced.** §7.3 `Button` sizes carry an explicit `h-*` (`sm` 36px, `md` 44px, `lg` 48px) instead of vertical padding, and gain an `icon-mobile` 48px variant; §7.4 `Input` gains a `size` prop (`compact` 36px / `default` 44px) with the native `size` attribute omitted, and drops `py-3`. Sizes pair by name — `sm`+`compact`, `md`+`default` — so a row aligns by construction; the `items-stretch` / `h-full` / `sm:mt-6` workarounds are removed. §8.9 touch-target table restated in terms of the scale, plus a recorded deviation for `InlineCreateRow` (36px, admin-only, distinguishes it from the 44px search bar above). New `shared/components/InlineCreateRow.tsx` collapses the create form behind a dashed trigger; `ResourceAdminCreateForm` and `UserUnitTree` are both call sites, so the three reference admin pages and the unit tree now share one pattern.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

---

## Appendix A: Quick Reference Card

```
COLOR TOKENS
  navy    #0F172A   primary, sidebar, body text
  gold    #C9A227   accent, premium CTAs, focus ring
  base    #F8FAFC   page background
  surface #FFFFFF   card background
  error   #B91C1C   destructive, revoked

RADIUS
  rounded-xl    inputs, buttons
  rounded-2xl   cards, panels
  rounded-md    badges, pills
  rounded-full  avatars, search bars

SHADOWS
  shadow-sm                default cards
  shadow-md shadow-navy/20 primary buttons
  shadow-lg shadow-gold/20 gold buttons / metric cards
  shadow-xl                auth card

TYPOGRAPHY
  Hero            text-4xl font-extrabold tracking-tight
  Page title      text-2xl font-bold text-navy tracking-tight
  Card title      text-lg font-bold text-navy
  Body            text-sm
  Label           text-sm font-semibold text-gray-700
  Eyebrow         text-xs font-bold uppercase tracking-wider text-gray-500
  Mono            font-mono text-xs text-gray-500

CONTAINERS
  max-w-md   auth card
  max-w-3xl  detail views
  max-w-4xl  settings
  max-w-3xl  verification
  max-w-6xl  batch forms
  max-w-7xl  list/table views

VERTICAL RHYTHM
  space-y-6   page-level (default)
  space-y-4   sub-section
  space-y-1   label + input pair
```

---

_End of design system specification._
