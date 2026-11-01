from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from accounts.models import User
from companies.models import Company, CompanyUser, Role
from hr.models import Attendance, Department, EmployeeProfile, LeaveRequest, PerformanceReview
from projects.models import Project
from tasks.models import Task, TaskActivity, TaskComment, TaskNotification
from tasks.services import sync_project_progress
from workflows.models import WorkflowRule


DEMO_PASSWORD = "WorkZenDemo@2026"


class Command(BaseCommand):
    help = "Create three isolated demo companies for multi-tenancy demonstrations."

    def ensure_login(self, email, name):
        user, _ = User.objects.get_or_create(username=email, defaults={"email": email})
        user.username = email
        user.email = email
        user.first_name = name.split()[0]
        user.last_name = " ".join(name.split()[1:])
        user.is_active = True
        user.set_password(DEMO_PASSWORD)
        user.save()
        return user

    def ensure_member(self, company, role, name, email, can_login=False):
        user = self.ensure_login(email, name) if can_login else None
        member, _ = CompanyUser.objects.get_or_create(
            company=company,
            email=email,
            defaults={"name": name, "role": role, "status": "ACTIVE", "user": user},
        )
        member.name = name
        member.role = role
        member.status = "ACTIVE"
        if user:
            member.user = user
        member.save()
        return member

    def handle(self, *args, **options):
        today = timezone.localdate()
        company_specs = [
            {
                "name": "Nimbus Retail Pvt Ltd",
                "email": "contact@nimbus-retail.demo",
                "phone": "9876501001",
                "size": "51-200",
                "address": "Bengaluru, Karnataka",
                "owner": ("Priya Nair", "priya.owner@nimbus.demo"),
                "manager": ("Arjun Kapoor", "arjun.manager@nimbus.demo"),
                "hr": ("Kavya Menon", "kavya.hr@nimbus.demo"),
                "client": ("Riya Shah", "riya.client@nimbus.demo"),
                "employees": [("Dev Patel", "dev.employee@nimbus.demo"), ("Sana Khan", "sana.employee@nimbus.demo")],
                "projects": [
                    ("Retail Storefront Modernisation", "HIGH", -30, 12, 45, 180000, 128000),
                    ("Inventory Forecasting Rollout", "MEDIUM", -18, 24, 58, 95000, 41000),
                ],
            },
            {
                "name": "GreenGrid Logistics",
                "email": "contact@greengrid-logistics.demo",
                "phone": "9876501002",
                "size": "201-500",
                "address": "Pune, Maharashtra",
                "owner": ("Vikram Rao", "vikram.owner@greengrid.demo"),
                "manager": ("Neha Singh", "neha.manager@greengrid.demo"),
                "hr": ("Pooja Malhotra", "pooja.hr@greengrid.demo"),
                "client": ("Kunal Joshi", "kunal.client@greengrid.demo"),
                "employees": [("Ishaan Gupta", "ishaan.employee@greengrid.demo"), ("Tara Bose", "tara.employee@greengrid.demo")],
                "projects": [
                    ("Fleet Visibility Platform", "HIGH", -38, -2, 42, 240000, 232000),
                    ("Warehouse Optimisation", "MEDIUM", -12, 30, 35, 135000, 50000),
                ],
            },
            {
                "name": "Atlas Health Analytics",
                "email": "contact@atlas-health.demo",
                "phone": "9876501003",
                "size": "51-200",
                "address": "Hyderabad, Telangana",
                "owner": ("Ananya Desai", "ananya.owner@atlas.demo"),
                "manager": ("Rohan Verma", "rohan.manager@atlas.demo"),
                "hr": ("Sneha Kulkarni", "sneha.hr@atlas.demo"),
                "client": ("Maya Thomas", "maya.client@atlas.demo"),
                "employees": [("Nikhil Roy", "nikhil.employee@atlas.demo"), ("Leena Paul", "leena.employee@atlas.demo")],
                "projects": [
                    ("Clinical Insights Portal", "HIGH", -26, 9, 50, 210000, 150000),
                    ("Compliance Reporting Dashboard", "MEDIUM", -15, 35, 40, 120000, 46000),
                ],
            },
        ]

        created_companies = []
        total_tasks = 0
        for spec in company_specs:
            owner_user = self.ensure_login(spec["owner"][1], spec["owner"][0])
            company, _ = Company.objects.update_or_create(
                email=spec["email"],
                defaults={
                    "name": spec["name"], "phone": spec["phone"], "size": spec["size"],
                    "address": spec["address"], "owner": owner_user,
                },
            )
            created_companies.append(company.name)

            role_defaults = {
                "OWNER": {"level": 100, "can_manage_company": True, "can_manage_roles": True, "can_manage_users": True, "can_create_project": True, "can_assign_task": True, "can_view_all_tasks": True, "can_view_team_tasks": True, "can_view_assigned_tasks": True, "can_update_task_status": True, "can_view_project_progress": True, "can_manage_hr": True, "can_approve_leave": True, "can_view_attendance": True, "can_manage_payroll": True},
                "manager": {"level": 90, "can_create_project": True, "can_assign_task": True, "can_view_all_tasks": True, "can_view_team_tasks": True, "can_view_assigned_tasks": True, "can_update_task_status": True, "can_view_project_progress": True},
                "HR": {"level": 80, "can_view_assigned_tasks": True, "can_update_task_status": True, "can_manage_hr": True, "can_approve_leave": True, "can_view_attendance": True},
                "employee": {"level": 40, "can_view_assigned_tasks": True, "can_update_task_status": True},
                "client": {"level": 20, "can_view_project_progress": True},
            }
            roles = {}
            for role_name, defaults in role_defaults.items():
                role, _ = Role.objects.update_or_create(company=company, name=role_name, defaults=defaults)
                roles[role_name] = role

            owner = self.ensure_member(company, roles["OWNER"], *spec["owner"], can_login=True)
            manager = self.ensure_member(company, roles["manager"], *spec["manager"], can_login=True)
            hr_member = self.ensure_member(company, roles["HR"], *spec["hr"], can_login=True)
            client = self.ensure_member(company, roles["client"], *spec["client"], can_login=True)
            employees = [self.ensure_member(company, roles["employee"], *member, can_login=True) for member in spec["employees"]]

            engineering, _ = Department.objects.get_or_create(company=company, name="Engineering", defaults={"description": "Demo product and engineering delivery team."})
            operations, _ = Department.objects.get_or_create(company=company, name="Operations", defaults={"description": "Demo operations and quality team."})
            for member, department, designation in [
                (manager, operations, "Delivery Manager"),
                (hr_member, operations, "HR Business Partner"),
                (employees[0], engineering, "Software Engineer"),
                (employees[1], operations, "Business Analyst"),
            ]:
                EmployeeProfile.objects.update_or_create(
                    company_user=member,
                    defaults={"department": department, "designation": designation, "date_joined": today - timedelta(days=240)},
                )

            for member, status in [
                (manager, "PRESENT"),
                (hr_member, "PRESENT"),
                (employees[0], "PRESENT"),
                (employees[1], "HALF_DAY"),
            ]:
                Attendance.objects.update_or_create(
                    company_user=member,
                    date=today,
                    defaults={"status": status},
                )
            Attendance.objects.update_or_create(
                company_user=employees[1],
                date=today - timedelta(days=3),
                defaults={"status": "ABSENT"},
            )
            Attendance.objects.update_or_create(
                company_user=employees[0],
                date=today - timedelta(days=6),
                defaults={"status": "HALF_DAY"},
            )
            for member, start_offset, end_offset, reason, status in [
                (employees[0], 4, 5, "Demo approved personal leave.", "APPROVED"),
                (employees[1], 9, 10, "Demo pending leave request.", "PENDING"),
                (manager, -8, -7, "Demo archived leave request.", "REJECTED"),
            ]:
                LeaveRequest.objects.update_or_create(
                    company_user=member,
                    start_date=today + timedelta(days=start_offset),
                    end_date=today + timedelta(days=end_offset),
                    defaults={"reason": reason, "status": status},
                )
            for employee, rating, feedback in [
                (employees[0], 5, "Strong delivery ownership and consistent technical execution."),
                (employees[1], 4, "Good collaboration; focus next on completing work earlier in the sprint."),
            ]:
                PerformanceReview.objects.get_or_create(
                    company_user=employee,
                    reviewer=manager,
                    rating=rating,
                    feedback=feedback,
                )

            projects = []
            for project_name, priority, start_offset, end_offset, progress, budget, actual_cost in spec["projects"]:
                project, _ = Project.objects.update_or_create(
                    company=company,
                    name=project_name,
                    defaults={
                        "description": f"Demo multi-tenant project for {company.name}.", "client": client, "manager": manager,
                        "status": "ACTIVE", "priority": priority, "start_date": today + timedelta(days=start_offset),
                        "end_date": today + timedelta(days=end_offset), "budget": budget, "actual_cost": actual_cost, "is_active": True,
                    },
                )
                projects.append(project)

            task_templates = [
                ("Confirm delivery scope", "COMPLETED", "MEDIUM", 100, -10, 1),
                ("Resolve critical integration issue", "IN_PROGRESS", "HIGH", 20, -3, 0),
                ("Prepare stakeholder review", "PENDING", "HIGH", 0, 2, 1),
                ("Complete quality assurance", "IN_PROGRESS", "MEDIUM", 55, 6, 0),
                ("Publish delivery documentation", "PENDING", "LOW", 5, 12, 1),
                ("Validate production readiness", "PENDING", "HIGH", 10, -1, 0),
            ]
            for project_index, project in enumerate(projects):
                for sequence, (task_name, status, priority, progress, due_offset, employee_index) in enumerate(task_templates, start=1):
                    task, _ = Task.objects.update_or_create(
                        company=company,
                        title=f"{project.name}: {task_name}",
                        defaults={
                            "description": f"{task_name} for the {project.name} demo project.", "project": project,
                            "assigned_to": employees[employee_index], "created_by": manager, "status": status,
                            "priority": priority, "progress": progress, "due_date": today + timedelta(days=due_offset + project_index),
                        },
                    )
                    total_tasks += 1
                    TaskActivity.objects.get_or_create(
                        task=task, event_type="demo_seeded", summary="Tenant-specific demo task created.", defaults={"actor": manager},
                    )
                    TaskComment.objects.get_or_create(
                        task=task, author=manager, body="Demo update: please keep this item current for the project review.",
                    )
                    if task.status != "COMPLETED":
                        TaskNotification.objects.get_or_create(
                            recipient=task.assigned_to, task=task, event_type="demo_assignment",
                            message=f"Demo assignment: {task.title}",
                        )
                sync_project_progress(project)

            WorkflowRule.objects.update_or_create(
                company=company,
                name="Demo: escalate overdue delivery work",
                defaults={
                    "created_by": manager, "description": "Tenant-specific automation for the multi-tenancy demonstration.",
                    "trigger": WorkflowRule.TRIGGER_TASK_OVERDUE, "condition_field": WorkflowRule.FIELD_ANY,
                    "condition_operator": WorkflowRule.OP_EQUALS, "condition_value": "",
                    "action": WorkflowRule.ACTION_NOTIFY_CREATOR,
                    "action_message": "An overdue task in your tenant requires review.", "is_enabled": True,
                },
            )

        self.stdout.write(self.style.SUCCESS(
            f"Multi-tenant demo ready: {len(created_companies)} companies and {total_tasks} tenant-scoped tasks created or refreshed."
        ))
