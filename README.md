# HR Management System

A mobile-first, fully Arabic (RTL) Human Resources Management System (HRMS) for small and medium organizations. It covers the complete employee lifecycle: records, attendance, leave, payroll, and analytics — with role-based access control and branch-level data isolation.

## Features

The application is organized into seven modules:

| Module | Description |
| --- | --- |
| Dashboard | Key indicators: headcount, today's attendance, pending leave requests, payroll summary. |
| Employees | Employee directory with search, filters, and a three-step creation form (job data, personal data, financial data). |
| Attendance | Daily check-in/check-out records, absence tracking, and automatic unjustified-absence calculation. |
| Leave | Leave requests with approval workflow; approved leave is excluded from absence and payroll deductions. |
| Payroll | Salary components (basic salary, housing and transportation allowances, bonuses, deductions) and automatic net-pay calculation. |
| Reports | Aggregated HR analytics with optional AI-assisted report generation (server-side only). |
| Settings | Company profile, branches, departments, and user role management. |

## Tech Stack

- **React 19** + **TypeScript**
- **TanStack Start v1** (full-stack React framework: SSR + server functions)
- **TanStack Router v1** (file-based routing in `src/routes`)
- **Vite** as build tool
- **Tailwind CSS v4** with Radix UI / shadcn components
- **Supabase** — PostgreSQL, Auth, Row Level Security, storage

## Architecture

```
src/
  routes/                 File-based routes (pages and API endpoints)
    _authenticated/       Routes protected by the auth guard
    api/                  HTTP endpoints (webhooks, cron, public APIs)
  components/             Shared UI components and design-system primitives
  hooks/                  Reusable React hooks
  lib/                    Server functions and domain logic
  integrations/supabase/  Database client, auth middleware, generated types
supabase/
  migrations/             Versioned SQL migrations (schema, RLS, functions, triggers)
  complete_schema.sql     Consolidated reference schema
```

- `src/routeTree.gen.ts` is generated automatically by the router plugin — do not edit it manually.
- Server-only logic uses `createServerFn` from `@tanstack/react-start`, so API keys never reach the browser.

## Security Model

- Row Level Security is enabled on every public table, with explicit `GRANT` statements per role.
- Roles (`admin`, `operator`, `viewer`) are stored in a dedicated `user_roles` table and evaluated by a `SECURITY DEFINER` function, never on the profile record.
- Payroll data is restricted to administrators; operators and viewers are scoped to their own branch.
- All third-party API keys are read from server-side environment variables only.

## Getting Started

Requirements: Node.js 20+ and npm (or Bun).

```sh
git clone <repository-url>
cd <repository-name>
npm install
npm run dev
```

The development server runs at `http://localhost:8080`.

## Environment Variables

Create a `.env` file in the project root (see `.env.example`):

```
VITE_SUPABASE_URL=<your-project-url>
VITE_SUPABASE_PUBLISHABLE_KEY=<your-publishable-key>
VITE_SUPABASE_PROJECT_ID=<your-project-id>
```

Server-only secrets (never prefixed with `VITE_`) are configured in the hosting environment, for example `GEMINI_API_KEY` for AI-assisted reports.

## Database Setup

The full schema — tables, relationships, RLS policies, functions, triggers, and enum types — lives in `supabase/migrations/`. To provision a new database:

```sh
supabase link --project-ref <your-project-ref>
supabase db push
```

No secrets are stored in the migration files.

## Available Scripts

```sh
npm run dev      # start the development server
npm run build    # production build
npm run lint     # lint the codebase
```

## Internationalization

The interface is Arabic-first with full RTL support. Layout spacing uses logical Tailwind utilities (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`) so the UI adapts correctly to direction changes. All numerals are rendered in Latin digits (0–9) for consistency across locales.

## License

Proprietary. All rights reserved.
