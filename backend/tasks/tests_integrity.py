from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from companies.models import Company, CompanyUser, Role
from projects.models import Project
from .models import Task


class TaskEditIntegrityTests(APITestCase):
    def setUp(self):
        user_model = get_user_model()
        self.company = Company.objects.create(name="Task Co", email="tasks@example.test", phone="123", size="Small")
        self.manager_role = Role.objects.create(company=self.company, name="Manager", level=80, can_assign_task=True, can_view_team_tasks=True)
        self.employee_role = Role.objects.create(company=self.company, name="Employee", level=40, can_view_assigned_tasks=True, can_update_task_status=True)
        self.manager_user = user_model.objects.create_user(username="manager", email="manager@tasks.test", password="Secure-pass-123")
        self.employee_user = user_model.objects.create_user(username="employee", email="employee@tasks.test", password="Secure-pass-123")
        self.manager = CompanyUser.objects.create(user=self.manager_user, company=self.company, role=self.manager_role, email=self.manager_user.email)
        self.employee = CompanyUser.objects.create(user=self.employee_user, company=self.company, role=self.employee_role, email=self.employee_user.email)
        self.project = Project.objects.create(company=self.company, name="Project", start_date="2026-01-01", manager=self.manager)
        self.task = Task.objects.create(title="Original", description="Work", company=self.company, project=self.project, assigned_to=self.employee, created_by=self.manager, due_date="2026-12-01")

    def test_assignee_can_update_only_status_and_progress(self):
        self.client.force_authenticate(self.employee_user)
        accepted = self.client.patch(f"/api/tasks/{self.task.id}/", {"status": "IN_PROGRESS", "progress": 40}, format="json")
        self.assertEqual(accepted.status_code, 200)

        rejected = self.client.patch(f"/api/tasks/{self.task.id}/", {"title": "Rewritten", "assigned_to": self.manager.id}, format="json")
        self.assertEqual(rejected.status_code, 403)
        self.task.refresh_from_db()
        self.assertEqual(self.task.title, "Original")
        self.assertEqual(self.task.assigned_to_id, self.employee.id)

    def test_manager_can_manage_tasks_in_their_project(self):
        self.client.force_authenticate(self.manager_user)
        response = self.client.patch(f"/api/tasks/{self.task.id}/", {"title": "Manager update"}, format="json")
        self.assertEqual(response.status_code, 200)

    def test_delete_archives_task_without_removing_history(self):
        self.client.force_authenticate(self.manager_user)
        response = self.client.delete(f"/api/tasks/{self.task.id}/")
        self.assertEqual(response.status_code, 204)
        self.task.refresh_from_db()
        self.assertTrue(self.task.is_archived)
        self.assertIsNotNone(self.task.archived_at)
        self.assertEqual(self.client.get("/api/tasks/").data, [])
