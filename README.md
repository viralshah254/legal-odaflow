# Legal by OdaFlow - Frontend Only

A world-class Legal CRM UI built with Next.js (App Router), TypeScript, TailwindCSS, and shadcn/ui.

## Features

- **Client-First Design**: Client profile is the hub for everything
- **Never Miss Deadlines**: Strong alerts and notifications UI
- **Work Queues**: Smart queues surface what needs attention
- **Templates/Playbooks**: Matter types auto-suggest tasks/docs/KYC
- **Approvals UI**: Trust disbursement, document, and invoice approvals
- **RBAC UI Gating**: Screens/actions hidden/disabled based on role

## Tech Stack

- **Next.js 14** (App Router)
- **TypeScript**
- **TailwindCSS v4**
- **shadcn/ui** components
- **Zustand** for state management
- **React Hook Form + Zod** for forms
- **TanStack Table** for data tables
- **Mock API** layer with simulated delays

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Run the development server:
```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Demo Credentials

- Email: `john.doe@lawfirm.com`
- Password: `password`

## Project Structure

```
/app
  /app          # Main application pages
  /auth         # Authentication pages
  /portal       # Client portal pages
  /superadmin   # Super admin pages
/components
  /ui           # shadcn/ui components
/lib
  mock-api.ts   # Mock API services
  mock-data.ts  # Mock data
  store.ts      # Zustand stores
  types.ts      # TypeScript types
  utils.ts      # Utility functions
```

## Mock Data

The application uses mock data and API services that simulate real API calls with delays (300-800ms). All data is stored in memory and resets on page refresh.

## Key Pages

- **Dashboard** (`/app`) - Overview with summary cards and work queues
- **Clients** (`/app/clients`) - Client list, create, and detail pages
- **Matters** (`/app/matters`) - Matter management
- **Tasks** (`/app/tasks`) - Task management with filters
- **Invoices** (`/app/accounting/invoices`) - Invoice management
- **Trust** (`/app/trust`) - Trust account management
- **Settings** (`/app/settings`) - Firm settings

## Command Palette

Press `Cmd+K` (Mac) or `Ctrl+K` (Windows/Linux) to open the command palette for quick navigation.

## Notes

- This is a **frontend-only** application with no backend
- All API calls are mocked with artificial delays
- Data persists only during the session (resets on refresh)
- Authentication is mocked (no real auth)
- File uploads store metadata only (no actual file storage)

# legal-odaflow



