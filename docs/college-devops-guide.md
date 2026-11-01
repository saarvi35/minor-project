# College DevOps Guide

This project uses Docker Compose for the local application stack, GitHub Actions for repository CI, and a Jenkins pipeline for a local automated build. It does not require any cloud account.

## What is already included

- `compose.yaml`: Redis only, useful while developing the backend locally.
- `compose.production.yaml`: frontend, Django backend, Redis, Celery worker, and Celery Beat as a single local stack.
- `backend/Dockerfile` and `frontend/Dockerfile`: reproducible backend and frontend images.
- `Jenkinsfile`: checkout, backend security/integrity tests, frontend production build, and Compose validation.
- `.github/workflows/ci.yml`: equivalent checks for every GitHub push and pull request.

## One-time installation on a demonstration laptop

1. Install Docker Desktop and enable the WSL 2 Linux engine.
2. Install Git, Python 3.12, Node.js 20, and Java 17.
3. Install Jenkins LTS. During setup, install the **Pipeline**, **Git**, **Workspace Cleanup**, and **Timestamper** plugins.
4. Start Docker Desktop and wait until its status says it is running.

## Run the complete local stack

Create the local environment file from the safe template:

```powershell
Copy-Item backend\.env.example backend\.env
```

If you want to demonstrate AI planning, add your own Gemini API key to `backend/.env`; otherwise leave it blank.

From the project root, run:

```powershell
docker compose -f compose.production.yaml --profile app up --build -d
```

Open `http://localhost:5173`. The backend is at `http://localhost:8000`.

The Compose stack uses one Docker-managed SQLite volume shared by backend, Celery worker, and Celery Beat. This is suitable for the college demo; a real multi-server deployment should use PostgreSQL.

To stop only WorkZen's stack:

```powershell
docker compose -f compose.production.yaml --profile app down
```

## Jenkins setup

1. Open `http://localhost:8080` after Jenkins installation.
2. Create **New Item** → **Pipeline**.
3. Select **Pipeline script from SCM**.
4. Select Git and provide this repository URL/path.
5. Set branch to the branch that contains this work.
6. Keep script path as `Jenkinsfile`, save, and select **Build Now**.

The pipeline does not deploy the application. It verifies the backend, tests security and workflow behaviour, builds the frontend, and validates Compose.

## Before a college demonstration

```powershell
docker compose -f compose.production.yaml --profile app ps
docker compose -f compose.production.yaml --profile app logs --tail=50 backend
```

Confirm that frontend, backend, Redis, worker, and beat are running. Do not commit `backend/.env`, Gemini keys, email passwords, or database credentials.
