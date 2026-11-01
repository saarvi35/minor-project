import io

from django.test import TestCase, override_settings
from django.urls import reverse
from openpyxl import Workbook
from rest_framework.test import APIClient

from accounts.models import User
from companies.models import Company, CompanyUser, Role
from projects.models import Project
from tasks.models import Task
from .onboarding import validate_rows


@override_settings(
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    FRONTEND_BASE_URL="http://localhost:5173",
)
class OnboardingImportTests(TestCase):
    def setUp(self):
        self.company = Company.objects.create(name="Import Tenant", email="tenant@example.com", phone="9876500000", size="1-10")
        self.owner_user = User.objects.create_user(username="owner@example.com", email="owner@example.com", password="secure-pass-123")
        owner_role = Role.objects.create(name="OWNER", company=self.company, level=100, can_manage_company=True)
        CompanyUser.objects.create(user=self.owner_user, company=self.company, role=owner_role, name="Owner", email="owner@example.com", status="ACTIVE")
        self.client = APIClient()
        self.client.force_authenticate(self.owner_user)

    def workbook(self):
        workbook = Workbook()
        employees = workbook.active
        employees.title = "Employees"
        employees.append(["name", "email", "role", "department", "designation", "status"])
        employees.append(["Demo Manager", "manager@tenant.example", "MANAGER", "Delivery", "Delivery Manager", "ACTIVE"])
        employees.append(["Demo Client", "client@tenant.example", "CLIENT", "", "", "ACTIVE"])
        employees.append(["Demo Employee", "employee@tenant.example", "EMPLOYEE", "Engineering", "Engineer", "INVITED"])
        projects = workbook.create_sheet("Projects")
        projects.append(["name", "description", "manager_email", "client_email", "priority", "status", "start_date", "end_date", "budget", "actual_cost"])
        projects.append(["Imported Project", "Created from workbook", "manager@tenant.example", "client@tenant.example", "HIGH", "ACTIVE", "2026-10-01", "2026-12-10", "10000", "2500"])
        tasks = workbook.create_sheet("Tasks")
        tasks.append(["title", "description", "project_name", "assigned_to_email", "priority", "status", "progress", "due_date", "reference_link"])
        tasks.append(["Imported Task", "Created from workbook", "Imported Project", "employee@tenant.example", "HIGH", "IN_PROGRESS", "35", "2026-10-20", ""])
        buffer = io.BytesIO()
        workbook.save(buffer)
        return buffer.getvalue()

    def upload(self, confirm=False):
        from django.core.files.uploadedfile import SimpleUploadedFile
        payload = {"file": SimpleUploadedFile("onboarding.xlsx", self.workbook(), content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
        if confirm:
            payload["confirm"] = "true"
        return self.client.post("/api/onboarding/import/", payload, format="multipart")

    def test_preview_does_not_write_and_confirm_imports_only_current_tenant(self):
        preview = self.upload()
        self.assertEqual(preview.status_code, 200)
        self.assertTrue(preview.json()["valid"])
        self.assertEqual(Project.objects.filter(company=self.company).count(), 0)

        confirmed = self.upload(confirm=True)
        self.assertEqual(confirmed.status_code, 201)
        self.assertTrue(confirmed.json()["valid"])
        self.assertEqual(Project.objects.filter(company=self.company, name="Imported Project").count(), 1)
        self.assertEqual(Task.objects.filter(company=self.company, title="Imported Task").count(), 1)
        self.assertEqual(CompanyUser.objects.filter(company=self.company, email="employee@tenant.example").count(), 1)

    def test_import_rejects_missing_project_start_date_before_writing(self):
        data = {
            "Employees": [{"name": "Manager", "email": "manager@tenant.example", "role": "MANAGER"}],
            "Projects": [{"name": "Incomplete project", "manager_email": "manager@tenant.example", "start_date": "", "priority": "HIGH", "status": "ACTIVE"}],
            "Tasks": [],
        }
        errors, _warnings = validate_rows(data, self.company)
        self.assertTrue(any("start_date" in error for error in errors))
        self.assertFalse(Project.objects.filter(company=self.company, name="Incomplete project").exists())

# Create your tests here.
