from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core import mail
from django.db import IntegrityError, transaction
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APITestCase

from projects.models import Project
from tasks.models import Task
from .models import Company, CompanyUser, Role


@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend", FRONTEND_BASE_URL="http://localhost:5173")
class InvitationAndDeletionTests(APITestCase):
    def setUp(self):
        user_model = get_user_model()
        self.company = Company.objects.create(name="Invite Co", email="invite@example.test", phone="123", size="Small")
        self.owner_role = Role.objects.create(company=self.company, name="Owner", level=100, can_manage_users=True, can_manage_roles=True)
        self.employee_role = Role.objects.create(company=self.company, name="Employee", level=40, can_view_assigned_tasks=True)
        self.owner_user = user_model.objects.create_user(username="owner", email="owner@invite.test", password="Secure-pass-123")
        self.owner = CompanyUser.objects.create(user=self.owner_user, company=self.company, role=self.owner_role, email=self.owner_user.email)
        self.client.force_authenticate(self.owner_user)

    def test_invitation_expires_and_resend_replaces_it(self):
        created = self.client.post("/api/create-user/", {"company_id": self.company.id, "first_name": "Invitee", "email": "invitee@invite.test", "role_id": self.employee_role.id}, format="json")
        self.assertEqual(created.status_code, 201)
        self.assertEqual(len(mail.outbox), 1)
        member = CompanyUser.objects.get(email="invitee@invite.test")
        old_token = member.invite_token
        member.invite_expires_at = timezone.now() - timedelta(seconds=1)
        member.save(update_fields=["invite_expires_at"])

        expired = self.client.post(f"/api/set-password/{old_token}/", {"password": "New-secure-pass-123", "confirm_password": "New-secure-pass-123"}, format="json")
        self.assertEqual(expired.status_code, 400)

        resent = self.client.post(f"/api/resend-invite/{member.id}/", {}, format="json")
        self.assertEqual(resent.status_code, 200)
        member.refresh_from_db()
        self.assertNotEqual(member.invite_token, old_token)
        self.assertEqual(len(mail.outbox), 2)

    def test_deactivation_preserves_task_history_and_assigned_role_cannot_be_deleted(self):
        employee_user = get_user_model().objects.create_user(username="employee", email="employee@invite.test", password="Secure-pass-123")
        employee = CompanyUser.objects.create(user=employee_user, company=self.company, role=self.employee_role, email=employee_user.email)
        project = Project.objects.create(company=self.company, name="History", start_date="2026-01-01")
        task = Task.objects.create(title="Preserve me", description="Work", company=self.company, project=project, assigned_to=employee, created_by=employee)

        deactivated = self.client.delete(f"/api/delete-user/{employee.id}/")
        self.assertEqual(deactivated.status_code, 200)
        employee.refresh_from_db()
        self.assertEqual(employee.status, "INACTIVE")
        self.assertTrue(Task.objects.filter(id=task.id).exists())

        role_delete = self.client.delete(f"/api/roles/{self.employee_role.id}/")
        self.assertEqual(role_delete.status_code, 400)
        self.assertTrue(Role.objects.filter(id=self.employee_role.id).exists())

    def test_database_blocks_duplicate_role_and_member_email_in_a_tenant(self):
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Role.objects.create(company=self.company, name="Owner", level=10)
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                CompanyUser.objects.create(user=self.owner_user, company=self.company, role=self.employee_role, email=self.owner_user.email)
