# Frontend (React + Vite + Tailwind)

## Setup
1. `cd frontend`
2. `copy .env.example .env`
3. `npm install`
4. `npm run dev`

Backend base URL: `VITE_API_BASE_URL` (default `http://127.0.0.1:8000/api`).

## JWT Auth
- Login (`POST /login/`) se `access` + `refresh` dono store hote hain.
- API client automatic `Authorization: Bearer <access>` bhejta hai.
- 401 aane par frontend refresh token se naya access token lene ki koshish karta hai.
- Default refresh endpoint: `/token/refresh/` (change via `VITE_TOKEN_REFRESH_PATH`).
## Role-wise Side Panel
Role auto-detect hota hai `GET /current-user/` ke permissions + role name se.
Sidebar options bhi permissions ke basis pe hide/show hote hain.

### Owner
1. Dashboard: `GET /overview/`, `GET /companies/`
2. Roles: `POST /roles/`, `GET /roles/`
3. Users: `POST /create-user/`, `GET /users/`
4. Projects: `GET /all-projects/`
5. Tasks & Analytics: `GET /all-tasks/`, `GET /task-analytics/`
6. Company Settings: `GET /companies/`, `PUT /companies/:id/`

### Manager
1. Dashboard: `GET /manager-overview/`, `GET /manager-projects/`, `GET /my-tasks/`, `GET /my-leaves/`
2. Users: `POST /create-user/`, `GET /users/`, `GET /team/`, `GET /team-tasks/`
3. Roles: `POST /roles/`, `GET /roles/`
4. Projects: `POST /projects/`, `PATCH /projects/:id/assign_client/`, `PATCH /projects/:id/deactivate/`, `PATCH /projects/:id/`
5. Tasks: `POST /tasks/`, `GET /project-tasks/:project_id/`, `PUT /tasks/:id/`, `DELETE /tasks/:id/`

### Employee
1. Dashboard: `GET /tasks/`, `GET /projects/`, `PATCH /tasks/:id/`
2. Attendance & Leave: `POST /attendance/checkin/`, `POST /attendance/checkout/`, `POST /leave/apply/`, `GET /my-leaves/`

### HR
1. Dashboard: `GET /hr-dashboard/`, `GET /users/`, `POST /create-user/`, `POST /roles/`
2. Attendance, Leave, Review: `GET /attendance/`, `PATCH /leave/:id/status/`, `POST /review/:employee_id/`
3. Departments: `GET /departments/`, `POST /departments/`

### Client
1. Dashboard: `GET /client-projects/`

## Backend alignment note
- Company settings ke liye primary route `/companies/:id/` use hai, aur fallback `/company/:id/` bhi support kiya gaya hai.
- Project deactivate backend action `PATCH /projects/:id/deactivate/` use karta hai.