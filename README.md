# ReimburseFlow - Expense Reimbursement Management System

A production-grade, full-stack expense reimbursement management system with multi-level approval workflows, conditional rules, and role-based access control.

## Tech Stack

| Layer      | Technology                          |
| ---------- | ----------------------------------- |
| Frontend   | React 18, Tailwind CSS, Vite        |
| Backend    | Node.js, Express                    |
| Database   | PostgreSQL                          |
| ORM        | Prisma                              |
| Auth       | JWT (bcrypt + jsonwebtoken)         |
| Validation | express-validator                   |
| File Upload| Multer                              |

## Features

### Authentication & Roles
- Signup creates a new company and assigns Admin role
- JWT-based authentication with role-based middleware
- Three roles: **Admin**, **Manager**, **Employee**

### Expense Management
- Create, edit, delete (draft only), and submit expenses
- Multi-currency support (USD, EUR, GBP, INR, JPY, CAD, AUD)
- Receipt upload (JPEG, PNG, GIF, PDF - max 5MB)
- Status tracking: Draft → Pending → Approved/Rejected
- Filter by status, category, date range

### Multi-Level Approval Workflows
- Configurable N-step approval chains (e.g., Manager → Finance → Director)
- Steps can be assigned by **specific user** or by **role**
- Amount-based and category-based workflow routing
- Default workflow fallback

### Conditional Approval Rules
- **Percentage-based**: Requires X% of approvers to approve (e.g., 60%)
- **Specific Approver**: Auto-advances when a designated person (e.g., CFO) approves
- **Hybrid**: Either percentage threshold OR specific approver triggers advancement
- Rules can be attached to individual workflow steps

### Admin Dashboard
- User management (create, edit roles, assign managers, activate/deactivate)
- Workflow configuration with visual step builder
- Approval rule definition and management
- Admin override for pending expenses

### Manager Dashboard
- Pending approvals queue with approve/reject + comments
- Team expense visibility
- Approval history tracking

### Employee Dashboard
- Expense submission with full validation
- Draft management (save and submit later)
- Expense history with status tracking
- Receipt upload

## Project Structure

```
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma          # Database schema (8 models)
│   │   └── seed.js                # Demo data seeder
│   └── src/
│       ├── config/                # Database, multer config
│       ├── controllers/           # Request handlers
│       ├── middleware/             # Auth, validation, errors
│       ├── routes/                # Express route definitions
│       ├── services/              # Business logic layer
│       └── index.js               # Express server entry
├── frontend/
│   └── src/
│       ├── components/            # Reusable UI (Layout, Modal, StatusBadge)
│       ├── context/               # AuthContext (React Context + JWT)
│       ├── pages/                 # Page components (8 pages)
│       └── services/              # API client (Axios)
```

## Setup Instructions

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- npm or yarn

### 1. Clone and Install

```bash
git clone <repo-url>
cd Reimbursement-Management

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 2. Database Setup

```bash
cd backend

# Create a .env file with the following variables:
```

```env
DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/reimbursement_db?schema=public"
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
JWT_EXPIRES_IN="90d"
PORT=5000
NODE_ENV=development
FRONTEND_URL="http://localhost:5173"
```

| Variable       | Description                              | Example                                                                 |
| -------------- | ---------------------------------------- | ----------------------------------------------------------------------- |
| `DATABASE_URL` | PostgreSQL connection string             | `postgresql://postgres:yourpassword@localhost:5432/reimbursement_db?schema=public` |
| `JWT_SECRET`   | Secret key for signing JWT tokens        | A long random string (use `openssl rand -hex 64` to generate)           |
| `JWT_EXPIRES_IN` | Token expiration duration              | `90d`                                                                   |
| `PORT`         | Backend server port                      | `5000`                                                                  |
| `NODE_ENV`     | Environment mode                         | `development` or `production`                                           |
| `FRONTEND_URL` | Frontend origin URL (for CORS)           | `http://localhost:5173`                                                 |

```bash

# Create database
psql -U postgres -c "CREATE DATABASE reimbursement_db;"

# Run migrations
npx prisma migrate dev --name init

# Generate Prisma client
npx prisma generate

# Seed demo data
npm run db:seed
```

### 3. Run the Application

```bash
# Terminal 1: Start backend
cd backend
npm run dev

# Terminal 2: Start frontend
cd frontend
npm run dev
```

Frontend: http://localhost:5173
Backend API: http://localhost:5000

### Demo Accounts

| Role     | Email              | Password    |
| -------- | ------------------ | ----------- |
| Admin    | admin@acme.com     | password123 |
| Manager  | manager@acme.com   | password123 |
| Finance  | finance@acme.com   | password123 |
| Employee | john@acme.com      | password123 |
| Employee | jane@acme.com      | password123 |

## API Endpoints

### Auth
| Method | Endpoint        | Description          |
| ------ | --------------- | -------------------- |
| POST   | /api/auth/signup | Register + create company |
| POST   | /api/auth/login  | Login                |
| GET    | /api/auth/profile| Get current user     |

### Users (Admin only)
| Method | Endpoint         | Description          |
| ------ | ---------------- | -------------------- |
| GET    | /api/users       | List company users   |
| POST   | /api/users       | Create user          |
| GET    | /api/users/:id   | Get user details     |
| PATCH  | /api/users/:id   | Update user          |

### Expenses
| Method | Endpoint                  | Description             |
| ------ | ------------------------- | ----------------------- |
| POST   | /api/expenses             | Create expense          |
| GET    | /api/expenses             | List expenses (filtered)|
| GET    | /api/expenses/:id         | Expense details         |
| PATCH  | /api/expenses/:id         | Update draft expense    |
| POST   | /api/expenses/:id/submit  | Submit for approval     |
| DELETE | /api/expenses/:id         | Delete draft expense    |
| GET    | /api/expenses/categories  | List categories         |
| GET    | /api/expenses/currencies  | List currencies         |

### Approvals (Manager/Admin)
| Method | Endpoint                    | Description          |
| ------ | --------------------------- | -------------------- |
| GET    | /api/approvals/pending      | Pending approvals    |
| POST   | /api/approvals/:id/approve  | Approve expense      |
| POST   | /api/approvals/:id/reject   | Reject expense       |
| POST   | /api/approvals/:id/override | Admin override       |

### Workflows (Admin only)
| Method | Endpoint                         | Description          |
| ------ | -------------------------------- | -------------------- |
| POST   | /api/workflows                   | Create workflow      |
| GET    | /api/workflows                   | List workflows       |
| GET    | /api/workflows/:id               | Workflow details     |
| PATCH  | /api/workflows/:id               | Update workflow      |
| DELETE | /api/workflows/:id               | Delete workflow      |
| POST   | /api/workflows/rules             | Create rule          |
| GET    | /api/workflows/rules/all         | List rules           |
| POST   | /api/workflows/steps/:id/rules   | Attach rule to step  |

## Database Schema

8 normalized tables with proper foreign keys and indexes:
- **companies** — Multi-tenant company support
- **users** — With role enum, manager self-reference
- **expenses** — With decimal precision, multi-currency, status enum
- **expense_approvals** — Per-step approval records with audit trail
- **approval_workflows** — Configurable with amount/category routing
- **approval_steps** — N-step chains with role or user assignment
- **approval_rules** — Percentage, specific approver, or hybrid rules
- **step_rules** — Many-to-many linking rules to steps
