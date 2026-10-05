from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from companies.models import Company, CompanyUser, Role

from .models import Task
from .models import TaskNotification
from .services import sync_project_progress


class TaskCollaborationAPITests(APITestCase):
    def setUp(self):
        self.company = Company.objects.create(
            name="Acme",
            email="hello@acme.test",
            phone="1234567890",
            size="Small",
        )
        self.role = Role.objects.create(
            company=self.company,
            name="Employee",
            can_view_assigned_tasks=True,
        )
        user_model = get_user_model()
        self.user = user_model.objects.create_user(username="member", email="member@acme.test", password="test-pass")
        self.company_user = CompanyUser.objects.create(
            user=self.user,
            company=self.company,
            role=self.role,
            email=self.user.email,
        )
        self.task = Task.objects.create(
            title="Prepare release",
            description="Prepare the release notes",
            assigned_to=self.company_user,
            created_by=self.company_user,
            company=self.company,
        )
        self.client.force_authenticate(self.user)

    def test_assignee_can_comment_and_read_activity(self):
        response = self.client.post(f"/api/tasks/{self.task.id}/comments/", {"body": "Release notes are ready."}, format="json")

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["author_name"], "member@acme.test")

        activity = self.client.get(f"/api/tasks/{self.task.id}/activity/")

        self.assertEqual(activity.status_code, 200)
        self.assertEqual(activity.data[0]["event_type"], "commented")

    def test_project_progress_is_derived_from_task_progress(self):
        from projects.models import Project

        project = Project.objects.create(
            company=self.company,
            name="Launch",
            start_date="2026-01-01",
        )
        self.task.project = project
        self.task.progress = 20
        self.task.save()
        second_task = Task.objects.create(
            title="Ship release",
            description="Ship it",
            assigned_to=self.company_user,
            created_by=self.company_user,
            company=self.company,
            project=project,
            progress=80,
        )

        sync_project_progress(project)
        project.refresh_from_db()

        self.assertEqual(project.progress, 50)
        second_task.delete()

    def test_member_can_read_and_clear_own_notifications(self):
        TaskNotification.objects.create(
            recipient=self.company_user,
            task=self.task,
            event_type="assigned",
            message="You were assigned to Prepare release",
        )

        response = self.client.get("/api/tasks/notifications/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["unread_count"], 1)
        notification_id = response.data["results"][0]["id"]

        mark_read = self.client.post("/api/tasks/notifications/read/", {"ids": [notification_id]}, format="json")

        self.assertEqual(mark_read.status_code, 200)
        self.assertEqual(mark_read.data["updated_count"], 1)
