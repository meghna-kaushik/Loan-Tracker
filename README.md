# Loan Collection Visit Tracker

A production-grade enterprise web application for tracking loan collection field visits.

---

## Architecture

```
loan-tracker/
├── frontend/          React + TypeScript (Vite) - Mobile-responsive UI
├── backend/           Node.js + Express + TypeScript - REST API
└── supabase/
    └── migrations/    SQL schema + RLS policies
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS |
| Backend | Node.js + Express + TypeScript |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (Phone + Password) |
| Storage | Supabase Storage (photos) |
| Geocoding | OpenStreetMap Nominatim API |

---

## Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project

---

## Setup Instructions

### 1. Clone & Install

```bash
# Install backend dependencies
cd backend && npm install

# Install frontend dependencies
cd ../frontend && npm install
```

### 2. Supabase Setup

1. Create a new Supabase project at https://supabase.com
2. Go to **SQL Editor** and run `supabase/migrations/001_schema.sql`
3. Get your credentials from **Project Settings > API**:
   - Project URL
   - `anon` public key
   - `service_role` secret key

### 3. Environment Variables

**Backend** — copy `.env.example` to `.env`:
```
PORT=4000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
FRONTEND_URL=http://localhost:5173
```

**Frontend** — copy `.env.example` to `.env`:
```
VITE_API_URL=http://localhost:4000
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 4. Seed Initial Collection Manager

```bash
cd backend
npm run seed
```

This creates the initial admin account:
- **Phone:** `9999999999`
- **Password:** `Manager@123`

> ⚠️ Change this password immediately after first login via User Management.

### 5. Run Development Servers

```bash
# Terminal 1 - Backend
cd backend && npm run dev

# Terminal 2 - Frontend
cd frontend && npm run dev
```

Frontend: http://localhost:5173  
Backend API: http://localhost:4000

---

## User Roles

### Collection Manager
- Manages all field agents (create, deactivate)
- Views all visit records with search
- Accesses audit logs

**Screens:** All Visits | User Management | Audit Logs | Profile

### Field Agent
- Records visit details with photos and geolocation
- Views own past visits per loan ID

**Screens:** New Visit | Profile

---

## Key Features

### Visit Submission (Field Agent)
1. Enter 21-digit loan number
2. Fill visit form (person name, status, comments)
3. Capture photos (min 1, max 5, JPEG/PNG, ≤10 MB)
4. Location auto-captured via browser GPS + reverse geocoded via OpenStreetMap
5. Submit — visit becomes immutable (no edit/delete ever)

### Visit Search (Manager)
- Search by exact Loan ID (21 digits)
- Search by Agent Name or Phone (partial match)
- View photos, geo-coordinates, address

### User Management
- Create field agents and collection managers
- Deactivate users (cannot log in after deactivation)
- All actions logged in audit trail

---

## Security

- Supabase Auth JWT on every API call
- Role-based access control in frontend (route guards) + backend (middleware) + database (RLS)
- Visits are append-only (enforced at API + RLS level — no UPDATE/DELETE policies)
- Rate limiting: 10 req/min on auth, 100 req/min on API
- Helmet security headers
- File type validation (MIME type check)
- Session stored in `sessionStorage` (not `localStorage`)

---

## API Endpoints

### Auth
| Method | Path | Access |
|--------|------|--------|
| POST | `/api/auth/login` | Public |
| POST | `/api/auth/refresh` | Public |

### Visits
| Method | Path | Access |
|--------|------|--------|
| POST | `/api/visits` | Field Agent |
| GET | `/api/visits/my?loan_number=` | Field Agent |
| GET | `/api/visits/search?loan_number=&agent_query=` | Manager |

### Users
| Method | Path | Access |
|--------|------|--------|
| GET | `/api/users` | Manager |
| POST | `/api/users` | Manager |
| PATCH | `/api/users/:id/deactivate` | Manager |
| PATCH | `/api/users/:id/reset-password` | Manager |

### Audit
| Method | Path | Access |
|--------|------|--------|
| GET | `/api/audit?action=` | Manager |

---

## Production Deployment

### Backend
```bash
cd backend && npm run build
npm start
```

Set environment variables on your hosting platform. Enable HTTPS.

### Frontend
```bash
cd frontend && npm run build
# Serve the dist/ folder via nginx/Vercel/Netlify
```

### Important Production Settings
- Set `FRONTEND_URL` in backend to your actual frontend domain
- Set `VITE_API_URL` in frontend to your actual backend URL
- Enforce HTTPS (set `Strict-Transport-Security` header)
- Use Supabase's connection pooler for high traffic

---

## Out of Scope (Not Built)

- Dashboards or analytics
- Visit editing or deletion
- Borrower portal
- Export/reporting
- Super Admin role
