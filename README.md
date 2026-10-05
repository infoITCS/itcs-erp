# ITCS ERP

Modular monolith for ITCS. One React app and one Express API. Business modules are added one at a time.

## Stack

- Frontend: React, TypeScript, Vite, React Router, TanStack Query, React Hook Form, Zod, Tailwind
- Backend: Node.js, Express, TypeScript, Prisma 7, Zod
- Database: PostgreSQL

The API base path is `/api/v1`. Successful responses use `{ success, data, message }`.

## Done so far

### Identity and platform

- Sign-in with a short-lived JWT and a hashed refresh token
- Account status: active, inactive, or locked after repeated failed logins
- Password reset tokens (hashed, one-time)
- Roles and permissions per organization
- One company record, ITCS, so later companies can be added without reshaping users
- Audit log for actor, action, module, entity, old and new values, IP, user agent, and time
- Currencies and organization exchange rates stored as decimals
- Document numbers for quotes, sales orders, invoices, purchase orders, bills, tenders, payments, renewals, and customers

Seeded roles are `admin` (full Phase 1 and customer access) and `viewer` (read-only).

### Customers and contacts

- Customers are companies or individuals, scoped to the signed-in organization
- Server-assigned customer numbers, such as `CUS-2026-00001`
- Status is active or inactive. A prospect is not a customer status; that stays with a future opportunities module
- Billing and shipping addresses, with one primary address per purpose
- Multiple contacts per customer, with one primary contact
- Soft delete and restore for customers and contacts
- Cursor-paginated list with search, status, type, country, currency, and date filters
- Customer screen: list, create, edit, detail, addresses, contacts, and activity

## Not built yet

Reseller, opportunities, quotes, sales orders, deliveries, invoices, payments, renewals, products, inventory, purchasing, and accounting have screens in the navigation only. Those tables do not exist. Posted financial documents are planned to be append-only, with corrections done by reversal.

## Run

Use two terminals.

```bash
cd backend
npm install
npx prisma generate
npx prisma migrate deploy
npm run prisma:seed
npm run dev
```

```bash
cd frontend
npm install
npm run dev
```

Copy `backend/.env.example` to `backend/.env` and `frontend/.env.example` to `frontend/.env` on a new machine. Set `DATABASE_URL` and `DIRECT_URL` to the local Postgres database (`erp_db` in the example). Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` (at least 12 characters) before seeding. The seed reads the password from the environment. It is not stored in source.

- Web: http://localhost:5173
- API health: http://localhost:4000/api/v1/health

Sign in with `ADMIN_EMAIL`. The password is `ADMIN_PASSWORD` in `backend/.env`. The seeded development account is `admin@itcs.local`. After a seed that adds permissions, sign in again so the access token includes them.

## Checks

```bash
cd backend
npm test
npm run lint
```

```bash
cd frontend
npm run lint
npx tsc -b
```
