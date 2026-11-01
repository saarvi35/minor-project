# Automated build and deploy with Jenkins

Status: the pipeline is defined in the `Jenkinsfile` but has **not been run against a live Jenkins server or cluster**. Complete the one-time setup below, then every push to `main` builds, tests, publishes images, deploys to Kubernetes, and rolls back automatically if the rollout is unhealthy.

## What happens on each push

1. GitHub notifies Jenkins (webhook), or Jenkins notices the commit within 5 minutes (SCM polling).
2. Backend checks and tests, frontend build, Compose validation (every branch).
3. On `main` only: build and push `workzen-backend` and `workzen-frontend` images tagged with the build number.
4. Apply the Kubernetes manifests, update secrets and public-URL config, set the new images, wait for each rollout.
5. If any rollout fails, `kubectl rollout undo` restores the previous revision and the build fails.

## One-time setup

### 1. Jenkins server
Install Jenkins on a machine with: Git, Python 3.12, Node 20, Docker, and `kubectl`. Install the plugins *Pipeline*, *Git*, *GitHub*, *Credentials Binding*.

### 2. Cluster
Provide a Kubernetes cluster that Jenkins can reach and that can pull from Docker Hub (managed cloud cluster, or k3s on a VM). Docker Desktop's built-in cluster only works when Jenkins runs on the same machine.

### 3. Jenkins credentials (Manage Jenkins -> Credentials -> Global)

| ID | Type | Value |
| --- | --- | --- |
| `workzen-container-registry` | Username with password | Docker Hub username and access token |
| `workzen-kubeconfig` | Secret file | kubeconfig for the cluster |
| `workzen-django-secret` | Secret text | long random Django `SECRET_KEY` |
| `workzen-postgres-password` | Secret text | new strong password |
| `workzen-grafana-password` | Secret text | Grafana admin password |
| `workzen-gemini-api-key` | Secret text | Gemini API key |
| `workzen-google-client-id` | Secret text | Google OAuth client ID (use a placeholder if Google sign-in is unused) |

### 4. Pipeline job
New Item -> Pipeline -> *Pipeline script from SCM* -> Git -> `https://github.com/saarvi35/minor-project.git`, branch `*/main`, script path `Jenkinsfile`. Run it once manually so Jenkins registers the parameters.

### 5. Parameters
Edit the defaults in the `Jenkinsfile` so push-triggered builds need no input:
- `CONTAINER_REGISTRY`: `docker.io/<your-dockerhub-username>`
- `PUBLIC_HOST` / `PUBLIC_URL`: the address users open (for example `workzen.example.com` and `https://workzen.example.com`). The frontend is exposed on NodePort `30080`.

### 6. GitHub webhook (optional, makes builds instant)
Repository -> Settings -> Webhooks -> payload URL `https://<jenkins-host>/github-webhook/`, content type `application/json`, event *push*. Jenkins must be reachable from the internet. Without it, SCM polling still triggers builds within 5 minutes.

## Verifying it works
- Push a small commit to `main` and watch the build run through all stages.
- `kubectl -n workzen get pods` shows backend, worker, beat, frontend, postgres and redis running.
- Open `PUBLIC_URL`, log in, and generate an AI plan.
- Prometheus: `http://<node>:30090`. Grafana: `http://<node>:30300`.
- Rollback test: push a commit that breaks startup and confirm the build fails and the site keeps serving the previous version.

## Not covered yet
Alertmanager alerts, centralized logging, database backups, TLS/ingress, autoscaling, and vulnerability scanning.
