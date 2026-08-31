# OCA

OCA is a multi-tenant university learning platform built with Next.js 15,
React 18, Prisma 6, and PostgreSQL. It includes role-scoped workspaces for
platform administrators, institution administrators, professors, and students.

## Requirements

- Node.js 20 LTS or a compatible Vercel runtime
- npm
- PostgreSQL; Neon pooled and direct connection URLs are supported

Do not upgrade Next.js, React, or Prisma without a separate compatibility run.
The versions in `package.json` are intentionally pinned.

## Local setup

```bash
npm ci
copy .env.example .env
npx prisma generate
npx prisma migrate deploy
npm run db:seed
npm run dev
```

On macOS/Linux, use `cp .env.example .env`. Fill in the database URLs and a
development `AUTH_SECRET` before running Prisma or the application.

## Environment variables

| Variable         | Requirement                    | Purpose                                                                                          |
| ---------------- | ------------------------------ | ------------------------------------------------------------------------------------------------ |
| `DATABASE_URL`   | Required                       | Application PostgreSQL connection; use the pooled Neon URL in serverless deployments.            |
| `DIRECT_URL`     | Required by the current schema | Direct PostgreSQL connection used by Prisma Migrate.                                             |
| `AUTH_SECRET`    | Required in production         | Signs the HttpOnly session cookie. Use a long random value and keep it stable.                   |
| `OPENAI_API_KEY` | Optional                       | Enables server-side teaching insights and quiz-draft generation. Never expose it to the browser. |
| `OPENAI_MODEL`   | Optional                       | Overrides the OpenAI model. Defaults to `gpt-4.1-mini`.                                          |
| `SEED_PASSWORD`  | Optional                       | Password assigned to seeded demo accounts. Use an explicit value outside local development.      |

AI routes fail gracefully when `OPENAI_API_KEY` is absent. `AUTH_SECRET` has a
development-only fallback, but the application refuses to use that fallback in
production.

## Database workflow

Create migrations only against a safe development database:

```bash
npm run db:migrate
```

Apply already committed migrations in demos, CI, and production:

```bash
npm run db:deploy
npx prisma migrate status
```

Never run `prisma migrate reset` against a shared, demo, or production database.
The seed is idempotent for its stable demo records and is run explicitly with:

```bash
npm run db:seed
```

## Demo accounts

The seed provisions these accounts:

- `superadmin@oca.africa`
- `admin@universite-test.oca.africa`
- `professeur@universite-test.oca.africa`
- `etudiant@universite-test.oca.africa`

Their password is the value of `SEED_PASSWORD`. For local development only,
the seed falls back to `Oca2026!`; set an explicit non-default value for any
shared demo or deployed environment.

## Course Studio test dataset

Do not test destructive flows on real course content. Publishing, unpublishing,
clearing a section and AI generation all overwrite data in place, and there is
no content versioning: an interrupted run can leave a real lesson published or
emptied.

Use the dedicated demo dataset instead:

```bash
npm run seed:studio-test
```

It creates a separate institution (`demo-studio`), so isolation comes from the
existing multi-tenant scoping rather than from discipline: the demo professor
cannot reach real courses, and real accounts cannot reach the demo course.

| Account | Role |
| --- | --- |
| `prof.demo@demo-studio.oca.africa` | professor, assigned to the demo course |
| `etudiant.demo@demo-studio.oca.africa` | student, enrolled in the demo semester |
| `admin.demo@demo-studio.oca.africa` | institution admin |

Passwords follow `SEED_PASSWORD`, as for the main seed.

Course to use: **TEST-COURSE-STUDIO**, shown as `DEMO - Cours de test Course
Studio`. Course Studio displays an amber banner for any course whose code starts
with `TEST-` or `DEMO-`. The dataset deliberately covers the cases worth
testing: a strong published structured lesson, a weak draft lesson (which
triggers the publish confirmation), a plain-text lesson (editor fallback), a
published lesson inside a draft module (hidden from students), a published quiz
and an empty draft quiz.

The script is idempotent and re-runnable: it upserts the institution, accounts
and academic structure, then deletes and recreates the modules, lessons and
quizzes **of that course only**. It never touches other courses, users, audit
logs or `AIGeneration` records.

To prove real content was untouched, fingerprint COMPTA-101 and MICRO-101 before
and after any test session:

```bash
npx tsx scripts/check-demo-isolation.ts
```

## Verification

```bash
npx prisma validate
npx prisma migrate status
npm run build
npm run smoke:rbac
git diff --check
```

Run the smoke suite against a built test server by setting `SMOKE_BASE_URL` and
`SMOKE_PASSWORD` (or `SEED_PASSWORD`). It performs read-only auth, redirect,
RBAC, and tenant-scope checks using the seeded demo accounts.

The product has no official-grade or examination workflow. Quiz results are
learning feedback, and AI output is advisory or saved as an unpublished draft.

## Vercel and Neon deployment

1. Create a Neon database and retain both pooled and direct connection strings.
2. Configure all required variables in Vercel; mark secrets as sensitive.
3. Use the pooled URL for `DATABASE_URL` and the direct URL for `DIRECT_URL`.
4. Set `AUTH_SECRET` before the first deployment and do not rotate it casually.
5. Apply committed migrations with `npm run db:deploy` from a controlled release
   step before serving traffic. Do not run development migrations at build time.
6. Keep `OPENAI_API_KEY` unset if AI features are not required.
7. Run `npm run build` and role-based smoke tests against a non-production tenant
   before promoting the deployment.

The current session guard uses signed cookies without a shared session store.
Vercel instances must therefore share the same `AUTH_SECRET`.
