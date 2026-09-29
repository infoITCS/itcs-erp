# ITCS ERP

Modular monolith. Phase 1 covers identity, roles, audit logs, currencies, and document-number sequences. Sales, purchasing, inventory, accounting, and tender tables are not created yet.

## Run

```bash
cd backend
cp .env.example .env
npm install
npx prisma generate
npx prisma migrate dev
npm run prisma:seed
npm run dev
```

Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `backend/.env` before seeding. The seed reads the password from the environment and does not store it in source.

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

- Web: http://localhost:5173
- API: http://localhost:4000/api/v1/health

Sign in with `ADMIN_EMAIL` after the seed. The password is the `ADMIN_PASSWORD` value in `backend/.env`.
