from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from companies.models import Company, CompanyUser, Role
from .models import Department, EmployeeProfile, LeaveRequest


class HRSecurityTests(APITestCase):
    def setUp(self):
        user_model = get_user_model()
        self.company_a = Company.objects.create(name="Alpha", email="hr-alpha@example.test", phone="111", size="Small")
        self.company_b = Company.objects.create(name="Beta", email="hr-beta@example.test", phone="222", size="Small")
        self.employee_role = Role.objects.create(company=self.company_a, name="Employee", level=40)
        self.hr_role = Role.objects.create(company=self.company_a, name="HR", level=80, can_manage_hr=True)
        self.other_role = Role.objects.create(company=self.company_b, name="Employee", level=40)
        self.employee_user = user_model.objects.create_user(username="employee", email="employee@alpha.test", password="Secure-pass-123")
        self.hr_user = user_model.objects.create_user(username="hr", email="hr@alpha.test", password="Secure-pass-123")
        self.other_user = user_model.objects.create_user(username="other", email="other@beta.test", password="Secure-pass-123")
        self.employee = CompanyUser.objects.create(user=self.employee_user, company=self.company_a, role=self.employee_role, email=self.employee_user.email)
        self.hr_member = CompanyUser.objects.create(user=self.hr_user, company=self.company_a, role=self.hr_role, email=self.hr_user.email)
        self.other_member = CompanyUser.objects.create(user=self.other_user, company=self.company_b, role=self.other_role, email=self.other_user.email)
        self.local_department = Department.objects.create(company=self.company_a, name="Engineering")
        self.foreign_department = Department.objects.create(company=self.company_b, name="Private")
        self.profile = EmployeeProfile.objects.create(company_user=self.employee, department=self.local_department, salary="100000.00", designation="Engineer")
        self.leave = LeaveRequest.objects.create(company_user=self.employee, start_date="2026-11-01", end_date="2026-11-02", reason="Personal")

    def test_employee_cannot_change_salary_or_department(self):
        self.client.force_authenticate(self.employee_user)
        response = self.client.put(
            "/api/profile/",
            {"salary": "999999.00", "department_id": self.foreign_department.id, "phone": "9999999999"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.profile.refresh_from_db()
        self.assertEqual(str(self.profile.salary), "100000.00")
        self.assertEqual(self.profile.department_id, self.local_department.id)
        self.assertEqual(self.profile.phone, "9999999999")

    def test_hr_cannot_review_another_tenant_or_set_invalid_leave_status(self):
        self.client.force_authenticate(self.hr_user)
        review = self.client.post(
            f"/api/review/{self.other_member.id}/",
            {"rating": 5, "feedback": "Attempted cross-tenant review"},
            format="json",
        )
        self.assertEqual(review.status_code, 404)

        invalid_status = self.client.patch(
            f"/api/leave/{self.leave.id}/status/",
            {"status": "APPROVED_BY_ACCIDENT"},
            format="json",
        )
        self.assertEqual(invalid_status.status_code, 400)
        self.leave.refresh_from_db()
        self.assertEqual(self.leave.status, "PENDING")
