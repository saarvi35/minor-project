import tempfile

from django.contrib.auth import get_user_model
from django.core.files.storage import FileSystemStorage
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APITestCase

from companies.models import Company, CompanyUser, Role
from tasks.models import Task

from .models import Project, ProjectMessage


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

    def test_project_delete_deactivates_without_removing_tasks(self):
        self.client.force_authenticate(self.manager_user)
        response = self.client.delete(f"/api/projects/{self.visible_project.id}/")
        self.assertEqual(response.status_code, 204)
        self.visible_project.refresh_from_db()
        self.assertFalse(self.visible_project.is_active)
        self.assertTrue(Task.objects.filter(project=self.visible_project).exists())


class ProjectMessageTests(APITestCase):
    def setUp(self):
        user_model = get_user_model()
        self.company = Company.objects.create(name="Alpha", email="msg-alpha@example.test", phone="111", size="Small")
        other_company = Company.objects.create(name="Beta", email="msg-beta@example.test", phone="222", size="Small")
        owner_role = Role.objects.create(company=self.company, name="Owner", level=100, can_manage_company=True)
        manager_role = Role.objects.create(company=self.company, name="Manager", level=70, can_create_project=True, can_assign_task=True, can_view_team_tasks=True)
        employee_role = Role.objects.create(company=self.company, name="Employee", level=50, can_view_assigned_tasks=True)
        client_role = Role.objects.create(company=self.company, name="Client", level=10, can_view_project_progress=True)
        hr_role = Role.objects.create(company=self.company, name="HR", level=60, can_manage_hr=True)
        foreign_role = Role.objects.create(company=other_company, name="Client", level=10, can_view_project_progress=True)

        def member(name, role, company=None):
            user = user_model.objects.create_user(username=name, email=f"{name}@msg.test", password="test-pass")
            return user, CompanyUser.objects.create(user=user, company=company or self.company, role=role, name=name.title(), email=user.email, status="ACTIVE")

        self.owner_user, self.owner = member("owner", owner_role)
        self.manager_user, self.manager = member("manager", manager_role)
        self.employee_user, self.employee = member("employee", employee_role)
        self.other_employee_user, self.other_employee = member("bystander", employee_role)
        self.client_user, self.client_member = member("client", client_role)
        self.other_client_user, self.other_client = member("otherclient", client_role)
        self.hr_user, self.hr = member("hr", hr_role)
        self.foreign_user, self.foreign = member("foreign", foreign_role, other_company)
        self.project = Project.objects.create(company=self.company, name="Portal", start_date="2026-01-01", manager=self.manager, client=self.client_member)
        Task.objects.create(title="Build", description="x", assigned_to=self.employee, created_by=self.manager, company=self.company, project=self.project)
        self.url = f"/api/projects/{self.project.id}/messages/"

    def test_team_and_client_can_exchange_messages(self):
        self.client.force_authenticate(self.client_user)
        self.assertEqual(self.client.post(self.url, {"body": "When is the demo?"}, format="json").status_code, 201)
        self.client.force_authenticate(self.employee_user)
        reply = self.client.post(self.url, {"body": "Friday."}, format="json")
        self.assertEqual(reply.status_code, 201)
        self.assertTrue(reply.json()["is_mine"])
        rows = self.client.get(self.url).json()
        self.assertEqual([row["body"] for row in rows], ["When is the demo?", "Friday."])
        self.assertNotIn("email", rows[0])
        self.client.force_authenticate(self.client_user)
        after = self.client.get(self.url, {"after": rows[0]["id"]}).json()
        self.assertEqual([row["body"] for row in after], ["Friday."])

    def test_owner_and_project_manager_can_participate(self):
        for user in (self.owner_user, self.manager_user):
            self.client.force_authenticate(user)
            self.assertEqual(self.client.post(self.url, {"body": "Update"}, format="json").status_code, 201)

    def test_non_participants_are_rejected(self):
        self.assertIn(self.client.get(self.url).status_code, (401, 403))
        for user in (self.other_employee_user, self.other_client_user, self.hr_user):
            self.client.force_authenticate(user)
            self.assertEqual(self.client.get(self.url).status_code, 403)
            self.assertEqual(self.client.post(self.url, {"body": "Hi"}, format="json").status_code, 403)

    def test_other_company_cannot_read_or_write(self):
        self.client.force_authenticate(self.foreign_user)
        self.assertEqual(self.client.get(self.url).status_code, 404)
        self.assertEqual(self.client.post(self.url, {"body": "Hi"}, format="json").status_code, 404)

    def test_empty_and_oversized_messages_are_rejected(self):
        self.client.force_authenticate(self.client_user)
        self.assertEqual(self.client.post(self.url, {"body": "   "}, format="json").status_code, 400)
        self.assertEqual(self.client.post(self.url, {"body": "x" * 2001}, format="json").status_code, 400)

    def test_employee_loses_access_when_no_active_task_remains(self):
        Task.objects.filter(assigned_to=self.employee).update(is_archived=True)
        self.client.force_authenticate(self.employee_user)
        self.assertEqual(self.client.get(self.url).status_code, 403)


class ProjectMessageAttachmentTests(APITestCase):
    PDF = b"%PDF-1.4\n1 0 obj<<>>endobj\n%%EOF"

    def setUp(self):
        ProjectMessageTests.setUp(self)
        field = ProjectMessage._meta.get_field("attachment")
        self._original_storage = field.storage
        self._tmp = tempfile.TemporaryDirectory()
        field.storage = FileSystemStorage(location=self._tmp.name)
        self.addCleanup(self._restore_storage, field)

    def _restore_storage(self, field):
        field.storage = self._original_storage
        self._tmp.cleanup()

    def upload(self, user, name="plan.pdf", content=None, body="", content_type="application/pdf"):
        self.client.force_authenticate(user)
        file = SimpleUploadedFile(name, content if content is not None else self.PDF, content_type=content_type)
        return self.client.post(self.url, {"body": body, "attachment": file}, format="multipart")

    def test_participants_can_attach_and_download_files(self):
        created = self.upload(self.client_user, body="Signed contract")
        self.assertEqual(created.status_code, 201)
        attachment = created.json()["attachment"]
        self.assertEqual((attachment["name"], attachment["type"], attachment["is_image"]), ("plan.pdf", "application/pdf", False))
        self.client.force_authenticate(self.employee_user)
        listed = self.client.get(self.url).json()
        self.assertEqual(listed[0]["attachment"]["name"], "plan.pdf")
        download = self.client.get(f"/api{attachment['url']}")
        self.assertEqual(download.status_code, 200)
        self.assertEqual(b"".join(download.streaming_content), self.PDF)
        self.assertEqual(download["X-Content-Type-Options"], "nosniff")

    def test_attachment_only_message_is_allowed_but_empty_message_is_not(self):
        self.assertEqual(self.upload(self.employee_user).status_code, 201)
        self.assertEqual(self.client.post(self.url, {"body": ""}, format="json").status_code, 400)

    def test_dangerous_or_mismatched_files_are_rejected(self):
        for name, content in (("run.exe", b"MZ\x90"), ("page.html", b"<script>1</script>"), ("pic.svg", b"<svg onload=1>"), ("fake.pdf", b"<html>"), ("fake.png", b"%PDF-1.4")):
            self.assertEqual(self.upload(self.client_user, name=name, content=content).status_code, 400, name)

    def test_oversized_files_are_rejected(self):
        self.assertEqual(self.upload(self.client_user, content=b"%PDF" + b"0" * (10 * 1024 * 1024)).status_code, 400)

    def test_attachment_access_is_limited_to_participants_and_tenant(self):
        created = self.upload(self.client_user).json()
        path = f"/api{created['attachment']['url']}"
        self.client.force_authenticate(None)
        self.assertIn(self.client.get(path).status_code, (401, 403))
        for user in (self.other_employee_user, self.other_client_user, self.hr_user):
            self.client.force_authenticate(user)
            self.assertEqual(self.client.get(path).status_code, 403)
        self.client.force_authenticate(self.foreign_user)
        self.assertEqual(self.client.get(path).status_code, 404)
