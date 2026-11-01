# WorkZen — Claude Code Handoff

## Project purpose

WorkZen is a multi-tenant workflow and project-management platform for small and medium organisations. Each company receives an isolated workspace. The product supports Owner, Manager, Employee, HR, and Client roles; project/task management; delivery-risk analysis; HR operations; workflow/SLA automation; notifications; spreadsheet onboarding; and an AI Project Architect.

This is a college major-project codebase that has been hardened substantially. Preserve the existing UI, workflows, database records, migrations, and tenant boundaries unless the task explicitly requires a change.

## Technology stack

- Frontend: React 18, Vite, React Router, Axios, Tailwind CSS.
- Backend: Django 6, Django REST Framework, SimpleJWT, Django ORM.
- Local database: SQLite (`backend/db.sqlite3`).
- Container/Kubernetes database: PostgreSQL is defined in the Kubernetes manifests; Docker Compose uses a shared SQLite volume.
- Background work: Celery and Redis; Celery Beat schedules the SLA watchdog.
- AI: Google Gemini API, called only from the Django backend.
- DevOps foundation: Docker, Docker Compose, GitHub Actions CI, Jenkinsfile, Kubernetes manifests, Prometheus, and Grafana configuration.

## Repository layout

```text
backend/
  accounts/        Authentication, JWT login/logout, Google sign-in
  companies/       Company tenant, roles, invitations, imports/onboarding
  dashboard/       Role-specific dashboard aggregates
  projects/        Project and client/project relationships
  tasks/           Tasks, comments, activities, risk and archive logic
  hr/              HR profiles, attendance, leave, reviews
  workflows/       Rules, runs, SLA watchdog, demo seeding commands
  ai_insights/     AI Project Architect and deterministic insights
  config/          Django settings, root URLs, Celery configuration
frontend/
  src/pages/       Role dashboards and login UI
  src/lib/         API client and authentication state
k8s/               Kubernetes manifests and observability configuration
docs/              Feature, deployment, hardening, and DevOps documentation
.github/workflows/ci.yml  CI checks
Jenkinsfile        Optional build/publish/deploy pipeline definition
```

## Core product rules — do not weaken

1. **Tenant isolation:** Every company-owned query and mutation must be scoped to the authenticated user's `CompanyUser.company`. Never trust an ID sent by the browser without verifying it belongs to the same company.
2. **Role enforcement:** Backend permissions are authoritative. Do not rely on hidden frontend buttons for access control.
3. **Sensitive HR data:** HR information is accessible only to the permitted company role. Do not expose it through dashboard aggregates, exports, AI prompts, or client APIs.
4. **No unsafe deletion:** Projects and tasks use archive behaviour where applicable. Preserve historic task/activity data.
5. **AI requires approval:** Gemini may create a *draft plan* only. It must not create projects/tasks automatically. Only an authorised Owner or Manager can explicitly apply a reviewed plan.
6. **No secrets in source:** Do not commit `.env`, API keys, passwords, JWTs, OAuth credentials, database URLs, or generated runtime files.

## Roles and expected access

- **Owner:** company administration, users, roles, invitations, company-wide data and reporting.
- **Manager:** projects, tasks, assignments, workflow rules, team reporting, AI Project Architect.
- **Employee:** own assigned tasks, updates, attendance and leave actions.
- **HR:** HR profile, attendance, leave, employee-related operations; must not gain unrestricted project/tenant administration.
- **Client:** restricted view of explicitly permitted client projects; no internal HR, workforce, or company administration data.

Permission checks live primarily in `backend/companies/permissions.py`, `backend/companies/utils.py`, serializers, and views. Retain negative tests for cross-tenant and role-bypass scenarios whenever changing access logic.

## Important implemented features

- JWT authentication with short-lived access tokens, refresh-token rotation, blacklisting, and logout.
- Optional Google sign-in. Frontend and backend must use the same `GOOGLE_CLIENT_ID`.
- Company invitations with expiry, membership/role controls, and tenant integrity constraints.
- Projects, task boards, priorities, due dates, assignments, comments, activities, notifications, and archival.
- Delivery-risk scoring and dashboard reporting using deterministic operational signals (not a trained predictive ML model).
- HR profiles, attendance, leave and review functionality.
- Workflow/SLA watchdog that avoids archived work and runs on a schedule through Celery Beat.
- Excel onboarding (`Employees`, `Projects`, `Tasks` tabs), CSV employee roster import, and public-link Google Sheets import. Imports use validation/preview before explicit confirmation.
- AI Project Architect using an entered brief plus anonymised workload/role context. It does not send names, company names, emails, credentials, tokens, or contact data to Gemini.

## Local development

### Required software

- Python 3.12+ with `backend/venv` (already present in the normal project checkout).
- Node.js and npm.
- Docker Desktop only if Redis/Celery or containers are required.

### Environment file

Copy `backend/.env.example` to `backend/.env` if it does not already exist. Keep secrets only in `backend/.env`; it is ignored by Git.

Minimum local values:

```env
DEBUG=True
SECRET_KEY=long-local-only-secret
ALLOWED_HOSTS=localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=http://localhost:5173
CSRF_TRUSTED_ORIGINS=http://localhost:5173
FRONTEND_BASE_URL=http://localhost:5173
GOOGLE_CLIENT_ID=
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.8-flash
GEMINI_REQUEST_TIMEOUT_SECONDS=30
```

`frontend/.env` should retain `VITE_API_BASE_URL=http://127.0.0.1:8000/api` in the current Windows/Docker Desktop setup. Docker Desktop may reserve `localhost:8000`; therefore use `127.0.0.1` for the local Django API unless Docker port mappings are deliberately changed.

### Fresh local start (Windows PowerShell)

Use two terminals. Before starting, close duplicate local Python/Node servers if necessary; do **not** terminate Docker Desktop or unrelated containers without user approval.

Backend:

```powershell
cd C:\Users\Saarvi\Documents\GitHub\minor-project\backend
Remove-Item Env:HTTP_PROXY,Env:HTTPS_PROXY,Env:ALL_PROXY -ErrorAction SilentlyContinue
$env:NO_PROXY="localhost,127.0.0.1"
.\venv\Scripts\python.exe manage.py migrate
.\venv\Scripts\python.exe manage.py runserver 127.0.0.1:8000 --noreload
```

Frontend:

```powershell
cd C:\Users\Saarvi\Documents\GitHub\minor-project\frontend
npm install
npm run dev -- --host localhost --port 5173
```

Open `http://localhost:5173`. The health endpoint is `http://127.0.0.1:8000/api/health/`.

### Redis, Celery worker, and scheduler

These are required for live scheduled/SLA automation, but not for basic frontend/backend demonstration:

```powershell
# From repository root, with Docker Desktop running
docker compose up -d redis

# From backend directory, in separate terminals
.\venv\Scripts\celery.exe -A config worker -l info --pool=solo
.\venv\Scripts\celery.exe -A config beat -l info
```

Windows requires Celery's `--pool=solo`.

## AI Project Architect

Implementation: `backend/ai_insights/copilot.py`, `views.py`, `serializers.py`, and `models.py`.

- Provider state endpoint: `GET /api/ai/copilot/status/` (authenticated).
- Draft-plan endpoint: `POST /api/ai/copilot/plans/` (authorised Owner/Manager only).
- Apply endpoint: `POST /api/ai/copilot/plans/<id>/apply/` (explicit approval only).
- Requests are rate-limited through DRF's `ai` throttle scope.
- Responses are required as JSON, capped to 10 tasks and bounded by a configurable provider timeout.
- Provider/network errors must become a safe `503` response. Never expose Django debug traces to the frontend.

### Known external Gemini caveat

The local machine previously had invalid `HTTP_PROXY`, `HTTPS_PROXY`, and `ALL_PROXY` environment variables pointing to `127.0.0.1:9`. This caused Gemini requests to time out. Clear those variables only for the local backend process as shown above. If minimal Gemini requests still time out, the issue is external network/VPN/firewall/provider access, not the AI plan code or key presence. Do not replace the AI workflow with fake/static output merely to hide this failure.

## Testing and verification

Run backend checks from `backend/`:

```powershell
.\venv\Scripts\python.exe manage.py makemigrations --check --dry-run
.\venv\Scripts\python.exe manage.py check
.\venv\Scripts\python.exe manage.py test accounts.tests_security companies.tests companies.tests_security companies.tests_integrity dashboard.tests_integrity hr.tests_security projects.tests tasks.tests_integrity workflows.tests ai_insights.tests
```

Run frontend build from `frontend/`:

```powershell
npm run build
```

For every auth, role, or tenant change, add/execute negative tests proving that:

- anonymous users are rejected;
- a lower role cannot call a privileged endpoint;
- a user from Company A cannot read/change Company B data;
- a Client cannot obtain HR/internal records;
- an AI plan cannot be applied by an unauthorised user or across tenants.

## DevOps status — use accurate language

Completed/configured:

- Backend/frontend Dockerfiles and Compose configuration.
- GitHub Actions CI: migrations check, Django checks, deployment configuration check, backend test suite, Python compile, frontend build.
- Jenkinsfile for optional image build/push and Kubernetes deployment once external registry and Jenkins credentials are supplied.
- Kubernetes manifests for WorkZen services plus PostgreSQL/Redis.
- Prometheus metrics endpoint (`/metrics`) and Prometheus/Grafana configuration.

Not yet verified as a live production capability; do not claim these are complete:

- Cloud deployment or a live staging/production environment.
- Registry publication driven by CI.
- Kubernetes HPA/autoscaling, automated rollback, Alertmanager alerts, centralized logging, production backups, or vulnerability scans.
- Fully running WorkZen Kubernetes application pods. Local Docker Desktop image/registry configuration still needs user-side setup.

See `docs/final-devops-configuration.md`, `docs/kubernetes-observability-guide.md`, and `docs/college-devops-guide.md` before changing deployment files.

## Database and migration policy

- The active local database is `backend/db.sqlite3`; do not delete or replace it without explicit user approval.
- Create safe Django migrations for model/schema changes. Never edit already-applied migrations.
- Prefer database constraints, indexes, select/prefetch-related query improvements, and scoped querysets for integrity/performance.
- Preserve company ownership relationships and archival behaviour.

## Current working-tree warning

The repository has substantial uncommitted user/project work: security hardening, tenant protections, AI Project Architect, onboarding/import, DevOps configuration, documentation, migrations, and UI changes. Treat all current changes as intentional. Do not use `git reset --hard`, broad checkout/restore operations, bulk deletions, or overwrite `.env`/SQLite data.

## Recommended change workflow

1. Inspect the relevant model, serializer, view, URL, frontend caller, existing tests, and current `git diff` before editing.
2. Keep a change tightly scoped; use `apply_patch` rather than replacing large files unnecessarily.
3. Add/adjust tests for behaviour and negative security cases.
4. Run the smallest relevant test group, then Django checks and frontend build if UI/API contract changes.
5. Report exactly what changed, what was verified, and any external configuration still required.

## Useful documentation

- `README.md` — high-level product and start instructions.
- `docs/company-data-import.md` — import format and validation process.
- `docs/ai-project-architect.md` — AI data flow and approval rules.
- `docs/ai-product-rationale.md` — why generative AI is justified in this product.
- `docs/industry-hardening-checklist.md` — remaining production-readiness work.
- `docs/production-deployment.md` — production configuration guidance.

