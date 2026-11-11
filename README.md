# Lumina — Smart Streetlight Management System (SLMS)

A full-stack DBMS project built from `ER_Diagram-DBMS.png`. It has three parts:
- **Oracle 11g XE** for the database (tables, constraints, triggers, PL/SQL, views)
- a **Node.js + Express REST API**
- a **Next.js (React, JavaScript) frontend** in a black & pink theme

No Docker: everything runs against the Oracle XE already installed on the laptop (`C:\oraclexe`).

```
EndSem/
├── ER_Diagram-DBMS.png
├── database/          Phase 1 – Oracle schema, PL/SQL, seed data
│   ├── 00_create_user.sql   creates schema user SLMS (run as SYSDBA)
│   ├── 01_schema.sql        20 tables, 11 sequences, constraints, indexes
│   ├── 02_logic.sql         16 triggers, 3 functions, 2 procedures, 15 views
│   ├── 03_seed.sql          Bengaluru demo data (48 poles, 288 energy logs, …)
│   ├── 99_verify.sql        sanity report
│   └── setup.ps1            one-command (re)build
├── backend/           Phase 2 – REST API (Express 5, node-oracledb 6, JWT)
└── frontend/          Phase 3 – Next.js 16 App Router UI
```

---

## Quick start

**Prerequisites:** Oracle XE 11g running (services `OracleServiceXE` and `OracleXETNSListener`), and Node.js 18 or newer.

**1. Database** (creates user `SLMS`, then builds and seeds everything; safe to re-run):
```bash
powershell -ExecutionPolicy Bypass -File database/setup.ps1
```
To rebuild only objects and data while keeping the user, add `-SkipUser`.

**2. API** on http://localhost:5000/api:
```bash
cd backend && npm install && npm run dev
```

**3. Frontend** on http://localhost:3000:
```bash
cd frontend && npm install && npm run dev
```

**4. Optional:** run the end-to-end API test (40 checks) while the API is running:
```bash
cd backend && npm run test:smoke
```

### Demo logins (password for all: `Password@123`)
| Username | Who | Sees |
|---|---|---|
| `admin` | Ananya Rao, ADMIN | everything, incl. user accounts |
| `karthik.menon` | Zone supervisor | ops + infrastructure write access |
| `suresh.kumar` | Technician | work orders, parts, energy readings |
| `vikram.shetty` | Accountant | billing, companies, spare parts |
| `sneha.k` | Support agent | complaints, civilians |
| `rohan.desai`, `fatima.sheikh`, `kavya.shenoy` | Citizens | citizen portal |
| `lumen`, `brightpath` | Contractor companies | contractor portal |

---

## Phase 1 — ER → relational mapping

| ER construct | Implementation |
|---|---|
| Strong entities (13) + weak entity ENERGY_LOG | One table each, with surrogate keys from **sequences + BEFORE INSERT triggers** (11g has no IDENTITY) |
| Composite attrs: Name, Address, Location | Flattened to columns (`first_name`…, `street/city/state/pincode`, `latitude/longitude`) |
| Multivalued attrs: email, phone_number, phone_no | Child tables `EMPLOYEE_EMAIL`, `EMPLOYEE_PHONE`, `CIVILIAN_EMAIL`, `CIVILIAN_PHONE`, `COMPANY_PHONE` |
| Derived attrs: age, work_experience, age_years, resolution_hours, total_cost | Computed in views `V_EMPLOYEE`, `V_STREETLIGHT`, `V_WORK_ORDER`, `V_SPARE_PARTS` (11g virtual columns can't use SYSDATE) |
| Weak entity ENERGY_LOG, identifying rel. *records* | PK `(pole_id, log_number)`, `ON DELETE CASCADE`; `log_number` allocated by `sp_record_energy` |
| HOMEPAGE (*logs_into / registers_on / accesses*) | Login table; an **exclusive-arc CHECK** ensures exactly one of `emp_id / citizen_id / license_no`, each `UNIQUE` (1 : 0..1) |
| 1:N relationships (employs, supervises, contains, located_in, powers, deployed_in, has, submits, receives, handles, scheduled_in, requires, resolves, assigned_to, executes) | FK on the "many" side |
| M:N *uses* (WORK_ORDER–SPARE_PARTS) | Junction table `WORK_ORDER_PART(quantity_used)` |
| *generates* (WORK_ORDER 1 : 0..1 BILLING) | `billing.work_order_id` FK + `UNIQUE` |

**Integrity:**
- **CHECK constraints** cover domains (status enums, Aadhaar `^[2-9]\d{11}$`, GSTIN format, pincode, lat/long ranges, money ≥ 0, completion ≥ created).
- **FK indexes** are created explicitly, because Oracle doesn't add them automatically.

**Triggers enforce what a constraint can't express:**
- An employee must be ≥ 18 at joining.
- A pole's feeder pillar must be in the same zone.
- A sensor's zone must match its pole.
- A new complaint flips its light to FAULTY.
- A work-order status change cascades to the streetlight (UNDER_MAINTENANCE / FUNCTIONAL, `last_serviced_date`) and to the complaint (ASSIGNED / IN_PROGRESS / RESOLVED).
- Adding or removing parts debits or credits stock, and raises `ORA-20010` when stock is insufficient.

**PL/SQL:**
- **Procedures:**
  - `sp_complaint_to_work_order` turns a complaint into a work order atomically, refusing duplicates.
  - `sp_record_energy` records a reading: it allocates the weak-entity key under a row lock and computes the cost.
- **Functions:** `fn_work_order_parts_cost`, `fn_zone_energy_cost`, `fn_years_since`.

## Phase 2 — REST API (`backend/`)

- **Thick mode, on purpose.** node-oracledb's Thin mode needs Oracle 12.1+, so the API loads XE's own 64-bit `oci.dll` (`ORACLE_CLIENT_LIB_DIR` in `.env`). It is pinned to **oracledb 6.x**, because 26.x refuses 11.2 client libraries.
- **Schema-driven.** At boot the API reads `USER_TAB_COLUMNS` and `USER_CONSTRAINTS`:
  - types and NOT NULLs come from the columns,
  - enums are parsed from `CHECK … IN (…)`,
  - numeric ranges are parsed from `BETWEEN` / `>=` checks,
  - FK targets come from the constraints.

  Input is validated exactly like Oracle will validate it, and `/api/meta` lets the UI build forms with no duplicated rules.
- **Safe SQL.** Every value is a bind variable. Identifiers come only from the dictionary-derived whitelist. Pagination uses `ROWNUM` (11g has no `OFFSET/FETCH`).
- **Errors.** ORA codes map to HTTP:
  - 00001 → 409, 02291 → 400, 02292 → 409 "still referenced"
  - CHECK violations → 400 with a friendly message
  - `RAISE_APPLICATION_ERROR` messages → 400
- **Auth.** bcrypt password hashes in HOMEPAGE and an 8h JWT. Role-based writes are per resource (ADMIN can always write). Citizen and contractor portals are scoped to the caller's id from the token, never from input.
- **Dates.** Sessions use ISO NLS formats and DATE/TIMESTAMP are fetched as strings, so there are no JS timezone shifts.

| Endpoint | Purpose |
|---|---|
| `POST /api/auth/login`, `/register`, `/change-password`, `GET /me` | auth; register = civilian self-signup (3 inserts in one transaction) |
| `GET /api/meta`, `GET /api/lookups/:resource` | introspected metadata, FK dropdown options |
| `GET/POST/PUT/PATCH/DELETE /api/{departments, employees, civilians, companies, zones, feeder-pillars, streetlights, sensors, complaints, work-orders, spare-parts, billing}` | CRUD with `?page&pageSize&q&sort&order&<column>=value[,value]` |
| `GET /api/energy-logs`, `POST /api/energy-logs`, `DELETE /api/energy-logs/:pole/:log` | weak entity via `sp_record_energy` |
| `POST /api/complaints/:id/work-order` | `sp_complaint_to_work_order` |
| `GET/POST/PUT/DELETE /api/work-orders/:id/parts[/:partId]` | M:N *uses*, stock trigger |
| `GET /api/streetlights/:id/{energy-logs,sensors,complaints,work-orders}` | drill-downs |
| `GET /api/dashboard`, `GET /api/reports[/:id]` | aggregates: zone energy, lamp efficiency, workforce, contractor scorecard, budget overruns, ageing lights |
| `GET/POST/PATCH/DELETE /api/users` | HOMEPAGE admin (ADMIN only) |
| `/api/portal/citizen/*`, `/api/portal/company/*` | self-service portals |

## Phase 3 — Frontend (`frontend/`)

- **Next.js 16 App Router**, plain JavaScript, hand-written CSS (black `#09090b` + pink `#ff4fa3`).
- `/api/*` is **proxied to Express** through `next.config.mjs` rewrites: same origin, no CORS.
- **One generic table and one generic form serve all 13 entities.** Both are driven by `/api/meta`, so a new CHECK value in Oracle shows up in the UI dropdowns automatically.
- **Pages:**
  - dashboard: KPIs, energy chart, status breakdowns, zone health, feeder load, inventory alerts
  - reports: CSV export
  - entity lists and details with related tabs
  - work-order workflow and parts
  - complaint → dispatch
  - streetlight drill-downs
  - user accounts
  - citizen portal: report a fault, track progress
  - contractor portal: start/complete jobs, billing
- **Charts** use a palette checked with a colour-vision-deficiency (colour-blindness) validator against the black surface. Status colours always come with a text label.

## Troubleshooting

- **`DPI-1050 … version 19.1 or higher is needed`.** You upgraded `oracledb` past 6.x. Run `npm i oracledb@6` in `backend/`.
- **`DPI-1047 cannot locate a 64-bit Oracle Client library`.** Check `ORACLE_CLIENT_LIB_DIR` in `backend/.env`.
- **`ORA-12541 no listener`.** Start the `OracleXETNSListener` and `OracleServiceXE` services.
- **Reset all demo data.** Run `powershell -ExecutionPolicy Bypass -File database/setup.ps1 -SkipUser`.
