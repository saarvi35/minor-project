from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from companies.models import Company, CompanyUser, Role
from projects.models import Project
from tasks.models import Task


class DashboardTaskScopeTests(APITestCase):
    def setUp(self):
        user_model = get_user_model()
        self.company = Company.objects.create(name="Dashboard Co", email="dashboard@example.test", phone="123", size="Small")
        role = Role.objects.create(company=self.company, name="Employee", level=40, can_view_assigned_tasks=True)
        user = user_model.objects.create_user(username="employee", email="employee@dashboard.test", password="Secure-pass-123")
        self.member = CompanyUser.objects.create(user=user, company=self.company, role=role, email=user.email)
        project = Project.objects.create(company=self.company, name="Visible", start_date="2026-01-01")
        self.task = Task.objects.create(title="Visible task", description="Work", company=self.company, project=project, assigned_to=self.member, created_by=self.member)
        self.client.force_authenticate(user)

    def test_employee_task_list_and_analytics_do_not_error(self):
        tasks = self.client.get("/api/all-tasks/")
        self.assertEqual(tasks.status_code, 200)
        self.assertEqual([task["id"] for task in tasks.data], [self.task.id])
        analytics = self.client.get("/api/task-analytics/")
        self.assertEqual(analytics.status_code, 200)
        self.assertEqual(analytics.data["total_tasks"], 1)
