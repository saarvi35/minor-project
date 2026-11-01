from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from .models import Company, CompanyUser, Role


class CompanySecurityTests(APITestCase):
    def setUp(self):
        user_model = get_user_model()
        self.company_a = Company.objects.create(name="Alpha", email="alpha@example.test", phone="111", size="Small")
        self.company_b = Company.objects.create(name="Beta", email="beta@example.test", phone="222", size="Small")
        self.owner_role_a = Role.objects.create(
            company=self.company_a, name="Owner", level=100,
            can_manage_company=True, can_manage_roles=True, can_manage_users=True,
            can_manage_hr=True, can_create_project=True, can_assign_task=True,
        )
        self.manager_role_a = Role.objects.create(
            company=self.company_a, name="Manager", level=80,
            can_manage_users=True, can_manage_roles=True,
        )
        self.employee_role_a = Role.objects.create(company=self.company_a, name="Employee", level=40)
        self.owner_role_b = Role.objects.create(company=self.company_b, name="Owner", level=100, can_manage_company=True)

        self.owner_user_a = user_model.objects.create_user(username="owner-a", email="owner-a@alpha.test", password="Secure-pass-123")
        self.manager_user_a = user_model.objects.create_user(username="manager-a", email="manager-a@alpha.test", password="Secure-pass-123")
        self.employee_user_a = user_model.objects.create_user(username="employee-a", email="employee-a@alpha.test", password="Secure-pass-123")
        self.owner_user_b = user_model.objects.create_user(username="owner-b", email="owner-b@beta.test", password="Secure-pass-123")
        self.owner_a = CompanyUser.objects.create(user=self.owner_user_a, company=self.company_a, role=self.owner_role_a, email=self.owner_user_a.email)
        self.manager_a = CompanyUser.objects.create(user=self.manager_user_a, company=self.company_a, role=self.manager_role_a, email=self.manager_user_a.email)
        self.employee_a = CompanyUser.objects.create(user=self.employee_user_a, company=self.company_a, role=self.employee_role_a, email=self.employee_user_a.email)
        self.owner_b = CompanyUser.objects.create(user=self.owner_user_b, company=self.company_b, role=self.owner_role_b, email=self.owner_user_b.email)

    def test_company_api_is_private_and_tenant_scoped(self):
        anonymous = self.client.get("/api/companies/")
        self.assertEqual(anonymous.status_code, 401)

        self.client.force_authenticate(self.owner_user_a)
        response = self.client.get("/api/companies/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual([company["id"] for company in response.data], [self.company_a.id])
        self.assertEqual(self.client.patch(f"/api/companies/{self.company_b.id}/", {"name": "Compromised"}, format="json").status_code, 404)

    def test_manager_cannot_invite_into_another_tenant_or_assign_owner_role(self):
        self.client.force_authenticate(self.manager_user_a)
        cross_tenant = self.client.post(
            "/api/create-user/",
            {"company_id": self.company_b.id, "first_name": "Intruder", "email": "intruder@beta.test", "role_id": self.owner_role_b.id},
            format="json",
        )
        self.assertEqual(cross_tenant.status_code, 400)
        self.assertFalse(CompanyUser.objects.filter(email="intruder@beta.test").exists())

        escalation = self.client.patch(
            f"/api/update-user/{self.employee_a.id}/",
            {"role": self.owner_role_a.id},
            format="json",
        )
        self.assertEqual(escalation.status_code, 403)
        self.employee_a.refresh_from_db()
        self.assertEqual(self.employee_a.role_id, self.employee_role_a.id)

    def test_manager_cannot_create_an_equal_or_higher_role(self):
        self.client.force_authenticate(self.manager_user_a)
        response = self.client.post(
            "/api/roles/",
            {"name": "Shadow Owner", "level": 100, "can_manage_company": True},
            format="json",
        )
        self.assertEqual(response.status_code, 403)
        self.assertFalse(Role.objects.filter(company=self.company_a, name="Shadow Owner").exists())
