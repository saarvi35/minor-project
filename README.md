# WorkZen

WorkZen is a multi-tenant workflow and project-management platform for small and medium organisations. Each company gets an isolated workspace with role-based access for owners, managers, HR teams, employees, and clients.

## Key capabilities

- Tenant-isolated companies, people, roles, projects, tasks, comments, activity history, alerts, and workflow rules
- Dedicated Owner, Manager, HR, Employee, and Client dashboards
- Project Kanban board, project timeline, task collaboration, notifications, attendance, leave, and performance-review workflows
- Live delivery-risk scoring that considers due dates, progress, priority, workload, attendance, leave, and project health
- SLA watchdog and workflow automation for task updates and overdue work
- Excel, CSV, and Google Sheets onboarding imports with validation preview and explicit confirmation
- AI Project Architect for reviewable AI-generated project plans and task breakdowns

## AI Project Architect

The AI Project Architect turns an unstructured project brief into a draft execution plan with milestones, delivery risks, mitigations, acceptance criteria, and workload-aware task suggestions. The plan never changes the workspace automatically: an owner or manager reviews it and explicitly selects **Apply plan**.

This use case needs generative AI because it interprets free-form requirements, identifies assumptions, decomposes work, and drafts acceptance criteria. Standard workflow rules remain responsible for deterministic work such as task notifications and SLA checks.

Gemini receives the entered brief and anonymised delivery context only. It does not receive company names, project names, people names, emails, credentials, tokens, or contact details. Read [AI Project Architect documentation](docs/ai-project-architect.md) and the [AI product rationale](docs/ai-product-rationale.md).

## Start locally

Open separate PowerShell terminals:

```powershell
# Project root: Redis
docker compose up -d redis
```

```powershell
# Backend
cd backend
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt -r requirements-sla.txt -r requirements-onboarding.txt
python manage.py migrate
python manage.py runserver 127.0.0.1:8000
```

```powershell
# Celery worker
cd backend
.\venv\Scripts\Activate.ps1
celery -A config worker -l info --pool=solo
```

```powershell
# Celery Beat
cd backend
.\venv\Scripts\Activate.ps1
celery -A config beat -l info
```

```powershell
# Frontend
cd frontend
npm install
npm run dev
```

Open the URL printed by Vite, normally `http://localhost:5173`.

## Enable Gemini

Create an API key in [Google AI Studio](https://aistudio.google.com/), then add this to `backend/.env` without committing it:

```text
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-3.8-flash
```

Restart the Django backend. Owners and managers will then see **AI Project Architect** in the sidebar.

## Demo tenants

All demo accounts use `WorkZenDemo@2026` as their password.

| Company | Owner login |
| --- | --- |
| Nimbus Retail Pvt Ltd | `priya.owner@nimbus.demo` |
| GreenGrid Logistics | `vikram.owner@greengrid.demo` |
| Atlas Health Analytics | `ananya.owner@atlas.demo` |

If the database is empty, seed the demo workspace from `backend`:

```powershell
python manage.py seed_demo_workspace --company solutions --replace
python manage.py seed_multitenant_demo
```

## Documentation

- [Company data import](docs/company-data-import.md)
- [AI Project Architect](docs/ai-project-architect.md)
- [AI product rationale](docs/ai-product-rationale.md)
- [SLA watchdog](docs/sla-watchdog.md)
- [College DevOps setup](docs/college-devops-guide.md)
- [Kubernetes, Jenkins, Prometheus, and Grafana](docs/kubernetes-observability-guide.md)
- [Final DevOps configuration checklist](docs/final-devops-configuration.md)
