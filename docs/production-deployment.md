# Production deployment

The production Compose configuration is intentionally profile-gated, so it does not start or modify any existing Docker container unless you explicitly run it.

## Configure the environment

Copy `backend/.env.production.example` to `backend/.env` only for a production environment, then supply a real domain, PostgreSQL connection string, and random Django secret. Keep `DEBUG=False`.

## Run the full stack

```powershell
docker compose -f compose.production.yaml --profile app up --build -d
```

This starts frontend, backend, Redis, Celery worker, and Celery Beat together. The worker executes task automations and the hourly SLA watchdog.

The backend service applies pending Django migrations and collects static files before Gunicorn starts. Run only one backend replica for this Compose configuration; use a dedicated migration job when scaling on Kubernetes.

## Readiness check

After deployment, request `/api/health/`. It returns `200` only when the Django application can reach its database.

## Before public launch

- Use PostgreSQL, not SQLite.
- Set real `ALLOWED_HOSTS` and `CORS_ALLOWED_ORIGINS` values.
- Put HTTPS in front of the backend, then enable the three secure-cookie/redirect variables in the environment template.
- Keep Redis persistent or managed, and run a single Beat scheduler.
