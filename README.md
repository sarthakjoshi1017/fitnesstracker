# FitTrack Pro

FitTrack Pro is a fitness and nutrition tracking app for people who want to understand their patterns, not just collect numbers. Its frontend and backend are separate npm workspaces: `frontend/` contains the React/Vite client, while `backend/` contains the Express API and PostgreSQL/Prisma layer.

> **Authentication required:** Every app route requires a signed-in account. On startup, FitTrack Pro checks the server for an existing session; otherwise it shows the sign-in/create-account screen. Fitness records are loaded from PostgreSQL and scoped to the authenticated user.

## Product and users

**Problem:** Workout, nutrition, and bodyweight records are often scattered across separate apps or notebooks, making it hard to see the broader pattern.

**Target users:** Beginner and intermediate gym-goers, college students, and fitness enthusiasts who want a simple, evidence-aware place to track progress.

**Solution:** Log sessions, meals, and bodyweight; review recent history; and see transparent reminders when the available data is still incomplete.

## Implemented workflows

- Browse a responsive dashboard with a weekly activity summary, food intake, macro totals, and weight trend.
- Record workouts, targeted muscles, direct working sets, soreness, and an optional tracked top set; record bodyweight with client-side validation and success/error feedback. Food logging asks for a food and quantity, then scales the reference calories and macros automatically; custom foods can be entered per serving.
- Filter workout history and nutrition entries; search workouts and curated meal ideas.
- Build a meal from a curated set of familiar foods and log a chosen quantity to the nutrition diary. Nutrition values are approximate.
- Review bodyweight history and complete/dismiss local insight cards.
- Review a 3D-style muscle-load map, weekly set counts, soreness signals, and same-lift estimated-strength changes. Explore editable 4-, 8-, and 12-week calorie, training-frequency, attendance, and protein scenarios in the Fitness Time Machine.
- Register or sign in through the Express API before accessing any app page. Sessions are restored securely on reload; workout, food, and weight entries are stored in PostgreSQL and scoped to the signed-in user.
- Use rule-based backend helpers for session volume, Epley estimated 1RM, moving averages, starting calorie estimates, plateau checks, and data-quality summaries.

An account with no records receives empty states. Signing out returns to the authentication screen; no dashboard or sample fitness data is shown while signed out.

## Project structure

```text
frontend/
  src/                    React application and client-side fitness rules
  tests/                  Frontend and shared-logic tests
  public/                 Static browser assets
  package.json            Frontend dependencies and scripts
backend/
  src/                    Express API, authentication, and server logic
  prisma/                 Database schema, migrations, and seed script
  package.json            Backend dependencies and database scripts
  .env                    Local backend and Vite configuration (not committed)
package.json              Workspace commands for running both applications
```

Run `npm install` once at the repository root to install both workspace packages.

## Technology

- **Client:** React, TypeScript, Vite, Tailwind CSS, React Router, Chart.js / react-chartjs-2, Lucide React.
- **API:** Node.js, TypeScript, Express, Zod, Helmet, CORS, bcryptjs, server-side sessions.
- **Database:** PostgreSQL with Prisma ORM and versioned SQL migrations.
- **Tests:** Node's built-in test runner through `tsx`.

## Architecture

```text
React/Vite client
  ├─ Dashboard and tracking pages
  ├─ Authentication gate and session restoration
  └─ Authenticated requests using an HttpOnly session cookie
       ↓
Express REST API (/api)
  ├─ Input validation and authentication middleware
  ├─ User-scoped record queries and fitness rules
  └─ Prisma client
       ↓
PostgreSQL
  ├─ users, profiles, sessions, goals
  ├─ workouts, workout sets
  ├─ meal entries, bodyweight logs
  └─ persisted fitness insights and actions
```

## Local setup

Requirements: Node.js 20.19+ and PostgreSQL 14+.

```sh
npm install
cp backend/.env.example backend/.env
```

For a local PostgreSQL server on macOS, install and start PostgreSQL, then create the app database:

```sh
brew install postgresql@16
brew services start postgresql@16
createdb fittrack_pro
```

Set `DATABASE_URL` to your PostgreSQL connection and set `SESSION_SECRET` to a private random value (generate one with `openssl rand -hex 32`) in `backend/.env`. The `CLIENT_URL` and `VITE_API_URL` values must match the browser host you use (`localhost` or `127.0.0.1`). Then initialize and start the app:

```sh
npm run db:generate
npm run db:migrate
npm run dev:all
```

The client starts at `http://127.0.0.1:5173`; the API listens on `http://127.0.0.1:3001`. The API and configured database are required to register or sign in. The client can be started separately with `npm run dev`, but it will remain at the authentication screen until the API is available.

### Optional demo account seed

Set `DEMO_EMAIL` and a private `DEMO_PASSWORD` of at least 8 characters in `backend/.env`, then run `npm run db:seed`. The script creates missing demo records and does not reset existing demo-account credentials or duplicate the same starter records on subsequent runs.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | Random signing key; minimum 32 characters |
| `CLIENT_URL` | Exact browser origin allowed by CORS |
| `SERVER_PORT` | API port (default `3001`) |
| `NODE_ENV` | Use `production` to enable secure cookies |
| `DEMO_EMAIL` | Optional seed account email |
| `DEMO_PASSWORD` | Optional seed account password; never commit a real value |
| `VITE_API_URL` | Optional client API base URL (default `http://localhost:3001/api`) |

Keep `backend/.env` private. Only `backend/.env.example` belongs in source control.

## API overview

All API routes are under `/api`.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | API health check |
| `POST` | `/auth/register` | Create account |
| `POST` | `/auth/login` | Start a session |
| `POST` | `/auth/logout` | Revoke the browser session cookie |
| `GET` | `/auth/me` | Current user and profile |
| `GET` | `/foods/search?q=...` | Rate-limited search of Open Food Facts product data |
| `GET` | `/dashboard` | Profile, active goal, recent workouts, today's meals, recent weights |
| `GET`, `POST` | `/workouts` | Read and record user workouts |
| `GET`, `POST` | `/meals` | Read and record daily food entries |
| `GET`, `POST` | `/measurements/bodyweight` | Read and record bodyweight |
| `GET` | `/insights` | Generate/retrieve data-quality observations |
| `PATCH` | `/insights/:id/status` | Accept, dismiss, or complete an insight |
| `PATCH` | `/profile` | Update profile and active fitness goal |

Session cookies are opaque, HttpOnly, short-lived, SameSite strict, and Secure in production. Session tokens are HMAC-hashed in PostgreSQL and revoked on logout. Configure the client and API on the same site in production, set `CLIENT_URL` to the exact client origin, and terminate TLS at the hosting provider.

## Fitness rules and assumptions

- **Training volume:** Sum of `weight × repetitions` across logged sets. An estimated 1RM uses Epley (`weight × (1 + reps / 30)`) and is only returned for 1–12 repetitions.
- **Weight trend:** Trailing averages use actual measurements only; no values are interpolated for missing days.
- **Calorie estimate:** Mifflin–St Jeor basal metabolic rate with an activity multiplier, then a modest goal adjustment (+200 kcal for gain, −300 kcal for loss). It is a starting estimate, not medical advice.
- **Plateau signal:** Requires at least five comparable sessions and compares the average estimated strength of the first two and last two sessions. A change within ±2% is described as a possible plateau, not a diagnosis.
- **Data quality:** A completeness indicator describes logged history volume. It is not a scientifically validated confidence score.
- **Muscle intelligence:** Weekly counts include explicitly logged direct working sets only; older focus-only workouts are not guessed. Recovery suggestions combine logged sets, days since training, self-reported soreness, and same-lift Epley estimates. The broad 6–18-set planning reference is not medical advice.
- **Fitness Time Machine:** Uses a static 7,700 kcal/kg energy-balance approximation with conservative, typical, and optimistic adherence factors. It assumes the entered maintenance estimate and training pattern persist, and does not model individual adaptation or predict physique.
- **Meal ideas and food logging:** Suggested meals include ingredients and preparation steps. The food logger searches Open Food Facts through the API server for complete per-100 g nutrition records; community data may be incomplete or inaccurate. You can also add any food by entering its name, serving size, and label nutrition, then reuse it from **My saved foods**. Custom food definitions are stored in the current browser, including when logged into an account. The API server must be running for external food search.

## Quality checks

```sh
npm run build
npm run typecheck:api
npm run typecheck:seed
npm test
npm run lint
```

## Deployment notes

Deploy the Vite build from `frontend/dist` as a static site and the compiled API (`backend/dist/index.js`) as a Node service with a managed PostgreSQL database. Configure `DATABASE_URL`, `SESSION_SECRET`, `CLIENT_URL`, `SERVER_PORT`, `NODE_ENV`, and `VITE_API_URL` in the respective hosting environments. Run `npm run db:generate` during the build and `npm run db:deploy` as a release step. A public deployment and demo-video link can be added here once provisioned.

## Scope and limitations

This is a working end-term MVP, not a claim that every optional feature in the project brief is complete. It currently does not include password reset, refresh tokens, photo uploads, PDF reports, a full exercise-library/set-entry UI, meal saving, recovery journals, or calendar scheduling. Food search depends on the public Open Food Facts service and its available product data; it does not guarantee a match for every food. Insights emphasize data quality and consistency; the broader nutrition, plateau, and report calculations are not yet wired into dashboard recommendations. Custom food definitions remain browser-local; authenticated workout and muscle-history records use PostgreSQL.
