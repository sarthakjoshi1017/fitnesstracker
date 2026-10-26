# FitTrack Pro

FitTrack Pro is a fitness and nutrition tracking app for people who want to understand their patterns, not just collect numbers. The product brings training, food logging, bodyweight trends, and explainable data-quality guidance into one responsive workspace.

> **Demo mode:** The first screen is intentionally populated with clearly labeled sample data so the product can be explored without an account or database. Demo edits are saved in this browser only. Create an account to use PostgreSQL-backed records.

## Product and users

**Problem:** Workout, nutrition, and bodyweight records are often scattered across separate apps or notebooks, making it hard to see the broader pattern.

**Target users:** Beginner and intermediate gym-goers, college students, and fitness enthusiasts who want a simple, evidence-aware place to track progress.

**Solution:** Log sessions, meals, and bodyweight; review recent history; and see transparent reminders when the available data is still incomplete.

## Implemented workflows

- Browse a responsive dashboard with a weekly activity summary, food intake, macro totals, and weight trend.
- Record workouts and bodyweight with client-side validation and success/error feedback. Food logging asks for a food and quantity, then scales the reference calories and macros automatically; custom foods can be entered per serving.
- Filter workout history and nutrition entries; search workouts and curated meal ideas.
- Build a meal from a curated set of familiar foods and log a chosen quantity to the nutrition diary. Nutrition values are approximate.
- Review bodyweight history and complete/dismiss local insight cards.
- Register and sign in through the Express API. Authenticated workout, food, and weight entries are stored in PostgreSQL and scoped to the signed-in user.
- Use rule-based backend helpers for session volume, Epley estimated 1RM, moving averages, starting calorie estimates, plateau checks, and data-quality summaries.

The demo workspace is a browser-only demonstration. The app does not pretend those sample records belong to a newly registered user. An account with no records receives empty states.

## Technology

- **Client:** React, TypeScript, Vite, Tailwind CSS, React Router, Chart.js / react-chartjs-2, Lucide React.
- **API:** Node.js, TypeScript, Express, Zod, Helmet, CORS, bcryptjs, server-side sessions.
- **Database:** PostgreSQL with Prisma ORM and versioned SQL migrations.
- **Tests:** Node's built-in test runner through `tsx`.

## Architecture

```text
React/Vite client
  ├─ Dashboard and tracking pages
  ├─ Demo data stored in browser localStorage
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
cp .env.example .env
```

Set a private PostgreSQL `DATABASE_URL` and a random `SESSION_SECRET` of at least 32 characters in `.env`. Then initialize and start the app:

```sh
npm run db:generate
npm run db:migrate
npm run dev:all
```

The client starts at `http://localhost:5173`; the API listens on `http://localhost:3001`. To run only the UI, use `npm run dev`. Demo mode remains available without a database or API.

### Optional demo account seed

Set `DEMO_EMAIL` and a private `DEMO_PASSWORD` of at least 8 characters in `.env`, then run `npm run db:seed`. The script creates missing demo records and does not reset existing demo-account credentials or duplicate the same starter records on subsequent runs.

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

Keep `.env` private. Only `.env.example` belongs in source control.

## API overview

All API routes are under `/api`.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | API health check |
| `POST` | `/auth/register` | Create account |
| `POST` | `/auth/login` | Start a session |
| `POST` | `/auth/logout` | Revoke the browser session cookie |
| `GET` | `/auth/me` | Current user and profile |
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
- **Meal ideas:** The UI uses a curated starter list and clearly treats nutrients as estimates.

## Quality checks

```sh
npm run build
npm run typecheck:api
npm run typecheck:seed
npm test
npm run lint
```

## Deployment notes

Deploy the Vite build as a static site and the compiled API (`server/dist/index.js`) as a Node service with a managed PostgreSQL database. Configure `DATABASE_URL`, `SESSION_SECRET`, `CLIENT_URL`, `SERVER_PORT`, `NODE_ENV`, and `VITE_API_URL` in the respective hosting environments. Run `npm run db:generate` during the build and `npx prisma migrate deploy` as a release step. A public deployment and demo-video link can be added here once provisioned.

## Scope and limitations

This is a working end-term MVP, not a claim that every optional feature in the project brief is complete. It currently does not include password reset, refresh tokens, photo uploads, PDF reports, external food APIs, full exercise-library/set-entry UI, meal saving, recovery journals, calendar scheduling, or scenario simulation. Insights emphasize data quality and consistency; the broader nutrition, plateau, and report calculations are not yet wired into dashboard recommendations. Demo-mode changes are browser-local; authenticated records use PostgreSQL.
