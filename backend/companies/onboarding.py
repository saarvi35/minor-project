"""Tenant-safe workbook onboarding for company owners."""

import csv
import io
from datetime import date
from decimal import Decimal, InvalidOperation

from django.contrib.auth import get_user_model
from django.db import transaction

from hr.models import Department, EmployeeProfile
from projects.models import Project
from tasks.models import Task, TaskActivity

from .models import CompanyUser, Role


MAX_IMPORT_BYTES = 5 * 1024 * 1024
REQUIRED_SHEETS = ("Employees", "Projects", "Tasks")
ROLE_DEFAULTS = {
    "OWNER": {"level": 100, "can_manage_company": True, "can_manage_roles": True, "can_manage_users": True, "can_create_project": True, "can_assign_task": True, "can_view_all_tasks": True, "can_view_team_tasks": True, "can_view_assigned_tasks": True, "can_update_task_status": True, "can_view_project_progress": True, "can_manage_hr": True, "can_approve_leave": True, "can_view_attendance": True, "can_manage_payroll": True},
    "MANAGER": {"level": 90, "can_create_project": True, "can_assign_task": True, "can_view_all_tasks": True, "can_view_team_tasks": True, "can_view_assigned_tasks": True, "can_update_task_status": True, "can_view_project_progress": True},
    "HR": {"level": 80, "can_view_assigned_tasks": True, "can_update_task_status": True, "can_manage_hr": True, "can_approve_leave": True, "can_view_attendance": True},
    "EMPLOYEE": {"level": 40, "can_view_assigned_tasks": True, "can_update_task_status": True},
    "CLIENT": {"level": 20, "can_view_project_progress": True},
}
PROJECT_STATUSES = {"ACTIVE", "COMPLETED", "ON_HOLD"}
TASK_STATUSES = {"PENDING", "IN_PROGRESS", "COMPLETED"}
PRIORITIES = {"LOW", "MEDIUM", "HIGH", "CRITICAL"}


def value(row, key):
    raw = row.get(key, "")
    return str(raw).strip() if raw is not None else ""


def parse_date(raw, field, row_number, errors):
    if not raw:
        return None
    if isinstance(raw, date):
        return raw
    try:
        return date.fromisoformat(str(raw).strip())
    except ValueError:
        errors.append(f"{field} on row {row_number} must use YYYY-MM-DD.")
        return None


def parse_decimal(raw, field, row_number, errors):
    if raw in (None, ""):
        return None
    try:
        return Decimal(str(raw))
    except (InvalidOperation, ValueError):
        errors.append(f"{field} on row {row_number} must be a number.")
        return None


def read_workbook(uploaded_file):
    filename = str(getattr(uploaded_file, "name", "")).lower()
    declared_content_type = str(getattr(uploaded_file, "content_type", "")).lower()
    content = uploaded_file.read()
    if len(content) > MAX_IMPORT_BYTES:
        raise ValueError("The file is larger than 5 MB.")
    if filename.endswith(".csv"):
        if declared_content_type and declared_content_type not in {"text/csv", "application/csv", "application/vnd.ms-excel"}:
            raise ValueError("The uploaded file type does not match a CSV roster.")
        rows = list(csv.DictReader(io.StringIO(content.decode("utf-8-sig"))))
        return {"Employees": rows, "Projects": [], "Tasks": []}, ["CSV imports support the Employees roster only. Use the Excel template for projects and tasks."]
    if not filename.endswith(".xlsx"):
        raise ValueError("Upload an .xlsx workbook or a .csv roster file.")
    if declared_content_type and declared_content_type not in {
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/octet-stream",
    }:
        raise ValueError("The uploaded file type does not match an Excel workbook.")
    try:
        from openpyxl import load_workbook
    except ImportError as error:
        raise ValueError("Excel support is not installed on this server. Install openpyxl and restart the backend.") from error
    try:
        workbook = load_workbook(io.BytesIO(content), read_only=True, data_only=True)
    except Exception as error:
        raise ValueError("The workbook could not be read. Download a new template and try again.") from error
    missing = [sheet for sheet in REQUIRED_SHEETS if sheet not in workbook.sheetnames]
    if missing:
        raise ValueError(f"Missing worksheet(s): {', '.join(missing)}.")
    data = {}
    for sheet_name in REQUIRED_SHEETS:
        rows = list(workbook[sheet_name].iter_rows(values_only=True))
        if not rows:
            data[sheet_name] = []
            continue
        headers = [str(item).strip() if item is not None else "" for item in rows[0]]
        data[sheet_name] = [{headers[index]: row[index] if index < len(row) else "" for index in range(len(headers))} for row in rows[1:] if any(cell not in (None, "") for cell in row)]
    return data, []


def validate_rows(data, company):
    errors, warnings = [], []
    employees, projects, tasks = data["Employees"], data["Projects"], data["Tasks"]
    imported_emails = set()
    known_emails = {str(email).lower() for email in CompanyUser.objects.filter(company=company).values_list("email", flat=True) if email}
    User = get_user_model()
    known_project_names = set(Project.objects.filter(company=company).values_list("name", flat=True))
    imported_project_names = set()
    for row_number, row in enumerate(employees, start=2):
        name, email, role = value(row, "name"), value(row, "email").lower(), value(row, "role").upper()
        if not name or not email or not role:
            errors.append(f"Employees row {row_number} needs name, email, and role.")
            continue
        if "@" not in email:
            errors.append(f"Employees row {row_number} has an invalid email.")
        if role not in ROLE_DEFAULTS or role == "OWNER":
            errors.append(f"Employees row {row_number} has an unsupported role: {role}.")
        if email in imported_emails:
            errors.append(f"Employees row {row_number} repeats {email}.")
        existing_user = User.objects.filter(email__iexact=email).first()
        if existing_user and CompanyUser.objects.filter(user=existing_user).exclude(company=company).exists():
            errors.append(f"Employees row {row_number} email already belongs to another company tenant.")
        imported_emails.add(email)
    available_emails = known_emails | imported_emails
    project_names = known_project_names.copy()
    for row_number, row in enumerate(projects, start=2):
        name, manager_email, client_email = value(row, "name"), value(row, "manager_email").lower(), value(row, "client_email").lower()
        priority, status = value(row, "priority").upper() or "MEDIUM", value(row, "status").upper() or "ACTIVE"
        start_date = parse_date(row.get("start_date"), "start_date", row_number, errors)
        end_date = parse_date(row.get("end_date"), "end_date", row_number, errors)
        parse_decimal(row.get("budget"), "budget", row_number, errors)
        parse_decimal(row.get("actual_cost"), "actual_cost", row_number, errors)
        if not name or not manager_email or not start_date:
            errors.append(f"Projects row {row_number} needs name, manager_email, and start_date.")
        if name in imported_project_names:
            errors.append(f"Projects row {row_number} repeats project name {name}.")
        imported_project_names.add(name)
        if manager_email and manager_email not in available_emails:
            errors.append(f"Projects row {row_number} manager_email is not a company member.")
        if client_email and client_email not in available_emails:
            errors.append(f"Projects row {row_number} client_email is not a company member.")
        if priority not in PRIORITIES or status not in PROJECT_STATUSES:
            errors.append(f"Projects row {row_number} has an invalid priority or status.")
        if start_date and end_date and end_date < start_date:
            errors.append(f"Projects row {row_number} ends before it starts.")
        project_names.add(name)
    imported_task_keys = set()
    for row_number, row in enumerate(tasks, start=2):
        title, project_name, assignee_email = value(row, "title"), value(row, "project_name"), value(row, "assigned_to_email").lower()
        priority, status = value(row, "priority").upper() or "MEDIUM", value(row, "status").upper() or "PENDING"
        if not title or not project_name or not assignee_email:
            errors.append(f"Tasks row {row_number} needs title, project_name, and assigned_to_email.")
        task_key = (project_name, title)
        if task_key in imported_task_keys:
            errors.append(f"Tasks row {row_number} repeats task '{title}' in project '{project_name}'.")
        imported_task_keys.add(task_key)
        if project_name and project_name not in project_names:
            errors.append(f"Tasks row {row_number} refers to an unknown project.")
        if assignee_email and assignee_email not in available_emails:
            errors.append(f"Tasks row {row_number} assigned_to_email is not a company member.")
        if priority not in PRIORITIES or status not in TASK_STATUSES:
            errors.append(f"Tasks row {row_number} has an invalid priority or status.")
        if priority == "CRITICAL":
            warnings.append(f"Tasks row {row_number}: CRITICAL is mapped to HIGH because tasks currently support Low, Medium, and High.")
        parse_date(row.get("due_date"), "due_date", row_number, errors)
        try:
            if not 0 <= int(value(row, "progress") or 0) <= 100:
                raise ValueError
        except ValueError:
            errors.append(f"Tasks row {row_number} progress must be between 0 and 100.")
    return errors, warnings


def import_workbook(data, company, owner):
    errors, warnings = validate_rows(data, company)
    summary = {"employees": len(data["Employees"]), "projects": len(data["Projects"]), "tasks": len(data["Tasks"])}
    if errors:
        return {"valid": False, "summary": summary, "errors": errors, "warnings": warnings}
    User = get_user_model()
    created_member_ids = []
    with transaction.atomic():
        members = {member.email.lower(): member for member in CompanyUser.objects.filter(company=company).select_related("user") if member.email}
        role_cache = {role.name.upper(): role for role in Role.objects.filter(company=company)}
        department_cache = {department.name.lower(): department for department in Department.objects.filter(company=company)}
        for row in data["Employees"]:
            name, email, role_name = value(row, "name"), value(row, "email").lower(), value(row, "role").upper()
            role = role_cache.get(role_name)
            if not role:
                role = Role.objects.create(company=company, name=role_name, **ROLE_DEFAULTS[role_name])
                role_cache[role_name] = role
            user = User.objects.filter(email__iexact=email).first()
            created_user = False
            if not user:
                user = User.objects.create(username=email, email=email, first_name=name, is_active=False)
                user.set_unusable_password()
                user.save(update_fields=["password"])
                created_user = True
            member, created_member = CompanyUser.objects.update_or_create(company=company, email=email, defaults={"user": user, "name": name, "role": role, "status": "INVITED" if created_user else (value(row, "status").upper() or "INVITED")})
            if created_user or created_member:
                member.issue_invitation()
                created_member_ids.append(member.id)
            members[email] = member
            department_name = value(row, "department")
            if department_name:
                department = department_cache.get(department_name.lower()) or Department.objects.create(company=company, name=department_name)
                department_cache[department_name.lower()] = department
                EmployeeProfile.objects.update_or_create(company_user=member, defaults={"department": department, "designation": value(row, "designation")})
        projects = {project.name: project for project in Project.objects.filter(company=company)}
        for row in data["Projects"]:
            name = value(row, "name")
            project_data = {"description": value(row, "description"), "manager": members[value(row, "manager_email").lower()], "client": members.get(value(row, "client_email").lower()) or None, "priority": value(row, "priority").upper() or "MEDIUM", "status": value(row, "status").upper() or "ACTIVE", "start_date": date.fromisoformat(value(row, "start_date")), "end_date": date.fromisoformat(value(row, "end_date")) if value(row, "end_date") else None, "budget": Decimal(value(row, "budget")) if value(row, "budget") else None, "actual_cost": Decimal(value(row, "actual_cost")) if value(row, "actual_cost") else None, "is_active": (value(row, "status").upper() or "ACTIVE") != "COMPLETED"}
            project = Project.objects.filter(company=company, name=name).order_by("id").first()
            if project:
                for field_name, field_value in project_data.items():
                    setattr(project, field_name, field_value)
                project.save(update_fields=list(project_data))
            else:
                project = Project.objects.create(company=company, name=name, **project_data)
            projects[name] = project
        for row in data["Tasks"]:
            priority = value(row, "priority").upper() or "MEDIUM"
            task_data = {"description": value(row, "description"), "assigned_to": members[value(row, "assigned_to_email").lower()], "created_by": owner, "priority": "HIGH" if priority == "CRITICAL" else priority, "status": value(row, "status").upper() or "PENDING", "progress": int(value(row, "progress") or 0), "due_date": date.fromisoformat(value(row, "due_date")) if value(row, "due_date") else None, "reference_link": value(row, "reference_link") or None, "is_archived": False, "archived_at": None}
            project = projects[value(row, "project_name")]
            task = Task.objects.filter(company=company, title=value(row, "title"), project=project).order_by("id").first()
            if task:
                for field_name, field_value in task_data.items():
                    setattr(task, field_name, field_value)
                task.save(update_fields=list(task_data))
            else:
                Task.objects.create(company=company, title=value(row, "title"), project=project, **task_data)
        for project in projects.values():
            progress = list(project.tasks.filter(is_archived=False).values_list("progress", flat=True))
            project.progress = round(sum(progress) / len(progress)) if progress else 0
            project.save(update_fields=["progress"])
        task = Task.objects.filter(company=company).order_by("-id").first()
        if task:
            TaskActivity.objects.create(task=task, actor=owner, event_type="onboarding_import", summary="Company workspace data imported from an onboarding workbook.")
    return {
        "valid": True,
        "summary": summary,
        "errors": [],
        "warnings": warnings,
        "new_member_ids": created_member_ids,
    }
