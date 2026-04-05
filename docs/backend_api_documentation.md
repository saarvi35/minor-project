# Backend API Documentation

This document lists discovered backend APIs with URL, method, and sample JSON format.

## Notes

- Base prefix from config URLs: /api/
- JSON blocks are sample request/response formats inferred from views, serializers, and models.
- Router-based endpoints include standard DRF list/detail methods.
- File fields like logo, attachment, and image may be sent through multipart/form-data.
- Backend source files were not modified.

Total discovered API entries: 57

## Accounts

### 1. POST /api/login/

- View: `LoginView`
- Description: User login

#### Request JSON

```json
{
  "email": "owner@company.com",
  "password": "Secret123"
}
```

#### Response JSON

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user_id": 1,
    "name": "Owner Name",
    "email": "owner@company.com",
    "role": "OWNER",
    "company": "Acme Pvt Ltd",
    "access": "jwt-access-token",
    "refresh": "jwt-refresh-token"
  }
}
```

### 2. POST /api/logout/

- View: `LogoutView`
- Description: User logout

#### Request JSON

```json
{
  "refresh": "jwt-refresh-token"
}
```

#### Response JSON

```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

### 3. POST /api/attendance/checkin/

- View: `MarkAttendanceAPI`
- Description: Mark attendance check-in

#### Request JSON

```json
{}
```

#### Response JSON

```json
{
  "message": "Attendance marked successfully",
  "data": {
    "date": "2026-03-30",
    "check_in": "09:15:00"
  }
}
```

### 4. POST /api/attendance/checkout/

- View: `CheckoutAttendanceAPI`
- Description: Mark attendance check-out

#### Request JSON

```json
{}
```

#### Response JSON

```json
{
  "message": "Checked out successfully",
  "check_out": "18:05:00",
  "working_hours": "8:50:00"
}
```

### 5. POST /api/leave/apply/

- View: `ApplyLeaveAPI`
- Description: Apply leave request

#### Request JSON

```json
{
  "start_date": "2026-04-02",
  "end_date": "2026-04-04",
  "reason": "Medical leave"
}
```

#### Response JSON

```json
{
  "message": "Leave request submitted",
  "leave_id": 12,
  "status": "PENDING"
}
```

## Companies

### 1. GET /api/companies/

- View: `CompanyViewSet`
- Description: List companies

#### Response JSON

```json
[
  {
    "id": 1,
    "name": "Acme Pvt Ltd",
    "email": "info@acme.com",
    "phone": "9876543210",
    "size": "50-100",
    "address": "Jaipur",
    "logo": "/media/company_logos/logo.png",
    "owner": 1,
    "last_user_number": 8
  }
]
```

### 2. POST /api/companies/

- View: `CompanyViewSet`
- Description: Create company

#### Request JSON

```json
{
  "name": "Acme Pvt Ltd",
  "email": "info@acme.com",
  "phone": "9876543210",
  "size": "50-100",
  "address": "Jaipur",
  "logo": null,
  "owner": 1,
  "last_user_number": 0
}
```

#### Response JSON

```json
{
  "id": 1,
  "name": "Acme Pvt Ltd",
  "email": "info@acme.com",
  "phone": "9876543210",
  "size": "50-100",
  "address": "Jaipur",
  "logo": null,
  "owner": 1,
  "last_user_number": 0
}
```

### 3. GET /api/companies/{id}/

- View: `CompanyViewSet`
- Description: Retrieve company

#### Response JSON

```json
{
  "id": 1,
  "name": "Acme Pvt Ltd",
  "email": "info@acme.com",
  "phone": "9876543210",
  "size": "50-100",
  "address": "Jaipur",
  "logo": "/media/company_logos/logo.png",
  "owner": 1,
  "last_user_number": 8
}
```

### 4. PUT /api/companies/{id}/

- View: `CompanyViewSet`
- Description: Update company

#### Request JSON

```json
{
  "name": "Acme Pvt Ltd",
  "email": "info@acme.com",
  "phone": "9999999999",
  "size": "100-200",
  "address": "Delhi",
  "logo": null,
  "owner": 1,
  "last_user_number": 8
}
```

#### Response JSON

```json
{
  "id": 1,
  "name": "Acme Pvt Ltd",
  "email": "info@acme.com",
  "phone": "9999999999",
  "size": "100-200",
  "address": "Delhi",
  "logo": null,
  "owner": 1,
  "last_user_number": 8
}
```

### 5. PATCH /api/companies/{id}/

- View: `CompanyViewSet`
- Description: Partial update company

#### Request JSON

```json
{
  "phone": "9999999999",
  "address": "Delhi"
}
```

#### Response JSON

```json
{
  "id": 1,
  "name": "Acme Pvt Ltd",
  "email": "info@acme.com",
  "phone": "9999999999",
  "size": "50-100",
  "address": "Delhi",
  "logo": null,
  "owner": 1,
  "last_user_number": 8
}
```

### 6. DELETE /api/companies/{id}/

- View: `CompanyViewSet`
- Description: Delete company

#### Response JSON

```json
{}
```

### 7. GET /api/roles/

- View: `RoleViewSet`
- Description: List roles

#### Response JSON

```json
[
  {
    "id": 3,
    "company": 1,
    "name": "MANAGER",
    "slug": "manager",
    "can_manage_company": false,
    "can_manage_roles": false,
    "can_manage_users": true,
    "can_create_project": true,
    "can_assign_task": true,
    "can_view_all_tasks": false,
    "can_view_team_tasks": true,
    "can_view_assigned_tasks": true,
    "can_update_task_status": true,
    "can_view_project_progress": true,
    "can_manage_hr": false,
    "can_approve_leave": true,
    "can_view_attendance": true,
    "can_manage_payroll": false,
    "level": 60
  }
]
```

### 8. POST /api/roles/

- View: `RoleViewSet`
- Description: Create role

#### Request JSON

```json
{
  "name": "MANAGER",
  "slug": "manager",
  "can_manage_company": false,
  "can_manage_roles": false,
  "can_manage_users": true,
  "can_create_project": true,
  "can_assign_task": true,
  "can_view_all_tasks": false,
  "can_view_team_tasks": true,
  "can_view_assigned_tasks": true,
  "can_update_task_status": true,
  "can_view_project_progress": true,
  "can_manage_hr": false,
  "can_approve_leave": true,
  "can_view_attendance": true,
  "can_manage_payroll": false,
  "level": 60
}
```

#### Response JSON

```json
{
  "id": 3,
  "company": 1,
  "name": "MANAGER",
  "slug": "manager",
  "can_manage_company": false,
  "can_manage_roles": false,
  "can_manage_users": true,
  "can_create_project": true,
  "can_assign_task": true,
  "can_view_all_tasks": false,
  "can_view_team_tasks": true,
  "can_view_assigned_tasks": true,
  "can_update_task_status": true,
  "can_view_project_progress": true,
  "can_manage_hr": false,
  "can_approve_leave": true,
  "can_view_attendance": true,
  "can_manage_payroll": false,
  "level": 60
}
```

### 9. GET /api/roles/{id}/

- View: `RoleViewSet`
- Description: Retrieve role

#### Response JSON

```json
{
  "id": 3,
  "company": 1,
  "name": "MANAGER",
  "slug": "manager",
  "can_manage_company": false,
  "can_manage_roles": false,
  "can_manage_users": true,
  "can_create_project": true,
  "can_assign_task": true,
  "can_view_all_tasks": false,
  "can_view_team_tasks": true,
  "can_view_assigned_tasks": true,
  "can_update_task_status": true,
  "can_view_project_progress": true,
  "can_manage_hr": false,
  "can_approve_leave": true,
  "can_view_attendance": true,
  "can_manage_payroll": false,
  "level": 60
}
```

### 10. PUT /api/roles/{id}/

- View: `RoleViewSet`
- Description: Update role

#### Request JSON

```json
{
  "company": 1,
  "name": "MANAGER",
  "slug": "manager",
  "can_manage_company": false,
  "can_manage_roles": false,
  "can_manage_users": true,
  "can_create_project": true,
  "can_assign_task": true,
  "can_view_all_tasks": false,
  "can_view_team_tasks": true,
  "can_view_assigned_tasks": true,
  "can_update_task_status": true,
  "can_view_project_progress": true,
  "can_manage_hr": false,
  "can_approve_leave": true,
  "can_view_attendance": true,
  "can_manage_payroll": false,
  "level": 60
}
```

#### Response JSON

```json
{
  "id": 3,
  "company": 1,
  "name": "MANAGER",
  "slug": "manager",
  "can_manage_company": false,
  "can_manage_roles": false,
  "can_manage_users": true,
  "can_create_project": true,
  "can_assign_task": true,
  "can_view_all_tasks": false,
  "can_view_team_tasks": true,
  "can_view_assigned_tasks": true,
  "can_update_task_status": true,
  "can_view_project_progress": true,
  "can_manage_hr": false,
  "can_approve_leave": true,
  "can_view_attendance": true,
  "can_manage_payroll": false,
  "level": 60
}
```

### 11. PATCH /api/roles/{id}/

- View: `RoleViewSet`
- Description: Partial update role

#### Request JSON

```json
{
  "can_manage_users": true,
  "can_approve_leave": true
}
```

#### Response JSON

```json
{
  "id": 3,
  "company": 1,
  "name": "MANAGER",
  "slug": "manager",
  "can_manage_company": false,
  "can_manage_roles": false,
  "can_manage_users": true,
  "can_create_project": true,
  "can_assign_task": true,
  "can_view_all_tasks": false,
  "can_view_team_tasks": true,
  "can_view_assigned_tasks": true,
  "can_update_task_status": true,
  "can_view_project_progress": true,
  "can_manage_hr": false,
  "can_approve_leave": true,
  "can_view_attendance": true,
  "can_manage_payroll": false,
  "level": 60
}
```

### 12. DELETE /api/roles/{id}/

- View: `RoleViewSet`
- Description: Delete role

#### Response JSON

```json
{}
```

### 13. POST /api/register/

- View: `RegistrationView`
- Description: Register company and admin

#### Request JSON

```json
{
  "company": {
    "name": "Acme Pvt Ltd",
    "email": "info@acme.com",
    "phone": "9876543210",
    "size": "50-100",
    "address": "Jaipur",
    "logo": null
  },
  "owner_name": "Acme Owner",
  "owner_email": "owner@acme.com",
  "password": "Secret123"
}
```

#### Response JSON

```json
{
  "success": true,
  "message": "Company and Admin registered successfully."
}
```

### 14. POST /api/create-user/

- View: `CreateUserView`
- Description: Create user and send invite

#### Request JSON

```json
{
  "company_id": 1,
  "first_name": "Rahul",
  "email": "rahul@acme.com",
  "role_id": 3
}
```

#### Response JSON

```json
{
  "success": true,
  "message": "Invite sent successfully",
  "invite_token": "uuid-token-value"
}
```

### 15. PATCH /api/update-user/{user_id}/

- View: `UpdateUserView`
- Description: Update company user

#### Request JSON

```json
{
  "name": "Rahul Sharma",
  "role": 3,
  "status": "ACTIVE"
}
```

#### Response JSON

```json
{
  "id": 9,
  "name": "Rahul Sharma",
  "email": "rahul@acme.com",
  "role": "MANAGER",
  "level": 60,
  "status": "ACTIVE"
}
```

### 16. DELETE /api/delete-user/{user_id}/

- View: `DeleteUserView`
- Description: Delete company user

#### Response JSON

```json
{
  "success": true,
  "message": "User deleted successfully"
}
```

### 17. POST /api/set-password/{token}/

- View: `SetPasswordView`
- Description: Set invited user's password

#### Request JSON

```json
{
  "password": "Secret12345",
  "confirm_password": "Secret12345"
}
```

#### Response JSON

```json
{
  "message": "Password set successfully"
}
```

### 18. GET /api/current-user/

- View: `CurrentUserView`
- Description: Get current logged-in company user

#### Response JSON

```json
{
  "id": 5,
  "name": "Rahul Sharma",
  "email": "rahul@acme.com",
  "role": "MANAGER",
  "level": 60,
  "permissions": {
    "can_manage_company": false,
    "can_manage_roles": false,
    "can_manage_users": true,
    "can_create_project": true,
    "can_assign_task": true,
    "can_view_all_tasks": false,
    "can_view_team_tasks": true,
    "can_view_assigned_tasks": true,
    "can_update_task_status": true,
    "can_view_project_progress": true,
    "can_manage_hr": false,
    "can_approve_leave": true,
    "can_view_attendance": true,
    "can_manage_payroll": false
  }
}
```

## Dashboard

### 1. GET /api/overview/

- View: `DashboardOverviewAPI`
- Description: Company overview metrics

#### Response JSON

```json
{
  "total_clients": 12,
  "total_employees": 25,
  "total_projects": 14,
  "total_tasks": 120,
  "completed_tasks": 78,
  "pending_tasks": 42,
  "completion_rate": 65.0,
  "overdue_tasks": 5
}
```

### 2. GET /api/my-tasks/

- View: `MyTasksAPI`
- Description: Get current user's tasks

#### Response JSON

```json
[
  {
    "id": 21,
    "title": "Create login UI",
    "description": "Build login page",
    "assigned_to": 9,
    "assigned_to_name": "Rahul Sharma",
    "created_by": 5,
    "created_by_name": "Manager One",
    "company": 1,
    "status": "IN_PROGRESS",
    "priority": "HIGH",
    "due_date": "2026-04-10",
    "attachment": null,
    "image": null,
    "reference_link": "https://example.com/spec",
    "progress": 60,
    "created_at": "2026-03-28T12:30:00Z",
    "project": 3
  }
]
```

### 3. GET /api/my-projects/

- View: `MyProjectsAPI`
- Description: Get current user's projects

#### Response JSON

```json
[
  {
    "id": 3,
    "name": "HRMS Platform",
    "status": "ACTIVE",
    "progress": 70,
    "priority": "HIGH",
    "start_date": "2026-03-01",
    "end_date": "2026-06-30"
  }
]
```

### 4. GET /api/users/

- View: `UserListAPI`
- Description: List company users

#### Response JSON

```json
[
  {
    "id": 5,
    "name": "Rahul Sharma",
    "email": "rahul@acme.com",
    "role": "MANAGER",
    "level": 60,
    "status": "ACTIVE"
  }
]
```

### 5. GET /api/my-leaves/

- View: `MyLeaveListAPI`
- Description: Get current user's leave requests

#### Response JSON

```json
[
  {
    "id": 12,
    "company_user_id": 9,
    "employee_name": "Rahul Sharma",
    "employee_role": "EMPLOYEE",
    "start_date": "2026-04-02",
    "end_date": "2026-04-04",
    "reason": "Medical leave",
    "status": "PENDING",
    "applied_on": "2026-03-30T09:00:00Z"
  }
]
```

### 6. GET /api/all-tasks/

- View: `AllTasksAPI`
- Description: Get all visible tasks

#### Response JSON

```json
[
  {
    "id": 21,
    "title": "Create login UI",
    "description": "Build login page",
    "assigned_to": 9,
    "assigned_to_name": "Rahul Sharma",
    "created_by": 5,
    "created_by_name": "Manager One",
    "company": 1,
    "status": "IN_PROGRESS",
    "priority": "HIGH",
    "due_date": "2026-04-10",
    "attachment": null,
    "image": null,
    "reference_link": "https://example.com/spec",
    "progress": 60,
    "created_at": "2026-03-28T12:30:00Z",
    "project": 3
  }
]
```

### 7. GET /api/task-analytics/

- View: `TaskAnalyticsAPI`
- Description: Get task analytics

#### Response JSON

```json
{
  "total_tasks": 120,
  "completed_tasks": 78,
  "overdue_tasks": 5
}
```

### 8. GET /api/team-leaves/

- View: `TeamLeaveListAPI`
- Description: Get team leave requests

#### Response JSON

```json
[
  {
    "id": 12,
    "company_user_id": 9,
    "employee_name": "Rahul Sharma",
    "employee_role": "EMPLOYEE",
    "start_date": "2026-04-02",
    "end_date": "2026-04-04",
    "reason": "Medical leave",
    "status": "PENDING",
    "applied_on": "2026-03-30T09:00:00Z"
  }
]
```

### 9. GET /api/all-projects/

- View: `AllProjectsAPI`
- Description: List company projects

#### Response JSON

```json
[
  {
    "id": 3,
    "name": "HRMS Platform",
    "status": "ACTIVE",
    "progress": 70,
    "priority": "HIGH",
    "start_date": "2026-03-01",
    "end_date": "2026-06-30"
  }
]
```

### 10. GET /api/client-projects/

- View: `ClientProjectsProgressAPI`
- Description: Get client project progress

#### Response JSON

```json
[
  {
    "id": 3,
    "name": "HRMS Platform",
    "progress": 70,
    "status": "ACTIVE",
    "start_date": "2026-03-01",
    "end_date": "2026-06-30",
    "budget": "250000.00",
    "actual_cost": "140000.00"
  }
]
```

### 11. GET /api/manager-projects/

- View: `ManagerProjectsAPI`
- Description: Get manager's projects

#### Response JSON

```json
[
  {
    "id": 3,
    "name": "HRMS Platform",
    "status": "ACTIVE",
    "progress": 70,
    "priority": "HIGH",
    "start_date": "2026-03-01",
    "end_date": "2026-06-30"
  }
]
```

### 12. GET /api/manager-overview/

- View: `ManagerOverviewAPI`
- Description: Get manager dashboard overview

#### Response JSON

```json
{
  "total_projects": 6,
  "total_tasks": 32,
  "completed_tasks": 18,
  "pending_tasks": 7,
  "in_progress_tasks": 7,
  "overdue_tasks": 2
}
```

## HR

### 1. GET /api/profile/

- View: `MyProfileAPI`
- Description: Get employee profile

#### Response JSON

```json
{
  "id": 4,
  "department": {
    "id": 2,
    "name": "Engineering",
    "description": "Product engineering department"
  },
  "designation": "Frontend Developer",
  "date_joined": "2025-12-01",
  "salary": "65000.00",
  "phone": "9876543210",
  "address": "Jaipur"
}
```

### 2. PUT /api/profile/

- View: `MyProfileAPI`
- Description: Update employee profile

#### Request JSON

```json
{
  "department_id": 2,
  "designation": "Frontend Developer",
  "date_joined": "2025-12-01",
  "salary": "65000.00",
  "phone": "9876543210",
  "address": "Jaipur"
}
```

#### Response JSON

```json
{
  "id": 4,
  "department": {
    "id": 2,
    "name": "Engineering",
    "description": "Product engineering department"
  },
  "designation": "Frontend Developer",
  "date_joined": "2025-12-01",
  "salary": "65000.00",
  "phone": "9876543210",
  "address": "Jaipur"
}
```

### 3. GET /api/departments/

- View: `DepartmentListCreateAPI`
- Description: List departments

#### Response JSON

```json
[
  {
    "id": 2,
    "name": "Engineering",
    "description": "Product engineering department"
  }
]
```

### 4. POST /api/departments/

- View: `DepartmentListCreateAPI`
- Description: Create department

#### Request JSON

```json
{
  "name": "Engineering",
  "description": "Product engineering department"
}
```

#### Response JSON

```json
{
  "id": 2,
  "name": "Engineering",
  "description": "Product engineering department"
}
```

### 5. GET /api/attendance/

- View: `MyAttendanceAPI`
- Description: Get attendance records

#### Response JSON

```json
[
  {
    "id": 11,
    "company_user_id": 9,
    "employee_name": "Rahul Sharma",
    "employee_role": "EMPLOYEE",
    "date": "2026-03-30",
    "check_in": "09:15:00",
    "check_out": "18:05:00",
    "status": "PRESENT"
  }
]
```

### 6. PATCH /api/leave/{leave_id}/status/

- View: `UpdateLeaveStatusAPI`
- Description: Update leave status

#### Request JSON

```json
{
  "status": "APPROVED"
}
```

#### Response JSON

```json
{
  "id": 12,
  "company_user_id": 9,
  "employee_name": "Rahul Sharma",
  "employee_role": "EMPLOYEE",
  "start_date": "2026-04-02",
  "end_date": "2026-04-04",
  "reason": "Medical leave",
  "status": "APPROVED",
  "applied_on": "2026-03-30T09:00:00Z"
}
```

### 7. POST /api/review/{employee_id}/

- View: `AddPerformanceReviewAPI`
- Description: Add performance review

#### Request JSON

```json
{
  "rating": 4,
  "feedback": "Consistent performer with strong ownership."
}
```

#### Response JSON

```json
{
  "id": 6,
  "rating": 4,
  "feedback": "Consistent performer with strong ownership.",
  "review_date": "2026-03-30"
}
```

### 8. GET /api/hr-dashboard/

- View: `HRDashboardAPI`
- Description: Get HR dashboard overview

#### Response JSON

```json
{
  "total_employees": 25,
  "attendance": {
    "present": 20,
    "absent": 2,
    "half_day": 1,
    "on_leave": 2,
    "attendance_percentage": 80
  },
  "leave_summary": {
    "approved": 6,
    "pending": 3,
    "rejected": 1
  }
}
```

## Projects

### 1. GET /api/projects/

- View: `ProjectViewSet`
- Description: List projects

#### Response JSON

```json
[
  {
    "id": 3,
    "company": 1,
    "client": 14,
    "manager": 5,
    "name": "HRMS Platform",
    "description": "Internal HR management system",
    "status": "ACTIVE",
    "priority": "HIGH",
    "start_date": "2026-03-01",
    "end_date": "2026-06-30",
    "budget": "250000.00",
    "actual_cost": "140000.00",
    "progress": 70,
    "is_active": true,
    "created_at": "2026-03-01T10:00:00Z"
  }
]
```

### 2. POST /api/projects/

- View: `ProjectViewSet`
- Description: Create project

#### Request JSON

```json
{
  "client": 14,
  "manager": 5,
  "name": "HRMS Platform",
  "description": "Internal HR management system",
  "status": "ACTIVE",
  "priority": "HIGH",
  "start_date": "2026-03-01",
  "end_date": "2026-06-30",
  "budget": "250000.00",
  "actual_cost": "0.00",
  "is_active": true
}
```

#### Response JSON

```json
{
  "id": 3,
  "company": 1,
  "client": 14,
  "manager": 5,
  "name": "HRMS Platform",
  "description": "Internal HR management system",
  "status": "ACTIVE",
  "priority": "HIGH",
  "start_date": "2026-03-01",
  "end_date": "2026-06-30",
  "budget": "250000.00",
  "actual_cost": "0.00",
  "progress": 0,
  "is_active": true,
  "created_at": "2026-03-01T10:00:00Z"
}
```

### 3. GET /api/projects/{id}/

- View: `ProjectViewSet`
- Description: Retrieve project

#### Response JSON

```json
{
  "id": 3,
  "company": 1,
  "client": 14,
  "manager": 5,
  "name": "HRMS Platform",
  "description": "Internal HR management system",
  "status": "ACTIVE",
  "priority": "HIGH",
  "start_date": "2026-03-01",
  "end_date": "2026-06-30",
  "budget": "250000.00",
  "actual_cost": "140000.00",
  "progress": 70,
  "is_active": true,
  "created_at": "2026-03-01T10:00:00Z"
}
```

### 4. PUT /api/projects/{id}/

- View: `ProjectViewSet`
- Description: Update project

#### Request JSON

```json
{
  "client": 14,
  "manager": 5,
  "name": "HRMS Platform",
  "description": "Internal HR management system updated",
  "status": "ACTIVE",
  "priority": "HIGH",
  "start_date": "2026-03-01",
  "end_date": "2026-07-15",
  "budget": "250000.00",
  "actual_cost": "160000.00",
  "is_active": true
}
```

#### Response JSON

```json
{
  "id": 3,
  "company": 1,
  "client": 14,
  "manager": 5,
  "name": "HRMS Platform",
  "description": "Internal HR management system updated",
  "status": "ACTIVE",
  "priority": "HIGH",
  "start_date": "2026-03-01",
  "end_date": "2026-07-15",
  "budget": "250000.00",
  "actual_cost": "160000.00",
  "progress": 70,
  "is_active": true,
  "created_at": "2026-03-01T10:00:00Z"
}
```

### 5. PATCH /api/projects/{id}/

- View: `ProjectViewSet`
- Description: Partial update project

#### Request JSON

```json
{
  "status": "ON_HOLD",
  "priority": "MEDIUM"
}
```

#### Response JSON

```json
{
  "id": 3,
  "company": 1,
  "client": 14,
  "manager": 5,
  "name": "HRMS Platform",
  "description": "Internal HR management system",
  "status": "ON_HOLD",
  "priority": "MEDIUM",
  "start_date": "2026-03-01",
  "end_date": "2026-06-30",
  "budget": "250000.00",
  "actual_cost": "140000.00",
  "progress": 70,
  "is_active": true,
  "created_at": "2026-03-01T10:00:00Z"
}
```

### 6. DELETE /api/projects/{id}/

- View: `ProjectViewSet`
- Description: Delete project

#### Response JSON

```json
{}
```

### 7. PATCH /api/projects/{id}/assign_client/

- View: `ProjectViewSet.assign_client`
- Description: Assign client to project

#### Request JSON

```json
{
  "client": 14
}
```

#### Response JSON

```json
{
  "message": "Client assigned successfully"
}
```

### 8. PATCH /api/projects/{id}/deactivate/

- View: `ProjectViewSet.deactivate`
- Description: Soft deactivate project

#### Request JSON

```json
{}
```

#### Response JSON

```json
{
  "message": "Project deactivated"
}
```

## Tasks

### 1. GET /api/tasks/

- View: `TaskViewSet`
- Description: List tasks

#### Response JSON

```json
[
  {
    "id": 21,
    "title": "Create login UI",
    "description": "Build login page",
    "assigned_to": 9,
    "assigned_to_name": "Rahul Sharma",
    "created_by": 5,
    "created_by_name": "Manager One",
    "company": 1,
    "status": "IN_PROGRESS",
    "priority": "HIGH",
    "due_date": "2026-04-10",
    "attachment": null,
    "image": null,
    "reference_link": "https://example.com/spec",
    "progress": 60,
    "created_at": "2026-03-28T12:30:00Z",
    "project": 3
  }
]
```

### 2. POST /api/tasks/

- View: `TaskViewSet`
- Description: Create task

#### Request JSON

```json
{
  "title": "Create login UI",
  "description": "Build login page",
  "assigned_to": 9,
  "status": "PENDING",
  "priority": "HIGH",
  "due_date": "2026-04-10",
  "attachment": null,
  "image": null,
  "reference_link": "https://example.com/spec",
  "project": 3
}
```

#### Response JSON

```json
{
  "id": 21,
  "title": "Create login UI",
  "description": "Build login page",
  "assigned_to": 9,
  "assigned_to_name": "Rahul Sharma",
  "created_by": 5,
  "created_by_name": "Manager One",
  "company": 1,
  "status": "PENDING",
  "priority": "HIGH",
  "due_date": "2026-04-10",
  "attachment": null,
  "image": null,
  "reference_link": "https://example.com/spec",
  "created_at": "2026-03-28T12:30:00Z",
  "project": 3
}
```

### 3. GET /api/tasks/{id}/

- View: `TaskViewSet`
- Description: Retrieve task

#### Response JSON

```json
{
  "id": 21,
  "title": "Create login UI",
  "description": "Build login page",
  "assigned_to": 9,
  "assigned_to_name": "Rahul Sharma",
  "created_by": 5,
  "created_by_name": "Manager One",
  "company": 1,
  "status": "IN_PROGRESS",
  "priority": "HIGH",
  "due_date": "2026-04-10",
  "attachment": null,
  "image": null,
  "reference_link": "https://example.com/spec",
  "progress": 60,
  "created_at": "2026-03-28T12:30:00Z",
  "project": 3
}
```

### 4. PUT /api/tasks/{id}/

- View: `TaskViewSet`
- Description: Update task

#### Request JSON

```json
{
  "title": "Create login UI",
  "description": "Build login page with OTP support",
  "assigned_to": 9,
  "status": "IN_PROGRESS",
  "priority": "HIGH",
  "due_date": "2026-04-12",
  "attachment": null,
  "image": null,
  "reference_link": "https://example.com/spec-v2",
  "progress": 60,
  "project": 3
}
```

#### Response JSON

```json
{
  "id": 21,
  "title": "Create login UI",
  "description": "Build login page with OTP support",
  "assigned_to": 9,
  "assigned_to_name": "Rahul Sharma",
  "created_by": 5,
  "created_by_name": "Manager One",
  "company": 1,
  "status": "IN_PROGRESS",
  "priority": "HIGH",
  "due_date": "2026-04-12",
  "attachment": null,
  "image": null,
  "reference_link": "https://example.com/spec-v2",
  "progress": 60,
  "created_at": "2026-03-28T12:30:00Z",
  "project": 3
}
```

### 5. PATCH /api/tasks/{id}/

- View: `TaskViewSet`
- Description: Partial update task

#### Request JSON

```json
{
  "status": "COMPLETED",
  "progress": 100
}
```

#### Response JSON

```json
{
  "id": 21,
  "title": "Create login UI",
  "description": "Build login page",
  "assigned_to": 9,
  "assigned_to_name": "Rahul Sharma",
  "created_by": 5,
  "created_by_name": "Manager One",
  "company": 1,
  "status": "COMPLETED",
  "priority": "HIGH",
  "due_date": "2026-04-10",
  "attachment": null,
  "image": null,
  "reference_link": "https://example.com/spec",
  "progress": 100,
  "created_at": "2026-03-28T12:30:00Z",
  "project": 3
}
```

### 6. DELETE /api/tasks/{id}/

- View: `TaskViewSet`
- Description: Delete task

#### Response JSON

```json
{}
```
