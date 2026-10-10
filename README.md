# MMM-CabinStats

[![CodeQL](https://github.com/ismarslomic/MMM-CabinStats/actions/workflows/codeql.yml/badge.svg)](https://github.com/ismarslomic/MMM-CabinStats/actions/workflows/codeql.yml)
[![ESLint](https://github.com/ismarslomic/MMM-CabinStats/actions/workflows/eslint.yml/badge.svg)](https://github.com/ismarslomic/MMM-CabinStats/actions/workflows/eslint.yml)
[![ESLint](https://github.com/ismarslomic/MMM-CabinStats/actions/workflows/build.yml/badge.svg)](https://github.com/ismarslomic/MMM-CabinStats/actions/workflows/build.yml)
[![E2E tests](https://github.com/ismarslomic/MMM-CabinStats/actions/workflows/e2e-tests.yml/badge.svg)](https://github.com/ismarslomic/MMM-CabinStats/actions/workflows/e2e-tests.yml)
[![Unit tests](https://codecov.io/gh/ismarslomic/MMM-CabinStats/branch/main/graph/badge.svg)](https://codecov.io/gh/ismarslomic/MMM-CabinStats)

> [MagicMirror²](https://magicmirror.builders) module that shows live cabin stats and fun facts for the guests: who is
> at the cabin now, how many visits it is for each of them, who comes next, and rotating fun facts. Written in
> TypeScript.
>
> The module needs a compatible backend. It only fetches, selects, rotates and renders; all fact texts are computed
> by the backend. See [Backend API](#backend-api).

## What it shows

- **Occupied**: heading, stay dates and nights left, round guest avatars with first name and "besøk nr. X", a gold
  badge for the top visitor, a highlighted ring and label for first-time guests, one rotating guest fun fact, the
  next visit (dimmed, small avatars) and a rotating cabin fact.
- **Not occupied**: "Neste besøk om N dager" with dates, small avatars and a fun fact, the all-time totals (visits,
  nights, guests) and a rotating cabin fact. Without a next reservation only the totals and cabin facts show.
- **Missing or invalid `apiBaseUrl`**: a short config error. Nothing is fetched.
- **Backend unreachable**: the last good data stays on screen; nothing shows if data was never loaded. Errors are
  logged and polling continues.

Each instance of the module keeps its own data, so you can show several cabins side by side.
UI labels are Norwegian (`translations/nb.json`, also the fallback for other languages); fun fact texts come from the
backend as-is.

## Installing the module

1. Navigate to the `MagicMirror/modules` directory and execute the following command

   ```sh
   git clone https://github.com/ismarslomic/MMM-CabinStats.git
   ```

2. Change into the `MMM-CabinStats` module folder and install runtime dependencies with
   ```sh
   cd MMM-CabinStats
   npm run install:dep
   ```

## Using the module

Add the following block to the modules array in `config/config.js`. Only `apiBaseUrl` is required:

```js
var config = {
  modules: [
    {
      module: 'MMM-CabinStats',
      position: 'top_left',
      config: {
        apiBaseUrl: 'http://backend.example:8080',
      },
    },
  ],
}
```

### Options

| Option              | Default  | Behavior                                                                                 |
| ------------------- | -------- | ---------------------------------------------------------------------------------------- |
| `apiBaseUrl`        | none     | **Required.** Base url of the backend, `http` or `https`. A trailing slash is tolerated. |
| `updateInterval`    | `600000` | Milliseconds between requests (the data changes slowly).                                 |
| `requestTimeout`    | `10000`  | Milliseconds before a backend request is aborted.                                        |
| `guestFactInterval` | `18000`  | Milliseconds between guest fun facts (15–20 s works well).                               |
| `cabinFactInterval` | `45000`  | Milliseconds between cabin fun facts (30–60 s works well).                               |
| `display`           | `full`   | `full`, `stats` (no guest or cabin facts) or `facts` (only those facts). See below.      |
| `guestView`         | `true`   | Tapping a guest avatar opens a full-screen view for that guest. See below.               |
| `guestViewTimeout`  | `60000`  | Milliseconds without touch before the guest view closes by itself.                       |
| `showNextVisit`     | `true`   | Show the upcoming reservation.                                                           |
| `showCabinFacts`    | `true`   | Show the cabin fun facts.                                                                |
| `pauseWhenHidden`   | `false`  | Stop polling and rotation in `suspend()` and fetch fresh data immediately in `resume()`. |
| `animationSpeed`    | `1000`   | Milliseconds of the fade when the content changes.                                       |

To show the facts at another position than the rest, add the module twice, with the same `apiBaseUrl`:

```js
var config = {
  modules: [
    {
      module: 'MMM-CabinStats',
      position: 'top_left',
      config: { apiBaseUrl: 'http://backend.example:8080', display: 'stats' },
    },
    {
      module: 'MMM-CabinStats',
      position: 'lower_third',
      config: { apiBaseUrl: 'http://backend.example:8080', display: 'facts' },
    },
  ],
}
```

Each instance polls the backend and rotates the facts on its own.

### Guest view

On a touch screen, tapping a guest avatar opens a full-screen view that covers all other modules, with a close button
(✕). It also closes with Escape, and after `guestViewTimeout` without touch. The stats of the guest are fetched once
when the view opens (`GET /api/stats/guests/{guestId}`) and are not refreshed while it is open. Avatars of the ongoing
and the next reservation are tappable; set `guestView: false` to turn this off. The view currently shows a
placeholder, because the backend endpoint returns an empty object for now.

Invalid values fall back to the defaults, except `apiBaseUrl`, which has no default. Repeated start or resume calls
never create duplicate timers. There are no API keys: the backend has no authentication.

### Troubleshooting

- **"MMM-CabinStats: sett apiBaseUrl i config.js"**: `apiBaseUrl` is missing or not an absolute http (s) url.
- **Nothing shows**: the backend has never answered. Check the MagicMirror log for `could not load live stats`; it
  names the cause (network error, timeout, non-2xx status, invalid JSON, or a response that does not match the
  contract).
- **Initials instead of photos**: the browser showing the mirror must reach `apiBaseUrl` directly, because avatars
  are plain `<img>` tags pointing at `apiBaseUrl` plus the guest's `avatarUrl`. Data is fetched by the MagicMirror
  server, avatars by the browser.

## Backend API

The module calls `GET {apiBaseUrl}/api/stats` and expects the live stats object: `isOccupied`, `currentReservation`
(with `guests` and `remainingNights`), `nextReservation` (with `guests` and `daysUntil`), `allTimeVisits`,
`allTimeNights`, `allTimeUniqueGuests`, and the fact lists `guestFunFacts`, `cabinFunFacts` and `nextVisitFunFacts`.
Dates are `YYYY-MM-DD` strings. Each guest has `guestId`, `firstName`, `lastName`, `avatarUrl` (nullable, fetched with
`GET {apiBaseUrl}{avatarUrl}`), `isFirstVisit` and `allTime.totalVisits` / `allTime.visitsRank`.

When a guest avatar is tapped, the module also calls `GET {apiBaseUrl}/api/stats/guests/{guestId}` once. The response is
an empty object for now.

The full contract is the OpenAPI spec [`openapi/cabin-visits.json`](openapi/cabin-visits.json). The TypeScript types in
`src/types/api.generated.ts` are generated from it, and `src/types/LiveStats.ts` adds a runtime guard that rejects
responses that do not match.

To update the contract, copy the new spec from the backend to `openapi/cabin-visits.json`, run `npm run generate:api`,
fix any compile errors, and commit the generated file with the bundles. `npm run check:generated` fails if either is
stale.

## Development

1. Clone the repository and select Node.js 24 (`nvm use` reads `.nvmrc`)
2. Install the dependencies with `npm ci`
3. Automatically recompile the _TypeScript_ files when they are changed with `npm run dev:watch` or run
   explicitly with `npm run build`

The `pre-commit` hook only lints and formats staged files. It hides unstaged edits while rebuilding and staging the
JavaScript bundles for TypeScript changes. Hooks are skipped in CI and production installs without development
dependencies.

Note! `pre-commit` hook is configured to run _eslint_, _prettier_ and _build_ before committing the changes to git,
see [lint-staged](lint-staged.config.mjs) and [husky pre-commit](.husky/pre-commit) configuration files.

### Temporary dependency overrides

A scoped npm override keeps deprecated packages out of the development install while preserving SARIF reporting:

- `@microsoft/eslint-formatter-sarif` uses the project's ESLint version through `$eslint` instead of installing
  end-of-life ESLint 8. Remove this override when the formatter supports the project's ESLint version in its dependency
  or peer dependency range.

When changing the override, run `npm ci`, lint reporting, and unit tests with coverage. Check that the lockfile contains
no deprecated packages and that coverage still includes the same source files.
See [issue #792](https://github.com/ismarslomic/MMM-CabinStats/issues/792) for the investigation.

### Linting and formatting

```bash
npm run lint
npm run lint:css
npm run prettier
```

### Verify distributed JavaScript

The bundles and sourcemaps are checked in so users can install without development tools. Run `npm run build` and commit
the generated files with TypeScript changes. `npm run check:generated` rebuilds and fails if the checked-in output is
stale; CI runs the same check.

Rollup emits readable JavaScript without Terser minification so module authors can inspect the installed code and
runtime stack traces. The frontend remains a UMD bundle using MagicMirror's `Log` global, the helper remains CommonJS
with external `node_helper` and `logger` dependencies, and both keep sourcemaps.

### Run unit tests locally

```bash
npm run test:unit
npm run test:unit:coverage
```

Unit tests use Vitest with explicit imports, TypeScript module aliases for MagicMirror mocks, and V8 coverage. This
replaces Jest and ts-jest without a separate test compiler configuration. The built CommonJS helper is also executed
with mocked MagicMirror dependencies to catch bundler interop errors. Separate `npm run typecheck` remains required
because Vitest does not typecheck tests.

Coverage includes `src/**/*.ts` and produces `coverage/lcov.info` for Codecov. The built-in GitHub Actions reporter
annotates failures, and the JUnit report is uploaded as an Actions artifact. The Jest-specific coverage override is no
longer needed.

### Run e2e tests locally

E2E tests run the newly built module against MagicMirror 2.38.0 using Node.js 24 and Playwright Chromium. A small mock
backend (`__tests__/e2e/mock-backend.mjs`, port 8081) serves the fixtures in `__tests__/fixtures`: the first path
segment of `apiBaseUrl` selects the scenario, and `POST /{scenario}/control/down` or `/up` simulates an outage.
`__tests__/e2e/mm/config.js` runs five instances (occupied, compact, config error, guest without avatar, flaky
backend). Playwright starts both servers, waits for readiness and stops them after the tests; locally it can reuse
running servers. Specs locate elements with `getByRole`, so the template must keep semantic elements and accessible
names.

To run locally, place a MagicMirror 2.38.0 checkout in `MagicMirror/`, install its server dependencies with
`npm ci --omit=dev --omit=optional`, build and install this module in `MagicMirror/modules/MMM-CabinStats`, and copy
`__tests__/e2e/mm/config.js` to `MagicMirror/config/config.js`. Then install the test browser and run:

```bash
npx playwright install chromium
npm run test:e2e
```

Use `npx playwright show-report` to open the HTML results. CI uploads the report and retains traces and screenshots for
failed tests. This replaces the Cypress-specific CI action with the same npm command used locally.

### Codecov integration in Github actions

Add **Repository secret** in your Github repository with name `CODECOV_TOKEN` and a
secret value from your [codecov.io](https://app.codecov.io/gh) account.
