from datetime import timedelta

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from companies.models import Company, CompanyUser, Role
from hr.models import Attendance, Department, EmployeeProfile, LeaveRequest, PerformanceReview
from projects.models import Project
from tasks.models import Task, TaskActivity, TaskComment, TaskNotification
from tasks.services import sync_project_progress
from workflows.models import WorkflowRule


class Command(BaseCommand):
    help = "Create or refresh a realistic, clearly labelled demo workspace."

    def add_arguments(self, parser):
        parser.add_argument(
            "--company",
            default="solutions",
            help="Company name that will receive the demo data (default: solutions).",
        )
        parser.add_argument(
            "--replace",
            action="store_true",
            help="Remove existing project, task, HR, and workflow records for the selected company before creating demo data.",
        )

    def handle(self, *args, **options):
        company_name = options["company"].strip()
        try:
            company = Company.objects.get(name__iexact=company_name)
        except Company.DoesNotExist as error:
            raise CommandError(f"Company '{company_name}' was not found.") from error

        if options["replace"]:
            Task.objects.filter(company=company).delete()
            Project.objects.filter(company=company).delete()
            Attendance.objects.filter(company_user__company=company).delete()
            LeaveRequest.objects.filter(company_user__company=company).delete()
            PerformanceReview.objects.filter(company_user__company=company).delete()
            WorkflowRule.objects.filter(company=company).delete()
            EmployeeProfile.objects.filter(company_user__company=company).delete()
            Department.objects.filter(company=company).delete()

        owner = CompanyUser.objects.filter(company=company, role__name__iexact="owner", status="ACTIVE").first()
        manager = CompanyUser.objects.filter(company=company, role__name__iexact="manager", status="ACTIVE").first()
        client = CompanyUser.objects.filter(company=company, role__name__iexact="client", status="ACTIVE").first()
        employee_role = Role.objects.filter(company=company, name__iexact="employee").first()

        if not owner or not manager or not employee_role:
            raise CommandError("The selected company needs active Owner, Manager, and Employee role records before demo data can be seeded.")

        today = timezone.localdate()
        demo_members = {}
        for name, email in [
            ("Aanya Sharma", "aanya.demo@workzen.local"),
            ("Kabir Mehta", "kabir.demo@workzen.local"),
            ("Meera Iyer", "meera.demo@workzen.local"),
        ]:
            member, _ = CompanyUser.objects.get_or_create(
                company=company,
                email=email,
                defaults={"name": name, "role": employee_role, "status": "ACTIVE"},
            )
            changed = []
            if member.name != name:
                member.name = name
                changed.append("name")
            if member.role_id != employee_role.id:
                member.role = employee_role
                changed.append("role")
            if member.status != "ACTIVE":
                member.status = "ACTIVE"
                changed.append("status")
            if changed:
                member.save(update_fields=changed)
            demo_members[name] = member

        departments = {}
        for name, description in [
            ("Engineering", "Application development, QA, and platform delivery."),
            ("Product & Design", "Product planning, user experience, and customer delivery."),
            ("Data Operations", "Analytics, reporting, and operational intelligence."),
        ]:
            department, _ = Department.objects.get_or_create(
                company=company,
                name=name,
                defaults={"description": description},
            )
            departments[name] = department

        for member, department, designation in [
            (demo_members["Aanya Sharma"], departments["Engineering"], "Software Engineer"),
            (demo_members["Kabir Mehta"], departments["Product & Design"], "Quality Analyst"),
            (demo_members["Meera Iyer"], departments["Data Operations"], "Data Analyst"),
            (manager, departments["Product & Design"], "Delivery Manager"),
        ]:
            EmployeeProfile.objects.update_or_create(
                company_user=member,
                defaults={"department": department, "designation": designation, "date_joined": today - timedelta(days=180)},
            )

        projects = {}
        project_rows = [
            ("Demo - Client Portal Launch", "A client-facing portal with authentication, billing, and launch-readiness work.", "HIGH", today - timedelta(days=40), today - timedelta(days=3), 90000, 93500),
            ("Demo - Mobile Companion App", "A companion mobile application with offline support and customer notifications.", "HIGH", today - timedelta(days=18), today + timedelta(days=16), 80000, 42000),
            ("Demo - Operations Analytics", "Internal analytics dashboards and scheduled reporting for operational teams.", "MEDIUM", today - timedelta(days=25), today + timedelta(days=28), 60000, 26000),
        ]
        for name, description, priority, start_date, end_date, budget, actual_cost in project_rows:
            project, _ = Project.objects.update_or_create(
                company=company,
                name=name,
                defaults={
                    "description": description,
                    "client": client,
                    "manager": manager,
                    "status": "ACTIVE",
                    "priority": priority,
                    "start_date": start_date,
                    "end_date": end_date,
                    "budget": budget,
                    "actual_cost": actual_cost,
                    "is_active": True,
                },
            )
            projects[name] = project

        task_rows = [
            ("Portal requirements sign-off", "Confirm the final client requirements and acceptance criteria.", "Demo - Client Portal Launch", "Kabir Mehta", "COMPLETED", "MEDIUM", 100, -12),
            ("Implement role-based access", "Complete tenant-safe role and permission rules for the portal.", "Demo - Client Portal Launch", "Aanya Sharma", "IN_PROGRESS", "HIGH", 25, -6),
            ("Resolve payment gateway failures", "Investigate checkout failures reported during staging tests.", "Demo - Client Portal Launch", "Aanya Sharma", "PENDING", "HIGH", 0, -4),
            ("Conduct client UAT", "Coordinate user acceptance testing with the client stakeholders.", "Demo - Client Portal Launch", "Kabir Mehta", "PENDING", "HIGH", 0, 1),
            ("Prepare deployment checklist", "Validate rollback, release notes, and production readiness steps.", "Demo - Client Portal Launch", "Meera Iyer", "IN_PROGRESS", "MEDIUM", 45, 3),
            ("Create launch communication pack", "Prepare launch email, quick-start guide, and support handover notes.", "Demo - Client Portal Launch", "Aanya Sharma", "PENDING", "MEDIUM", 5, 2),
            ("Create mobile design system", "Complete reusable components and accessibility states for mobile screens.", "Demo - Mobile Companion App", "Meera Iyer", "IN_PROGRESS", "MEDIUM", 60, 7),
            ("Build offline synchronisation", "Implement safe offline data storage and conflict resolution.", "Demo - Mobile Companion App", "Aanya Sharma", "IN_PROGRESS", "HIGH", 15, -3),
            ("Configure push notifications", "Set up event-driven mobile notifications for customer updates.", "Demo - Mobile Companion App", "Aanya Sharma", "PENDING", "HIGH", 0, 2),
            ("Run beta acceptance tests", "Test core journeys on Android and iOS devices before beta release.", "Demo - Mobile Companion App", "Kabir Mehta", "PENDING", "HIGH", 10, 6),
            ("Add mobile product analytics", "Track onboarding and task-completion events in the mobile application.", "Demo - Mobile Companion App", "Meera Iyer", "COMPLETED", "LOW", 100, -1),
            ("Prepare app-store assets", "Create final screenshots, descriptions, and release information.", "Demo - Mobile Companion App", "Aanya Sharma", "PENDING", "MEDIUM", 0, 9),
            ("Model operations dashboard data", "Define metrics and data transformations for operations reporting.", "Demo - Operations Analytics", "Meera Iyer", "IN_PROGRESS", "MEDIUM", 70, 5),
            ("Validate ETL quality checks", "Test data freshness, duplicate detection, and failed-job handling.", "Demo - Operations Analytics", "Aanya Sharma", "IN_PROGRESS", "HIGH", 30, -2),
            ("Build downloadable project report", "Create export-ready project status and delivery-risk report output.", "Demo - Operations Analytics", "Aanya Sharma", "PENDING", "HIGH", 10, 4),
            ("Review analytics data access", "Review access to operational metrics and sensitive reporting data.", "Demo - Operations Analytics", "Kabir Mehta", "PENDING", "MEDIUM", 20, 8),
            ("Draft team dashboard guide", "Document key analytics definitions and dashboard navigation.", "Demo - Operations Analytics", "Meera Iyer", "COMPLETED", "LOW", 100, -5),
            ("Set up weekly KPI alert", "Configure the weekly KPI review alert for delivery managers.", "Demo - Operations Analytics", "Aanya Sharma", "PENDING", "MEDIUM", 0, 11),
            ("Reconcile legacy customer data", "Resolve mismatched customer records before the next reporting cycle.", "Demo - Operations Analytics", "Aanya Sharma", "IN_PROGRESS", "HIGH", 18, -1),
            ("Review stakeholder feedback", "Capture feedback from the operations leadership review.", "Demo - Operations Analytics", "Kabir Mehta", "PENDING", "LOW", 0, 14),
        ]

        demo_tasks = []
        for title, description, project_name, assignee_name, status, priority, progress, days_until_due in task_rows:
            task, _ = Task.objects.update_or_create(
                company=company,
                title=title,
                defaults={
                    "description": description,
                    "project": projects[project_name],
                    "assigned_to": demo_members[assignee_name],
                    "created_by": owner,
                    "status": status,
                    "priority": priority,
                    "progress": progress,
                    "due_date": today + timedelta(days=days_until_due),
                },
            )
            demo_tasks.append(task)

            TaskActivity.objects.get_or_create(
                task=task,
                event_type="demo_seeded",
                summary="Demo task created for dashboard and risk-analysis testing.",
                defaults={"actor": owner},
            )
            if task.status != "COMPLETED":
                TaskComment.objects.get_or_create(
                    task=task,
                    author=owner,
                    body="Please keep this demo task updated so the dashboard reflects the latest delivery position.",
                )

        for project in projects.values():
            sync_project_progress(project)

        aanya = demo_members["Aanya Sharma"]
        for days_ago, status in [(1, "ABSENT"), (4, "HALF_DAY"), (8, "ABSENT")]:
            Attendance.objects.update_or_create(
                company_user=aanya,
                date=today - timedelta(days=days_ago),
                defaults={"status": status},
            )
        for member, status in [
            (aanya, "PRESENT"),
            (demo_members["Kabir Mehta"], "HALF_DAY"),
            (demo_members["Meera Iyer"], "PRESENT"),
            (manager, "PRESENT"),
        ]:
            Attendance.objects.update_or_create(
                company_user=member,
                date=today,
                defaults={"status": status},
            )
        LeaveRequest.objects.update_or_create(
            company_user=aanya,
            start_date=today + timedelta(days=2),
            end_date=today + timedelta(days=4),
            defaults={"reason": "Demo planned leave to test workload risk signals.", "status": "APPROVED"},
        )
        LeaveRequest.objects.update_or_create(
            company_user=demo_members["Kabir Mehta"],
            start_date=today + timedelta(days=10),
            end_date=today + timedelta(days=11),
            defaults={"reason": "Demo personal leave request for workflow testing.", "status": "PENDING"},
        )
        LeaveRequest.objects.update_or_create(
            company_user=demo_members["Meera Iyer"],
            start_date=today - timedelta(days=7),
            end_date=today - timedelta(days=6),
            defaults={"reason": "Demo archived leave request.", "status": "REJECTED"},
        )

        rules = [
            ("Demo: notify on low progress", WorkflowRule.TRIGGER_TASK_UPDATED, WorkflowRule.FIELD_PROGRESS, WorkflowRule.OP_LTE, "25", WorkflowRule.ACTION_NOTIFY_ASSIGNEE, "Progress is low. Please post an update and review the delivery plan."),
            ("Demo: escalate overdue tasks", WorkflowRule.TRIGGER_TASK_OVERDUE, WorkflowRule.FIELD_ANY, WorkflowRule.OP_EQUALS, "", WorkflowRule.ACTION_NOTIFY_CREATOR, "An overdue demo task needs a delivery review."),
        ]
        for name, trigger, field, operator, value, action, message in rules:
            WorkflowRule.objects.update_or_create(
                company=company,
                name=name,
                defaults={
                    "created_by": owner,
                    "description": "Demo automation rule for the WorkZen presentation.",
                    "trigger": trigger,
                    "condition_field": field,
                    "condition_operator": operator,
                    "condition_value": value,
                    "action": action,
                    "action_message": message,
                    "is_enabled": True,
                },
            )

        for task in demo_tasks:
            if task.status in ["PENDING", "IN_PROGRESS"] and task.due_date < today:
                TaskNotification.objects.get_or_create(
                    recipient=owner,
                    task=task,
                    event_type="demo_risk",
                    message=f"Demo alert: {task.title} is overdue and requires review.",
                )

        self.stdout.write(self.style.SUCCESS(
            f"Demo workspace ready for '{company.name}': {len(projects)} demo projects and {len(demo_tasks)} demo tasks."
        ))
