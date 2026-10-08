# ITCS ERP

Internal ERP to replace and extend day-to-day commercial operations for ITCS (quotes, orders, invoices, purchasing, inventory, tenders, renewals, and reporting).

This document is the current project brief for status reviews and demos — written so anyone can follow progress without reading the code.

---

## 1. Meeting snapshot

| Item | Status |
|---|---|
| Approach | Modular monolith — one frontend, one API, one database |
| Live and tested | Identity / platform · Customers · Contacts · Products & Services · Resellers |
| Recently added | Confirmation popups before every Delete / Remove / Unassign |
| Next build candidates | Opportunities / Tenders, then Quotes → Orders → Invoices |
| Not started | Opportunities, tenders, quotes, sales, invoices, payments, purchasing, inventory, accounting, renewals |
| Code repository | https://github.com/infoITCS/itcs-erp |
| Local demo | Web http://localhost:5173 · API http://localhost:4000 |

**Bottom line:** The foundation and four business areas are working: Customers, Contacts, Products & Services, and Resellers. You can manage master data end to end. Selling and invoicing still need Quotes / Orders / Invoices (next after pipeline work).

---

## 2. Why this architecture

We are **not** building microservices, Firebase, MongoDB, or Next.js/NestJS for this product.

| Choice | Reason |
|---|---|
| Modular monolith | Faster delivery, one deploy, clear module boundaries |
| React + Vite frontend | Modern UI, shared forms/tables, fast local development |
| Node + Express + TypeScript API | Same language as the UI, simple REST contracts |
| PostgreSQL + Prisma | Relational integrity, migrations, UUID keys, decimal money |
| One module at a time | Each module is designed, approved, built, and tested before the next |

Every business module follows the same pattern: validation → service logic → repository → thin controller. Cross-module calls go through services, not another module’s database layer.

---

## 3. What is live today

### 3.1 Identity and platform (Phase 1)

Security and shared infrastructure that every later module reuses.

- Sign-in with short-lived access token + hashed refresh token
- Password hashing (bcrypt); passwords never stored in plain text
- Account lock after repeated failed logins; inactive / locked states
- Password reset support (hashed one-time tokens)
- Roles and permissions (`module:action`), e.g. `customers:read`, `products:write`, `resellers:read`
- Seeded roles: **Administrator** (full access) and **Viewer** (read-only)
- Organization (company) boundary: current company is **ITCS**; more companies can be added later without rewriting users
- Persistent **audit log**: who did what, on which record, old/new values, IP, user agent, time
- **Currencies** and **exchange rates** (decimal amounts only — never floating-point money)
- Reusable **document numbering** for customers, products, resellers, and future quotes, orders, invoices, etc.

### 3.2 Customers and contacts

First commercial master-data module. Built, migrated, seeded, and verified.

- Customers as **Company** or **Individual**
- Server-assigned customer numbers (example: `CUS-2026-00001`)
- Status: **Active** / **Inactive** (prospects belong to a future Opportunities module, not here)
- Email, phone, website, country, currency, tax number, notes
- Billing and shipping **addresses** (multiple allowed; one primary per purpose)
- Multiple **contacts** per customer; exactly one primary contact
- Soft delete and restore (history and future invoice links stay intact)
- List with search, filters, sorting, and cursor pagination
- Screens: list, create, edit, detail (addresses, contacts, activity/audit)

**Org-wide Contacts list:** a separate Contacts screen lists contacts across customers so staff can search and manage people without opening each customer first.

### 3.3 Products & Services

Catalog master data. Built, migrated, seeded, and verified.

- Product types: **Physical** and **Service**
- Codes / SKUs: manual or auto (example: `PRD-2026-00001`)
- Categories with optional parent (cycles are blocked)
- Separate **price rows** (sales / purchase), multi-currency, dated ranges — overlapping dates for the same type/currency are rejected
- Tax codes and units of measure
- Inventory flag for physical products only; services never track stock
- Soft delete; list with search and filters; detail with prices and audit

### 3.4 Resellers

Reseller partner master data. Built, migrated, seeded, and verified.

- Reseller profile (number, legal/display name, status, country, currency)
- Price list **code** and optional default discount / commission % (config only — no commission ledger yet)
- Addresses and reseller-specific contacts
- Link customers to a reseller (assign / unassign); one reseller per customer
- Soft delete; list, create, edit, detail with activity/audit
- **Not in this release:** reseller price tables, commission calculations, or sales documents

### 3.5 Safer deletes (UI)

Every Delete, Remove, and Unassign button opens a confirmation popup before anything is changed. Cancel leaves data untouched; confirm runs the soft-delete (or unassign) as before.

### 3.6 What you can demonstrate in a meeting

1. Sign in as administrator  
2. **Customers** — list, search, create, addresses, contacts, audit  
3. **Contacts** — org-wide list and remove (with confirm)  
4. **Products** — create product/service, categories, dated prices, delete with confirm  
5. **Resellers** — create reseller, addresses/contacts, assign a customer, unassign with confirm  
6. Show that money uses proper decimals (currencies / product prices)

---

## 4. What’s next

Recommended sequence after the live modules above:

| Priority | Module | Plain-English purpose |
|---|---|---|
| Next | Opportunities / Tenders | Pipeline before a formal quote |
| Then | Quotes → Sales Orders → Deliveries | Sell from customer + product |
| Then | Invoices → Payments | Bill and collect |
| Later | Purchasing, Inventory, Accounting, Renewals | Ops and finance depth |

**Financial rule already agreed:** posted invoices, payments, and accounting entries will not be edited in place. Corrections use reversal / new documents.

After Products + Customers + Resellers, the sales flow becomes: Customer (+ optional Reseller) → Product → Quote → Order → Invoice.

---

## 5. Roadmap (high level)

1. **Done** — Identity / platform  
2. **Done** — Customers & Contacts  
3. **Done** — Products & Services  
4. **Done** — Resellers (master data + customer link)  
5. **Next** — Opportunities / Tenders  
6. Quotes → Sales Orders → Deliveries  
7. Invoices → Payments  
8. Purchasing & Vendors  
9. Inventory  
10. Accounting & expenses  
11. Renewals (and deeper reseller commerce)  
12. Dashboard KPIs and Reports  

---

## 6. Security and control (for leadership)

- Role-based access on every API  
- Organization isolation on business data  
- Audit trail on create / update / delete / restore and key auth events  
- Admin password comes from environment variables — never hard-coded in source  
- Soft delete for master data so commercial history is preserved  
- Confirmation dialogs on destructive UI actions  
- Decimal types for all money and exchange rates  

---

## 7. How the team runs a local demo

Two terminals:

```bash
# API
cd backend
npm install
npx prisma generate
npx prisma migrate deploy
npm run prisma:seed
npm run dev
```

```bash
# Web
cd frontend
npm install
npm run dev
```

- Configure `backend/.env` from `.env.example` (database URL, JWT secrets, `ADMIN_EMAIL`, `ADMIN_PASSWORD`)  
- Web: http://localhost:5173  
- API health: http://localhost:4000/api/v1/health  
- Sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `backend/.env` (seeded account is typically `admin@itcs.local`)

Shared remote Postgres (e.g. Plesk/Hostinger) is optional for team consistency; each developer can also use local Postgres. Database passwords stay in `.env` only — never in GitHub.

---

## 8. Quality checks

```bash
cd backend && npm test && npm run lint
cd frontend && npm run lint && npx tsc -b
```

Automated tests cover platform auth/audit/currency rules plus Customers, Products, and Resellers (validation, permissions, soft delete, and key business rules such as price-date overlap and primary contacts).

---

## 9. Talking points / expected questions

| Question | Short answer |
|---|---|
| Is this production-ready end-to-end? | Foundation + Customers + Products + Resellers yes; full ERP no — by design, module by module |
| Can we sell / invoice today? | Not yet — needs Quotes / Orders / Invoices (and usually Opportunities first) |
| Will we lose history if we delete a record? | Soft delete; records remain for audit and future documents. UI also asks for confirm first |
| What about resellers? | Master data and customer assignment are live; commission ledgers and document pricing come later |
| Multi-company? | Ready in the data model; one company (ITCS) seeded today |
| Microservices later? | Possible later; not required now and would slow delivery |
| What’s the next ask? | Approve Opportunities / Tenders, then Quotes |

---

## 10. Repository

- GitHub: https://github.com/infoITCS/itcs-erp  
- Branch: `main`  
- Stack folders: `frontend/` (UI), `backend/` (API + Prisma + migrations)
