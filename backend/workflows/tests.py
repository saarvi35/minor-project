from django.contrib.auth import get_user_model
from datetime import timedelta
from django.utils import timezone
from rest_framework.test import APITestCase

from companies.models import Company, CompanyUser, Role
from tasks.models import Task
from .models import WorkflowRule, WorkflowRun
from .tasks import run_sla_watchdog


class WorkflowRuleAPITests(APITestCase):
    def setUp(self):
        self.company = Company.objects.create(
            name="Acme",
            email="workflows@acme.test",
            phone="1234567890",
            size="Small",
        )
        self.role = Role.objects.create(
            company=self.company,
            name="Manager",
            can_assign_task=True,
            can_view_assigned_tasks=True,
        )
        user_model = get_user_model()
        self.user = user_model.objects.create_user(username="manager", email="manager@acme.test", password="test-pass")
        self.company_user = CompanyUser.objects.create(
            user=self.user,
            company=self.company,
            role=self.role,
            email=self.user.email,
        )
        self.task = Task.objects.create(
            title="Release work",
            description="Prepare release",
            assigned_to=self.company_user,
            created_by=self.company_user,
            company=self.company,
            progress=30,
        )
        self.client.force_authenticate(self.user)

    def test_rule_runs_when_its_condition_matches_a_task_update(self):
        create_rule = self.client.post(
            "/api/workflows/",
            {
                "name": "Flag major progress",
                "trigger": "TASK_UPDATED",
                "condition_field": "progress",
                "condition_operator": "GREATER_THAN_OR_EQUAL",
                "condition_value": "80",
                "action": "CREATE_ACTIVITY",
                "action_message": "Workflow: task is ready for review",
            },
            format="json",
        )
        self.assertEqual(create_rule.status_code, 201)

        update_task = self.client.patch(f"/api/tasks/{self.task.id}/", {"progress": 80}, format="json")
        self.assertEqual(update_task.status_code, 200)

        runs = self.client.get("/api/workflows/runs/")
        self.assertEqual(runs.status_code, 200)
        self.assertEqual(runs.data[0]["status"], "EXECUTED")
        self.assertEqual(runs.data[0]["detail"], "Workflow: task is ready for review")

    def test_sla_watchdog_runs_an_overdue_rule_only_once_per_day(self):
        self.task.due_date = timezone.localdate() - timedelta(days=1)
        self.task.save(update_fields=["due_date"])
        WorkflowRule.objects.create(
            company=self.company,
            created_by=self.company_user,
            name="Escalate overdue work",
            trigger="TASK_OVERDUE",
            condition_field="ANY",
            action="CREATE_ACTIVITY",
            action_message="Workflow: task needs escalation",
        )

        first_run = run_sla_watchdog.run()
        second_run = run_sla_watchdog.run()

        self.assertEqual(first_run, 1)
        self.assertEqual(second_run, 0)
        self.assertEqual(WorkflowRun.objects.filter(task=self.task, status="EXECUTED").count(), 1)
