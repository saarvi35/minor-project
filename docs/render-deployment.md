# Deploying WorkZen on Render

Status: `render.yaml` passes Render's Blueprint structure check and the backend image builds, but **it has not been deployed to a live Render account yet**. Treat the first deploy as a test and use the troubleshooting table at the end.

## What the Blueprint creates

| Resource | Type | Purpose |
| --- | --- | --- |
| `workzen-api` | Web service (Docker) | Django API. Runs migrations on start. 1 GB persistent disk at `/var/data` for uploaded files |
| `workzen-worker` | Background worker (Docker) | Celery worker with the beat scheduler (SLA watchdog), so one process does both jobs |
| `workzen-web` | Static site | React frontend, free |
| `workzen-redis` | Key Value (Redis) | Celery broker |
| `workzen-db` | PostgreSQL | Main database |

The API, worker, database and Key Value use paid plans (a payment method is required; check current prices on Render's pricing page). A persistent disk only exists on paid web services. Cheaper variants are at the bottom.

## 1. Before you start

1. Push the latest code: `git push origin main`.
2. Get these values ready:
   - **Gemini API key** (Google AI Studio).
   - **Gmail App Password** for sending invitation emails: Google Account -> Security -> turn on 2-Step Verification -> App passwords -> create one for "WorkZen". `EMAIL_HOST_USER` is that Gmail address.
   - **Google OAuth client ID** only if you use Google sign-in.
3. Decide the service names. Public URLs are `https://<service-name>.onrender.com`. If a name is already taken Render adds a suffix, which breaks the URLs below, so if you want to be safe change `workzen-api` and `workzen-web` in `render.yaml` to something unique (for example `workzen-saarvi-api`), commit and push.

## 2. Create the Render account

1. Sign up at render.com, then **Account Settings -> Billing** and add a payment method.
2. **Account Settings -> GitHub** (or the New dialog) and connect GitHub, granting access to the `minor-project` repository.

## 3. Create everything from the Blueprint

1. Dashboard -> **New -> Blueprint**.
2. Select the `minor-project` repository, branch `main`. Render reads `render.yaml`.
3. Render asks for the values marked `sync: false`. Use your final URLs:

| Variable | Value |
| --- | --- |
| `FRONTEND_BASE_URL` | `https://workzen-web.onrender.com` |
| `CORS_ALLOWED_ORIGINS` | `https://workzen-web.onrender.com` (no trailing slash, no path) |
| `CSRF_TRUSTED_ORIGINS` | `https://workzen-web.onrender.com` |
| `VITE_API_BASE_URL` | `https://workzen-api.onrender.com/api` |
| `GEMINI_API_KEY` | your Gemini key |
| `EMAIL_HOST_USER` | your Gmail address |
| `EMAIL_HOST_PASSWORD` | the Gmail App Password (no spaces) |
| `GOOGLE_CLIENT_ID` and `VITE_GOOGLE_CLIENT_ID` | the same OAuth client ID, or leave empty |

4. Click **Apply**. Render creates the database, Key Value, API, worker and static site. Wait until every service shows **Live** (the first API build takes several minutes).

Variables generated or wired automatically (do not set them): `SECRET_KEY`, `DATABASE_URL`, `CELERY_BROKER_URL`, `CELERY_RESULT_BACKEND`, `RENDER_EXTERNAL_HOSTNAME` (added to `ALLOWED_HOSTS` automatically).

## 4. Verify

1. Open `https://workzen-api.onrender.com/api/health/`. Expected: `{"status":"ok","database":"connected"}`.
2. Open `https://workzen-web.onrender.com`, choose **Register** and create your company (the owner account).
3. Log in, create a project, generate an AI plan, send a project message with an attachment.
4. Invite a user. The email should arrive (check spam).
5. Worker: Dashboard -> `workzen-worker` -> **Logs** should show Celery starting with the beat scheduler.

Optional demo data (needs the web service's **Shell** tab):

```bash
python manage.py seed_multitenant_demo
```

## 5. Google sign-in (only if used)

Google Cloud Console -> Credentials -> your OAuth client -> **Authorized JavaScript origins** -> add `https://workzen-web.onrender.com`. The same client ID must be in `GOOGLE_CLIENT_ID` (API) and `VITE_GOOGLE_CLIENT_ID` (frontend).

## 6. Automatic deploys

Every push to `main` redeploys the affected services (Render's auto-deploy). GitHub Actions CI also runs on each push. To block deploys when CI fails, open each service -> Settings -> **Auto-Deploy** -> *After CI checks pass*.

## 7. Changing settings later

- Edit variables in the service's **Environment** tab, then save (the service redeploys).
- `VITE_*` values are baked in at build time: after changing one, run **Manual Deploy -> Clear build cache & deploy** on `workzen-web`.

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| Browser console shows a CORS error | `CORS_ALLOWED_ORIGINS` must exactly equal the frontend origin (scheme and host only) |
| API returns 400 "Invalid host header" | The service name changed or a custom domain is used. Add the host to `ALLOWED_HOSTS` |
| Login page loads but API calls fail | `VITE_API_BASE_URL` is wrong. Fix it, then clear the build cache and redeploy the frontend |
| API redirect loop | `USE_PROXY_SSL_HEADER` must be `True` on the API |
| Invitation emails never arrive | Check `EMAIL_HOST_USER` / `EMAIL_HOST_PASSWORD`. Render may block outbound SMTP on some plans, in which case use an email API provider |
| AI plan fails | Check API logs. Confirm `GEMINI_API_KEY` is set and `GEMINI_MODEL` is `gemini-3.5-flash` |
| Uploaded files disappear after a deploy | The API has no persistent disk (for example on a free plan). Keep the disk or move uploads to object storage |
| First request is slow | A sleeping or starting service. Paid web services stay awake |

## Cheaper variants

- **Free web service, no disk:** change `plan: starter` to `plan: free` and delete the `disk:` block of `workzen-api`. The service sleeps when idle and uploaded files are lost on every restart or deploy.
- **No worker:** delete the `workzen-worker` service. The SLA watchdog will not run, but everything else works. Keep Redis only if the worker stays.
- **Database:** Render's free Postgres plan expires after a limited period, so use it for demos only.

## Known limitations

- Company logos, task images and task attachments are served publicly by URL (project message files are private and access-checked).
- The Prometheus `/metrics` endpoint is publicly reachable on the API.
- Prometheus, Grafana, Jenkins and Kubernetes manifests are not used on Render.
