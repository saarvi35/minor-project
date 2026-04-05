import json
from pathlib import Path

OUT_DIR = Path(__file__).resolve().parent
OUTPUT_MD = OUT_DIR / "backend_api_documentation.md"
OUTPUT_PDF = OUT_DIR / "backend_api_documentation.pdf"

NOTES = [
    "Base prefix from config URLs: /api/",
    "JSON blocks are sample request/response formats inferred from views, serializers, and models.",
    "Router-based endpoints include standard DRF list/detail methods.",
    "File fields like logo, attachment, and image may be sent through multipart/form-data.",
    "Backend source files were not modified.",
]

API_GROUPS = [
    {
        "name": "Accounts",
        "endpoints": [
            {"m": "POST", "u": "/api/login/", "v": "LoginView", "d": "User login", "req": {"email": "owner@company.com", "password": "Secret123"}, "res": {"success": True, "message": "Login successful", "data": {"user_id": 1, "name": "Owner Name", "email": "owner@company.com", "role": "OWNER", "company": "Acme Pvt Ltd", "access": "jwt-access-token", "refresh": "jwt-refresh-token"}}},
            {"m": "POST", "u": "/api/logout/", "v": "LogoutView", "d": "User logout", "req": {"refresh": "jwt-refresh-token"}, "res": {"success": True, "message": "Logged out successfully"}},
            {"m": "POST", "u": "/api/attendance/checkin/", "v": "MarkAttendanceAPI", "d": "Mark attendance check-in", "req": {}, "res": {"message": "Attendance marked successfully", "data": {"date": "2026-03-30", "check_in": "09:15:00"}}},
            {"m": "POST", "u": "/api/attendance/checkout/", "v": "CheckoutAttendanceAPI", "d": "Mark attendance check-out", "req": {}, "res": {"message": "Checked out successfully", "check_out": "18:05:00", "working_hours": "8:50:00"}},
            {"m": "POST", "u": "/api/leave/apply/", "v": "ApplyLeaveAPI", "d": "Apply leave request", "req": {"start_date": "2026-04-02", "end_date": "2026-04-04", "reason": "Medical leave"}, "res": {"message": "Leave request submitted", "leave_id": 12, "status": "PENDING"}},
        ],
    },
    {
        "name": "Companies",
        "endpoints": [
            {"m": "GET", "u": "/api/companies/", "v": "CompanyViewSet", "d": "List companies", "res": [{"id": 1, "name": "Acme Pvt Ltd", "email": "info@acme.com", "phone": "9876543210", "size": "50-100", "address": "Jaipur", "logo": "/media/company_logos/logo.png", "owner": 1, "last_user_number": 8}]},
            {"m": "POST", "u": "/api/companies/", "v": "CompanyViewSet", "d": "Create company", "req": {"name": "Acme Pvt Ltd", "email": "info@acme.com", "phone": "9876543210", "size": "50-100", "address": "Jaipur", "logo": None, "owner": 1, "last_user_number": 0}, "res": {"id": 1, "name": "Acme Pvt Ltd", "email": "info@acme.com", "phone": "9876543210", "size": "50-100", "address": "Jaipur", "logo": None, "owner": 1, "last_user_number": 0}},
            {"m": "GET", "u": "/api/companies/{id}/", "v": "CompanyViewSet", "d": "Retrieve company", "res": {"id": 1, "name": "Acme Pvt Ltd", "email": "info@acme.com", "phone": "9876543210", "size": "50-100", "address": "Jaipur", "logo": "/media/company_logos/logo.png", "owner": 1, "last_user_number": 8}},
            {"m": "PUT", "u": "/api/companies/{id}/", "v": "CompanyViewSet", "d": "Update company", "req": {"name": "Acme Pvt Ltd", "email": "info@acme.com", "phone": "9999999999", "size": "100-200", "address": "Delhi", "logo": None, "owner": 1, "last_user_number": 8}, "res": {"id": 1, "name": "Acme Pvt Ltd", "email": "info@acme.com", "phone": "9999999999", "size": "100-200", "address": "Delhi", "logo": None, "owner": 1, "last_user_number": 8}},
            {"m": "PATCH", "u": "/api/companies/{id}/", "v": "CompanyViewSet", "d": "Partial update company", "req": {"phone": "9999999999", "address": "Delhi"}, "res": {"id": 1, "name": "Acme Pvt Ltd", "email": "info@acme.com", "phone": "9999999999", "size": "50-100", "address": "Delhi", "logo": None, "owner": 1, "last_user_number": 8}},
            {"m": "DELETE", "u": "/api/companies/{id}/", "v": "CompanyViewSet", "d": "Delete company", "res": {}},
            {"m": "GET", "u": "/api/roles/", "v": "RoleViewSet", "d": "List roles", "res": [{"id": 3, "company": 1, "name": "MANAGER", "slug": "manager", "can_manage_company": False, "can_manage_roles": False, "can_manage_users": True, "can_create_project": True, "can_assign_task": True, "can_view_all_tasks": False, "can_view_team_tasks": True, "can_view_assigned_tasks": True, "can_update_task_status": True, "can_view_project_progress": True, "can_manage_hr": False, "can_approve_leave": True, "can_view_attendance": True, "can_manage_payroll": False, "level": 60}]},
            {"m": "POST", "u": "/api/roles/", "v": "RoleViewSet", "d": "Create role", "req": {"name": "MANAGER", "slug": "manager", "can_manage_company": False, "can_manage_roles": False, "can_manage_users": True, "can_create_project": True, "can_assign_task": True, "can_view_all_tasks": False, "can_view_team_tasks": True, "can_view_assigned_tasks": True, "can_update_task_status": True, "can_view_project_progress": True, "can_manage_hr": False, "can_approve_leave": True, "can_view_attendance": True, "can_manage_payroll": False, "level": 60}, "res": {"id": 3, "company": 1, "name": "MANAGER", "slug": "manager", "can_manage_company": False, "can_manage_roles": False, "can_manage_users": True, "can_create_project": True, "can_assign_task": True, "can_view_all_tasks": False, "can_view_team_tasks": True, "can_view_assigned_tasks": True, "can_update_task_status": True, "can_view_project_progress": True, "can_manage_hr": False, "can_approve_leave": True, "can_view_attendance": True, "can_manage_payroll": False, "level": 60}},
            {"m": "GET", "u": "/api/roles/{id}/", "v": "RoleViewSet", "d": "Retrieve role", "res": {"id": 3, "company": 1, "name": "MANAGER", "slug": "manager", "can_manage_company": False, "can_manage_roles": False, "can_manage_users": True, "can_create_project": True, "can_assign_task": True, "can_view_all_tasks": False, "can_view_team_tasks": True, "can_view_assigned_tasks": True, "can_update_task_status": True, "can_view_project_progress": True, "can_manage_hr": False, "can_approve_leave": True, "can_view_attendance": True, "can_manage_payroll": False, "level": 60}},
            {"m": "PUT", "u": "/api/roles/{id}/", "v": "RoleViewSet", "d": "Update role", "req": {"company": 1, "name": "MANAGER", "slug": "manager", "can_manage_company": False, "can_manage_roles": False, "can_manage_users": True, "can_create_project": True, "can_assign_task": True, "can_view_all_tasks": False, "can_view_team_tasks": True, "can_view_assigned_tasks": True, "can_update_task_status": True, "can_view_project_progress": True, "can_manage_hr": False, "can_approve_leave": True, "can_view_attendance": True, "can_manage_payroll": False, "level": 60}, "res": {"id": 3, "company": 1, "name": "MANAGER", "slug": "manager", "can_manage_company": False, "can_manage_roles": False, "can_manage_users": True, "can_create_project": True, "can_assign_task": True, "can_view_all_tasks": False, "can_view_team_tasks": True, "can_view_assigned_tasks": True, "can_update_task_status": True, "can_view_project_progress": True, "can_manage_hr": False, "can_approve_leave": True, "can_view_attendance": True, "can_manage_payroll": False, "level": 60}},
            {"m": "PATCH", "u": "/api/roles/{id}/", "v": "RoleViewSet", "d": "Partial update role", "req": {"can_manage_users": True, "can_approve_leave": True}, "res": {"id": 3, "company": 1, "name": "MANAGER", "slug": "manager", "can_manage_company": False, "can_manage_roles": False, "can_manage_users": True, "can_create_project": True, "can_assign_task": True, "can_view_all_tasks": False, "can_view_team_tasks": True, "can_view_assigned_tasks": True, "can_update_task_status": True, "can_view_project_progress": True, "can_manage_hr": False, "can_approve_leave": True, "can_view_attendance": True, "can_manage_payroll": False, "level": 60}},
            {"m": "DELETE", "u": "/api/roles/{id}/", "v": "RoleViewSet", "d": "Delete role", "res": {}},
            {"m": "POST", "u": "/api/register/", "v": "RegistrationView", "d": "Register company and admin", "req": {"company": {"name": "Acme Pvt Ltd", "email": "info@acme.com", "phone": "9876543210", "size": "50-100", "address": "Jaipur", "logo": None}, "owner_name": "Acme Owner", "owner_email": "owner@acme.com", "password": "Secret123"}, "res": {"success": True, "message": "Company and Admin registered successfully."}},
            {"m": "POST", "u": "/api/create-user/", "v": "CreateUserView", "d": "Create user and send invite", "req": {"company_id": 1, "first_name": "Rahul", "email": "rahul@acme.com", "role_id": 3}, "res": {"success": True, "message": "Invite sent successfully", "invite_token": "uuid-token-value"}},
            {"m": "PATCH", "u": "/api/update-user/{user_id}/", "v": "UpdateUserView", "d": "Update company user", "req": {"name": "Rahul Sharma", "role": 3, "status": "ACTIVE"}, "res": {"id": 9, "name": "Rahul Sharma", "email": "rahul@acme.com", "role": "MANAGER", "level": 60, "status": "ACTIVE"}},
            {"m": "DELETE", "u": "/api/delete-user/{user_id}/", "v": "DeleteUserView", "d": "Delete company user", "res": {"success": True, "message": "User deleted successfully"}},
            {"m": "POST", "u": "/api/set-password/{token}/", "v": "SetPasswordView", "d": "Set invited user's password", "req": {"password": "Secret12345", "confirm_password": "Secret12345"}, "res": {"message": "Password set successfully"}},
            {"m": "GET", "u": "/api/current-user/", "v": "CurrentUserView", "d": "Get current logged-in company user", "res": {"id": 5, "name": "Rahul Sharma", "email": "rahul@acme.com", "role": "MANAGER", "level": 60, "permissions": {"can_manage_company": False, "can_manage_roles": False, "can_manage_users": True, "can_create_project": True, "can_assign_task": True, "can_view_all_tasks": False, "can_view_team_tasks": True, "can_view_assigned_tasks": True, "can_update_task_status": True, "can_view_project_progress": True, "can_manage_hr": False, "can_approve_leave": True, "can_view_attendance": True, "can_manage_payroll": False}}},
        ],
    },
    {
        "name": "Dashboard",
        "endpoints": [
            {"m": "GET", "u": "/api/overview/", "v": "DashboardOverviewAPI", "d": "Company overview metrics", "res": {"total_clients": 12, "total_employees": 25, "total_projects": 14, "total_tasks": 120, "completed_tasks": 78, "pending_tasks": 42, "completion_rate": 65.0, "overdue_tasks": 5}},
            {"m": "GET", "u": "/api/my-tasks/", "v": "MyTasksAPI", "d": "Get current user's tasks", "res": [{"id": 21, "title": "Create login UI", "description": "Build login page", "assigned_to": 9, "assigned_to_name": "Rahul Sharma", "created_by": 5, "created_by_name": "Manager One", "company": 1, "status": "IN_PROGRESS", "priority": "HIGH", "due_date": "2026-04-10", "attachment": None, "image": None, "reference_link": "https://example.com/spec", "progress": 60, "created_at": "2026-03-28T12:30:00Z", "project": 3}]},
            {"m": "GET", "u": "/api/my-projects/", "v": "MyProjectsAPI", "d": "Get current user's projects", "res": [{"id": 3, "name": "HRMS Platform", "status": "ACTIVE", "progress": 70, "priority": "HIGH", "start_date": "2026-03-01", "end_date": "2026-06-30"}]},
            {"m": "GET", "u": "/api/users/", "v": "UserListAPI", "d": "List company users", "res": [{"id": 5, "name": "Rahul Sharma", "email": "rahul@acme.com", "role": "MANAGER", "level": 60, "status": "ACTIVE"}]},
            {"m": "GET", "u": "/api/my-leaves/", "v": "MyLeaveListAPI", "d": "Get current user's leave requests", "res": [{"id": 12, "company_user_id": 9, "employee_name": "Rahul Sharma", "employee_role": "EMPLOYEE", "start_date": "2026-04-02", "end_date": "2026-04-04", "reason": "Medical leave", "status": "PENDING", "applied_on": "2026-03-30T09:00:00Z"}]},
            {"m": "GET", "u": "/api/all-tasks/", "v": "AllTasksAPI", "d": "Get all visible tasks", "res": [{"id": 21, "title": "Create login UI", "description": "Build login page", "assigned_to": 9, "assigned_to_name": "Rahul Sharma", "created_by": 5, "created_by_name": "Manager One", "company": 1, "status": "IN_PROGRESS", "priority": "HIGH", "due_date": "2026-04-10", "attachment": None, "image": None, "reference_link": "https://example.com/spec", "progress": 60, "created_at": "2026-03-28T12:30:00Z", "project": 3}]},
            {"m": "GET", "u": "/api/task-analytics/", "v": "TaskAnalyticsAPI", "d": "Get task analytics", "res": {"total_tasks": 120, "completed_tasks": 78, "overdue_tasks": 5}},
            {"m": "GET", "u": "/api/team-leaves/", "v": "TeamLeaveListAPI", "d": "Get team leave requests", "res": [{"id": 12, "company_user_id": 9, "employee_name": "Rahul Sharma", "employee_role": "EMPLOYEE", "start_date": "2026-04-02", "end_date": "2026-04-04", "reason": "Medical leave", "status": "PENDING", "applied_on": "2026-03-30T09:00:00Z"}]},
            {"m": "GET", "u": "/api/all-projects/", "v": "AllProjectsAPI", "d": "List company projects", "res": [{"id": 3, "name": "HRMS Platform", "status": "ACTIVE", "progress": 70, "priority": "HIGH", "start_date": "2026-03-01", "end_date": "2026-06-30"}]},
            {"m": "GET", "u": "/api/client-projects/", "v": "ClientProjectsProgressAPI", "d": "Get client project progress", "res": [{"id": 3, "name": "HRMS Platform", "progress": 70, "status": "ACTIVE", "start_date": "2026-03-01", "end_date": "2026-06-30", "budget": "250000.00", "actual_cost": "140000.00"}]},
            {"m": "GET", "u": "/api/manager-projects/", "v": "ManagerProjectsAPI", "d": "Get manager's projects", "res": [{"id": 3, "name": "HRMS Platform", "status": "ACTIVE", "progress": 70, "priority": "HIGH", "start_date": "2026-03-01", "end_date": "2026-06-30"}]},
            {"m": "GET", "u": "/api/manager-overview/", "v": "ManagerOverviewAPI", "d": "Get manager dashboard overview", "res": {"total_projects": 6, "total_tasks": 32, "completed_tasks": 18, "pending_tasks": 7, "in_progress_tasks": 7, "overdue_tasks": 2}},
        ],
    },
    {
        "name": "HR",
        "endpoints": [
            {"m": "GET", "u": "/api/profile/", "v": "MyProfileAPI", "d": "Get employee profile", "res": {"id": 4, "department": {"id": 2, "name": "Engineering", "description": "Product engineering department"}, "designation": "Frontend Developer", "date_joined": "2025-12-01", "salary": "65000.00", "phone": "9876543210", "address": "Jaipur"}},
            {"m": "PUT", "u": "/api/profile/", "v": "MyProfileAPI", "d": "Update employee profile", "req": {"department_id": 2, "designation": "Frontend Developer", "date_joined": "2025-12-01", "salary": "65000.00", "phone": "9876543210", "address": "Jaipur"}, "res": {"id": 4, "department": {"id": 2, "name": "Engineering", "description": "Product engineering department"}, "designation": "Frontend Developer", "date_joined": "2025-12-01", "salary": "65000.00", "phone": "9876543210", "address": "Jaipur"}},
            {"m": "GET", "u": "/api/departments/", "v": "DepartmentListCreateAPI", "d": "List departments", "res": [{"id": 2, "name": "Engineering", "description": "Product engineering department"}]},
            {"m": "POST", "u": "/api/departments/", "v": "DepartmentListCreateAPI", "d": "Create department", "req": {"name": "Engineering", "description": "Product engineering department"}, "res": {"id": 2, "name": "Engineering", "description": "Product engineering department"}},
            {"m": "GET", "u": "/api/attendance/", "v": "MyAttendanceAPI", "d": "Get attendance records", "res": [{"id": 11, "company_user_id": 9, "employee_name": "Rahul Sharma", "employee_role": "EMPLOYEE", "date": "2026-03-30", "check_in": "09:15:00", "check_out": "18:05:00", "status": "PRESENT"}]},
            {"m": "PATCH", "u": "/api/leave/{leave_id}/status/", "v": "UpdateLeaveStatusAPI", "d": "Update leave status", "req": {"status": "APPROVED"}, "res": {"id": 12, "company_user_id": 9, "employee_name": "Rahul Sharma", "employee_role": "EMPLOYEE", "start_date": "2026-04-02", "end_date": "2026-04-04", "reason": "Medical leave", "status": "APPROVED", "applied_on": "2026-03-30T09:00:00Z"}},
            {"m": "POST", "u": "/api/review/{employee_id}/", "v": "AddPerformanceReviewAPI", "d": "Add performance review", "req": {"rating": 4, "feedback": "Consistent performer with strong ownership."}, "res": {"id": 6, "rating": 4, "feedback": "Consistent performer with strong ownership.", "review_date": "2026-03-30"}},
            {"m": "GET", "u": "/api/hr-dashboard/", "v": "HRDashboardAPI", "d": "Get HR dashboard overview", "res": {"total_employees": 25, "attendance": {"present": 20, "absent": 2, "half_day": 1, "on_leave": 2, "attendance_percentage": 80}, "leave_summary": {"approved": 6, "pending": 3, "rejected": 1}}},
        ],
    },
    {
        "name": "Projects",
        "endpoints": [
            {"m": "GET", "u": "/api/projects/", "v": "ProjectViewSet", "d": "List projects", "res": [{"id": 3, "company": 1, "client": 14, "manager": 5, "name": "HRMS Platform", "description": "Internal HR management system", "status": "ACTIVE", "priority": "HIGH", "start_date": "2026-03-01", "end_date": "2026-06-30", "budget": "250000.00", "actual_cost": "140000.00", "progress": 70, "is_active": True, "created_at": "2026-03-01T10:00:00Z"}]},
            {"m": "POST", "u": "/api/projects/", "v": "ProjectViewSet", "d": "Create project", "req": {"client": 14, "manager": 5, "name": "HRMS Platform", "description": "Internal HR management system", "status": "ACTIVE", "priority": "HIGH", "start_date": "2026-03-01", "end_date": "2026-06-30", "budget": "250000.00", "actual_cost": "0.00", "is_active": True}, "res": {"id": 3, "company": 1, "client": 14, "manager": 5, "name": "HRMS Platform", "description": "Internal HR management system", "status": "ACTIVE", "priority": "HIGH", "start_date": "2026-03-01", "end_date": "2026-06-30", "budget": "250000.00", "actual_cost": "0.00", "progress": 0, "is_active": True, "created_at": "2026-03-01T10:00:00Z"}},
            {"m": "GET", "u": "/api/projects/{id}/", "v": "ProjectViewSet", "d": "Retrieve project", "res": {"id": 3, "company": 1, "client": 14, "manager": 5, "name": "HRMS Platform", "description": "Internal HR management system", "status": "ACTIVE", "priority": "HIGH", "start_date": "2026-03-01", "end_date": "2026-06-30", "budget": "250000.00", "actual_cost": "140000.00", "progress": 70, "is_active": True, "created_at": "2026-03-01T10:00:00Z"}},
            {"m": "PUT", "u": "/api/projects/{id}/", "v": "ProjectViewSet", "d": "Update project", "req": {"client": 14, "manager": 5, "name": "HRMS Platform", "description": "Internal HR management system updated", "status": "ACTIVE", "priority": "HIGH", "start_date": "2026-03-01", "end_date": "2026-07-15", "budget": "250000.00", "actual_cost": "160000.00", "is_active": True}, "res": {"id": 3, "company": 1, "client": 14, "manager": 5, "name": "HRMS Platform", "description": "Internal HR management system updated", "status": "ACTIVE", "priority": "HIGH", "start_date": "2026-03-01", "end_date": "2026-07-15", "budget": "250000.00", "actual_cost": "160000.00", "progress": 70, "is_active": True, "created_at": "2026-03-01T10:00:00Z"}},
            {"m": "PATCH", "u": "/api/projects/{id}/", "v": "ProjectViewSet", "d": "Partial update project", "req": {"status": "ON_HOLD", "priority": "MEDIUM"}, "res": {"id": 3, "company": 1, "client": 14, "manager": 5, "name": "HRMS Platform", "description": "Internal HR management system", "status": "ON_HOLD", "priority": "MEDIUM", "start_date": "2026-03-01", "end_date": "2026-06-30", "budget": "250000.00", "actual_cost": "140000.00", "progress": 70, "is_active": True, "created_at": "2026-03-01T10:00:00Z"}},
            {"m": "DELETE", "u": "/api/projects/{id}/", "v": "ProjectViewSet", "d": "Delete project", "res": {}},
            {"m": "PATCH", "u": "/api/projects/{id}/assign_client/", "v": "ProjectViewSet.assign_client", "d": "Assign client to project", "req": {"client": 14}, "res": {"message": "Client assigned successfully"}},
            {"m": "PATCH", "u": "/api/projects/{id}/deactivate/", "v": "ProjectViewSet.deactivate", "d": "Soft deactivate project", "req": {}, "res": {"message": "Project deactivated"}},
        ],
    },
    {
        "name": "Tasks",
        "endpoints": [
            {"m": "GET", "u": "/api/tasks/", "v": "TaskViewSet", "d": "List tasks", "res": [{"id": 21, "title": "Create login UI", "description": "Build login page", "assigned_to": 9, "assigned_to_name": "Rahul Sharma", "created_by": 5, "created_by_name": "Manager One", "company": 1, "status": "IN_PROGRESS", "priority": "HIGH", "due_date": "2026-04-10", "attachment": None, "image": None, "reference_link": "https://example.com/spec", "progress": 60, "created_at": "2026-03-28T12:30:00Z", "project": 3}]},
            {"m": "POST", "u": "/api/tasks/", "v": "TaskViewSet", "d": "Create task", "req": {"title": "Create login UI", "description": "Build login page", "assigned_to": 9, "status": "PENDING", "priority": "HIGH", "due_date": "2026-04-10", "attachment": None, "image": None, "reference_link": "https://example.com/spec", "project": 3}, "res": {"id": 21, "title": "Create login UI", "description": "Build login page", "assigned_to": 9, "assigned_to_name": "Rahul Sharma", "created_by": 5, "created_by_name": "Manager One", "company": 1, "status": "PENDING", "priority": "HIGH", "due_date": "2026-04-10", "attachment": None, "image": None, "reference_link": "https://example.com/spec", "created_at": "2026-03-28T12:30:00Z", "project": 3}},
            {"m": "GET", "u": "/api/tasks/{id}/", "v": "TaskViewSet", "d": "Retrieve task", "res": {"id": 21, "title": "Create login UI", "description": "Build login page", "assigned_to": 9, "assigned_to_name": "Rahul Sharma", "created_by": 5, "created_by_name": "Manager One", "company": 1, "status": "IN_PROGRESS", "priority": "HIGH", "due_date": "2026-04-10", "attachment": None, "image": None, "reference_link": "https://example.com/spec", "progress": 60, "created_at": "2026-03-28T12:30:00Z", "project": 3}},
            {"m": "PUT", "u": "/api/tasks/{id}/", "v": "TaskViewSet", "d": "Update task", "req": {"title": "Create login UI", "description": "Build login page with OTP support", "assigned_to": 9, "status": "IN_PROGRESS", "priority": "HIGH", "due_date": "2026-04-12", "attachment": None, "image": None, "reference_link": "https://example.com/spec-v2", "progress": 60, "project": 3}, "res": {"id": 21, "title": "Create login UI", "description": "Build login page with OTP support", "assigned_to": 9, "assigned_to_name": "Rahul Sharma", "created_by": 5, "created_by_name": "Manager One", "company": 1, "status": "IN_PROGRESS", "priority": "HIGH", "due_date": "2026-04-12", "attachment": None, "image": None, "reference_link": "https://example.com/spec-v2", "progress": 60, "created_at": "2026-03-28T12:30:00Z", "project": 3}},
            {"m": "PATCH", "u": "/api/tasks/{id}/", "v": "TaskViewSet", "d": "Partial update task", "req": {"status": "COMPLETED", "progress": 100}, "res": {"id": 21, "title": "Create login UI", "description": "Build login page", "assigned_to": 9, "assigned_to_name": "Rahul Sharma", "created_by": 5, "created_by_name": "Manager One", "company": 1, "status": "COMPLETED", "priority": "HIGH", "due_date": "2026-04-10", "attachment": None, "image": None, "reference_link": "https://example.com/spec", "progress": 100, "created_at": "2026-03-28T12:30:00Z", "project": 3}},
            {"m": "DELETE", "u": "/api/tasks/{id}/", "v": "TaskViewSet", "d": "Delete task", "res": {}},
        ],
    },
]


def j(value):
    return json.dumps(value, indent=2, ensure_ascii=True)


def build_markdown():
    total = sum(len(g["endpoints"]) for g in API_GROUPS)
    lines = [
        "# Backend API Documentation",
        "",
        "This document lists discovered backend APIs with URL, method, and sample JSON format.",
        "",
        "## Notes",
        "",
    ]
    for note in NOTES:
        lines.append(f"- {note}")
    lines.extend(["", f"Total discovered API entries: {total}", ""])
    for group in API_GROUPS:
        lines.extend([f"## {group['name']}", ""])
        for i, ep in enumerate(group["endpoints"], start=1):
            lines.extend([
                f"### {i}. {ep['m']} {ep['u']}",
                "",
                f"- View: `{ep['v']}`",
                f"- Description: {ep['d']}",
                "",
            ])
            if "req" in ep:
                lines.extend(["#### Request JSON", "", "```json", j(ep["req"]), "```", ""])
            lines.extend(["#### Response JSON", "", "```json", j(ep["res"]), "```", ""])
    return "\n".join(lines)


def pdf_escape(text):
    return text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def wrap(text, max_chars=95):
    if text == "":
        return [""]
    words = text.split()
    if not words:
        return [""]
    out, cur = [], ""
    for word in words:
        cand = word if not cur else f"{cur} {word}"
        if len(cand) <= max_chars:
            cur = cand
        else:
            out.append(cur)
            cur = word
    if cur:
        out.append(cur)
    return out


def markdown_to_lines(md):
    lines = []
    code = False
    for raw in md.splitlines():
        if raw.startswith("```"):
            code = not code
            continue
        if code:
            lines.extend([f"    {x}" for x in wrap(raw, 90)])
            continue
        if raw.startswith("# "):
            lines.extend([raw[2:].upper(), ""])
            continue
        if raw.startswith("## "):
            title = raw[3:]
            lines.extend([title, "-" * len(title)])
            continue
        if raw.startswith("### "):
            lines.append(raw[4:])
            continue
        if raw.startswith("#### "):
            lines.append(raw[5:] + ":")
            continue
        if raw.startswith("- "):
            lines.extend(wrap("* " + raw[2:]))
            continue
        if raw == "":
            lines.append("")
            continue
        lines.extend(wrap(raw))
    return lines


def make_pdf(lines):
    page_width, page_height = 595, 842
    margin_left, top, line_height, per_page = 40, 800, 12, 60
    pages = [lines[i:i + per_page] for i in range(0, len(lines), per_page)] or [["No content"]]
    objs, page_ids, content_ids = [], [], []
    for page in pages:
        stream_lines = ["BT", "/F1 9 Tf", f"{margin_left} {top} Td"]
        first = True
        for line in page:
            esc = pdf_escape(line)
            if first:
                stream_lines.append(f"({esc}) Tj")
                first = False
            else:
                stream_lines.extend([f"0 -{line_height} Td", f"({esc}) Tj"])
        stream_lines.append("ET")
        stream = "\n".join(stream_lines).encode("latin-1", errors="replace")
        objs.append(f"<< /Length {len(stream)} >>\nstream\n".encode("latin-1") + stream + b"\nendstream")
        content_ids.append(len(objs) + 3)
        objs.append(f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {page_width} {page_height}] /Contents {content_ids[-1]} 0 R /Resources << /Font << /F1 3 0 R >> >> >>".encode("latin-1"))
        page_ids.append(len(objs) + 2)
    catalog = b"<< /Type /Catalog /Pages 2 0 R >>"
    kids = " ".join(f"{pid} 0 R" for pid in page_ids)
    pages_obj = f"<< /Type /Pages /Kids [{kids}] /Count {len(page_ids)} >>".encode("latin-1")
    font = b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
    ordered = [catalog, pages_obj, font] + objs
    pdf = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for i, obj in enumerate(ordered, start=1):
        offsets.append(len(pdf))
        pdf.extend(f"{i} 0 obj\n".encode("latin-1"))
        pdf.extend(obj)
        pdf.extend(b"\nendobj\n")
    startxref = len(pdf)
    pdf.extend(f"xref\n0 {len(ordered)+1}\n".encode("latin-1"))
    pdf.extend(b"0000000000 65535 f \n")
    for off in offsets[1:]:
        pdf.extend(f"{off:010d} 00000 n \n".encode("latin-1"))
    pdf.extend(f"trailer\n<< /Size {len(ordered)+1} /Root 1 0 R >>\nstartxref\n{startxref}\n%%EOF".encode("latin-1"))
    return bytes(pdf)


def main():
    md = build_markdown()
    OUTPUT_MD.write_text(md, encoding="utf-8")
    OUTPUT_PDF.write_bytes(make_pdf(markdown_to_lines(md)))
    print(f"Markdown written to: {OUTPUT_MD}")
    print(f"PDF written to: {OUTPUT_PDF}")
    print(f"Total API entries: {sum(len(g['endpoints']) for g in API_GROUPS)}")


if __name__ == "__main__":
    main()
