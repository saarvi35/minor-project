# Final DevOps Configuration Checklist

Use this after cloning the project. It separates repository work from setup that must be performed on your own laptop/accounts.

## 1. Repository code — already completed

- Dockerfiles and Compose files
- GitHub Actions CI
- Jenkins test/build/publish/deploy pipeline
- Kubernetes manifests for WorkZen, PostgreSQL, Redis, Celery, Prometheus, and Grafana
- Django Prometheus metrics at `/metrics`
- Grafana datasource and WorkZen dashboard provisioning
- Environment templates and secret exclusions

## 2. Install once on the demo laptop

Install Docker Desktop with Kubernetes enabled, Git, Python 3.12, Node.js 20, Java 17, Jenkins LTS, and `kubectl`. Restart PowerShell after installing command-line tools.

Verify:

```powershell
docker info
kubectl config current-context
kubectl get nodes
python --version
node --version
```

## 3. Configure the local application environment

```powershell
Copy-Item backend\.env.example backend\.env
```

Edit `backend/.env` only if you need Gemini AI. Add `GEMINI_API_KEY=...`; keep this file private.

## 4. Configure Docker Hub once

Create public Docker Hub repositories named `workzen-backend` and `workzen-frontend`. This is required because Docker Desktop Kubernetes runs in Kind mode and pulls application images from a registry.

## 5. Configure Jenkins once

1. Open `http://localhost:8080`.
2. Install Pipeline, Git, Workspace Cleanup, Timestamper, and Credentials Binding plugins.
3. Ensure Jenkins can execute `docker`, `kubectl`, Python 3.12, and Node.js 20. Restart Jenkins after changing PATH.
   On Windows, configure the Jenkins service to run as the same Windows user that runs Docker Desktop; otherwise Jenkins cannot access Docker Desktop's named pipe or your Kubernetes configuration.
4. Add credentials with these exact IDs:

| ID | Credential type |
|---|---|
| `workzen-kubeconfig` | Secret file: `C:\Users\Saarvi\.kube\config` |
| `workzen-django-secret` | Secret text: a long random value |
| `workzen-postgres-password` | Secret text: local database password |
| `workzen-grafana-password` | Secret text: Grafana admin password |
| `workzen-container-registry` | Username/password: Docker Hub username + password/access token |

5. Create **New Item → Pipeline → Pipeline script from SCM**, select this Git repository, branch, and `Jenkinsfile`.
6. Click **Build with Parameters**, enable `DEPLOY_TO_KUBERNETES`, set `CONTAINER_REGISTRY` to `docker.io/YOUR_DOCKERHUB_USERNAME`, then build.

## 6. Verify deployment

```powershell
kubectl get pods -n workzen
kubectl get pods -n monitoring
kubectl get deployments -n workzen
```

All pods should show `Running` and `READY` values such as `1/1`.

- WorkZen: `http://localhost:30080`
- Prometheus: `http://localhost:30090` → query `up{job="workzen-backend"}`; expected value: `1`
- Grafana: `http://localhost:30300` → login with `admin` and the password stored as `workzen-grafana-password`; open the **WorkZen** dashboard.

## 7. Re-deploy after code changes

Push the source to the configured branch and run Jenkins with deployment enabled. Jenkins runs tests, builds fresh image tags, pushes them, and changes the Kubernetes deployments to the new tag.

For the complete background and manual fallback instructions, see [Kubernetes observability guide](kubernetes-observability-guide.md).
