"""Reusable tenant and role-hierarchy authorization policies."""

from rest_framework.exceptions import PermissionDenied

from .utils import get_company_user, get_permission_dict


ROLE_PERMISSION_FIELDS = (
    "can_manage_company",
    "can_manage_roles",
    "can_manage_users",
    "can_create_project",
    "can_assign_task",
    "can_view_all_tasks",
    "can_view_team_tasks",
    "can_view_assigned_tasks",
    "can_update_task_status",
    "can_view_project_progress",
    "can_manage_hr",
    "can_approve_leave",
    "can_view_attendance",
    "can_manage_payroll",
)


def current_company_user(request):
    company_user = get_company_user(request.user)
    if not company_user:
        raise PermissionDenied("Your account is not linked to a company.")
    return company_user


def require_permission(request, permission_name):
    company_user = current_company_user(request)
    if not get_permission_dict(company_user.role).get(permission_name):
        raise PermissionDenied("You do not have permission to perform this action.")
    return company_user


def require_company_management(request):
    company_user = current_company_user(request)
    if not get_permission_dict(company_user.role).get("can_manage_company"):
        raise PermissionDenied("Only a company owner can perform this action.")
    return company_user


def ensure_manageable_member(actor, target, replacement_role=None):
    """A manager may only change a lower-level member in their own tenant."""
    if target.company_id != actor.company_id:
        raise PermissionDenied("The user belongs to another company.")
    if target.role.level >= actor.role.level:
        raise PermissionDenied("You cannot manage a user with equal or higher authority.")
    if replacement_role:
        if replacement_role.company_id != actor.company_id:
            raise PermissionDenied("The role belongs to another company.")
        if replacement_role.level >= actor.role.level:
            raise PermissionDenied("You cannot assign an equal or higher role.")


def ensure_role_permissions_within_authority(actor, role, proposed_values):
    """Delegated roles cannot have capabilities the actor does not possess."""
    if role.company_id != actor.company_id:
        raise PermissionDenied("The role belongs to another company.")
    proposed_level = proposed_values.get("level", role.level)
    if proposed_level >= actor.role.level:
        raise PermissionDenied("You cannot create or modify an equal or higher role.")
    if get_permission_dict(actor.role).get("can_manage_company"):
        return
    for field_name in ROLE_PERMISSION_FIELDS:
        if proposed_values.get(field_name, getattr(role, field_name)) and not getattr(actor.role, field_name):
            raise PermissionDenied("You cannot delegate a permission you do not have.")
