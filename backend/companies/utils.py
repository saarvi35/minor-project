from .models import CompanyUser

def get_company_user(user):
    return (
        CompanyUser.objects
        .select_related("role", "company")
        .filter(user=user)
        .first()
    )


def get_permission_dict(role):
    """
    Returns all role permissions as a dictionary
    """
    if not role:
        return {}

    # 🔹 Collect all boolean permission fields
    permissions = {
        "can_manage_company": role.can_manage_company,
        "can_manage_roles": role.can_manage_roles,
        "can_manage_users": role.can_manage_users,
        "can_create_project": role.can_create_project,
        "can_assign_task": role.can_assign_task,
        "can_view_all_tasks": role.can_view_all_tasks,
        "can_view_team_tasks": role.can_view_team_tasks,
        "can_view_assigned_tasks": role.can_view_assigned_tasks,
        "can_update_task_status": role.can_update_task_status,
        "can_view_project_progress": role.can_view_project_progress,
        "can_manage_hr": role.can_manage_hr,
        "can_approve_leave": role.can_approve_leave,
        "can_view_attendance": role.can_view_attendance,
        "can_manage_payroll": role.can_manage_payroll,
    }

    return permissions