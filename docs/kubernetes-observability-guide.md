# Local Kubernetes, Jenkins, Prometheus, and Grafana

This is a local college demonstration setup. It uses Docker Desktop Kubernetes; no cloud account is required.

## What the pipeline does

`Jenkinsfile` first runs backend checks/tests and the frontend production build. When **DEPLOY_TO_KUBERNETES** is selected, it builds versioned images, pushes them to your Docker Hub namespace, creates Kubernetes secrets from Jenkins credentials, then applies the manifests in `k8s/`.

The cluster runs PostgreSQL, Redis, Django, Celery worker, Celery Beat, React/Nginx, Prometheus, and Grafana. Prometheus scrapes Django's real `/metrics` endpoint. Grafana is automatically provisioned with Prometheus and a basic WorkZen dashboard.

## One-time laptop setup

1. Install Docker Desktop and enable **Kubernetes** in Docker Desktop Settings. Wait for Kubernetes status to become running.
2. Install `kubectl`, Java 17, Jenkins LTS, Git, Python 3.12, and Node.js 20.
3. Verify the local cluster:

```powershell
kubectl config current-context
kubectl get nodes
```

The context should normally be `docker-desktop`.

## One-time Docker Hub configuration

1. Create a free Docker Hub account.
2. Create two **public** repositories: `workzen-backend` and `workzen-frontend`.
3. Replace `YOUR_DOCKERHUB_USERNAME` below with your exact Docker Hub username.

Public repositories are sufficient and simpler for a college-local cluster. Do not place Docker Hub passwords, Gemini keys, or database passwords in Git.

## Manual first deployment

Log in and build/push the images from the repository root:

```powershell
docker login
docker build -t docker.io/YOUR_DOCKERHUB_USERNAME/workzen-backend:demo .\backend
docker build -t docker.io/YOUR_DOCKERHUB_USERNAME/workzen-frontend:demo .\frontend
docker push docker.io/YOUR_DOCKERHUB_USERNAME/workzen-backend:demo
docker push docker.io/YOUR_DOCKERHUB_USERNAME/workzen-frontend:demo
```

Create namespaces and local-only secrets. Replace all example values before running this command; do not commit them.

```powershell
kubectl apply -f k8s\namespace.yaml
kubectl -n workzen create secret generic workzen-secrets --from-literal=SECRET_KEY="replace-with-a-long-random-secret" --from-literal=POSTGRES_PASSWORD="replace-with-a-local-db-password" --from-literal=DATABASE_URL="postgresql://workzen:replace-with-a-local-db-password@postgres:5432/workzen"
kubectl -n monitoring create secret generic grafana-secrets --from-literal=GRAFANA_ADMIN_PASSWORD="replace-with-a-grafana-password"
kubectl apply -k k8s
kubectl -n workzen set image deployment/workzen-backend migrate=docker.io/YOUR_DOCKERHUB_USERNAME/workzen-backend:demo backend=docker.io/YOUR_DOCKERHUB_USERNAME/workzen-backend:demo
kubectl -n workzen set image deployment/workzen-worker worker=docker.io/YOUR_DOCKERHUB_USERNAME/workzen-backend:demo
kubectl -n workzen set image deployment/workzen-beat beat=docker.io/YOUR_DOCKERHUB_USERNAME/workzen-backend:demo
kubectl -n workzen set image deployment/workzen-frontend frontend=docker.io/YOUR_DOCKERHUB_USERNAME/workzen-frontend:demo
```

Wait for workloads:

```powershell
kubectl get pods -n workzen -w
kubectl get pods -n monitoring -w
```

Open these local addresses after all pods are `Running`:

- WorkZen: `http://localhost:30080`
- Prometheus: `http://localhost:30090`
- Grafana: `http://localhost:30300` (username: `admin`; password: the Grafana secret you chose)

## Jenkins automated deployment

Create these Jenkins credentials using the exact IDs below:

| Credential ID | Type | Value |
|---|---|---|
| `workzen-kubeconfig` | Secret file | Your local Kubernetes config, normally `C:\Users\<you>\.kube\config` |
| `workzen-django-secret` | Secret text | Long random Django secret |
| `workzen-postgres-password` | Secret text | Local PostgreSQL password |
| `workzen-grafana-password` | Secret text | Grafana admin password |
| `workzen-container-registry` | Username with password | Docker Hub username and password/access token |

Create a Pipeline job using **Pipeline script from SCM**, point it to this repository, and leave the script path as `Jenkinsfile`. Ensure Jenkins can run `docker`, `kubectl`, Python 3.12, and Node.js 20. On Windows, run the Jenkins service as the same user that runs Docker Desktop, otherwise it cannot access Docker's named pipe or your Kubernetes configuration.

Select **Build with Parameters**, enable `DEPLOY_TO_KUBERNETES`, and set `CONTAINER_REGISTRY` to `docker.io/YOUR_DOCKERHUB_USERNAME`. Jenkins will build, test, publish versioned images, and deploy without storing credentials in Git.

## Demonstration checks

```powershell
kubectl get deployments -n workzen
kubectl get deployments -n monitoring
kubectl get pods -n workzen
kubectl get pods -n monitoring
kubectl logs deployment/workzen-backend -n workzen --tail=50
```

In Prometheus, query `up{job="workzen-backend"}`. It should return `1`. In Grafana, open the **WorkZen** folder and show the provisioned dashboard.

## Reset local Kubernetes demo data

This permanently deletes only the local WorkZen and monitoring namespaces, including the PostgreSQL demo volume:

```powershell
kubectl delete namespace workzen
kubectl delete namespace monitoring
```
