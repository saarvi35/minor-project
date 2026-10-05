from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from companies.models import Company, CompanyUser, Role
from tasks.models import Task

from .models import Project


class ProjectTenantAccessTests(APITestCase):
    def setUp(self):
        user_model = get_user_model()
        self.company_a = Company.objects.create(name="Alpha", email="alpha@example.test", phone="111", size="Small")
        self.company_b = Company.objects.create(name="Beta", email="beta@example.test", phone="222", size="Small")
        self.employee_role = Role.objects.create(
            company=self.company_a,
            name="Employee",
            level=50,
            can_view_assigned_tasks=True,
        )
        self.manager_role = Role.objects.create(
            company=self.company_a,
            name="Manager",
            level=70,
            can_assign_task=True,
            can_create_project=True,
            can_view_team_tasks=True,
        )
        self.other_role = Role.objects.create(company=self.company_b, name="Employee", level=50)
        self.employee_user = user_model.objects.create_user(username="employee", email="employee@alpha.test", password="test-pass")
        self.manager_user = user_model.objects.create_user(username="manager", email="manager@alpha.test", password="test-pass")
        self.other_user = user_model.objects.create_user(username="other", email="other@beta.test", password="test-pass")
        self.employee = CompanyUser.objects.create(user=self.employee_user, company=self.company_a, role=self.employee_role, email=self.employee_user.email)
        self.manager = CompanyUser.objects.create(user=self.manager_user, company=self.company_a, role=self.manager_role, email=self.manager_user.email)
        self.other_member = CompanyUser.objects.create(user=self.other_user, company=self.company_b, role=self.other_role, email=self.other_user.email)
        self.visible_project = Project.objects.create(company=self.company_a, name="Visible", start_date="2026-01-01", manager=self.manager)
        self.hidden_project = Project.objects.create(company=self.company_a, name="Hidden", start_date="2026-01-01", manager=self.manager)
        Project.objects.create(company=self.company_b, name="Other tenant", start_date="2026-01-01")
        Task.objects.create(
            title="Assigned work",
            description="Only this project should be visible",
            assigned_to=self.employee,
            created_by=self.manager,
            company=self.company_a,
            project=self.visible_project,
        )

    def test_employee_only_sees_projects_with_assigned_tasks(self):
        self.client.force_authenticate(self.employee_user)

        response = self.client.get("/api/projects/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual([row["name"] for row in response.data], ["Visible"])

    def test_project_update_rejects_a_member_from_another_tenant(self):
        self.client.force_authenticate(self.manager_user)

        response = self.client.patch(
            f"/api/projects/{self.visible_project.id}/",
            {"client": self.other_member.id},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("client", response.data)

    def test_task_creation_rejects_a_project_from_another_tenant(self):
        foreign_project = Project.objects.filter(company=self.company_b).first()
        self.client.force_authenticate(self.manager_user)

        response = self.client.post(
            "/api/tasks/",
            {
                "title": "Cross tenant attempt",
                "description": "Must not be allowed",
                "assigned_to": self.employee.id,
                "project": foreign_project.id,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("project", response.data)
