# SLA Watchdog

The workflow engine supports an hourly `Task overdue` trigger. It finds active tasks whose due date is before today and runs each matching rule at most once per task per day.

## Local runtime

Start Docker Desktop, then run Redis from the repository root:

```powershell
docker compose up -d redis
```

In separate terminals from `backend/`, start the worker and scheduler:

```powershell
.\.venv\Scripts\celery.exe -A config worker --loglevel=info
.\.venv\Scripts\celery.exe -A config beat --loglevel=info
```

Install background-job dependencies once with:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements-sla.txt
```

## Immediate manual run

This needs no Redis worker and is useful for demos or verification:

```powershell
.\.venv\Scripts\python.exe manage.py run_sla_watchdog
```

Create a `Task overdue` rule in Automations, set its action and message, then give an unfinished task a due date before today. The task activity timeline and notification centre show the result.
