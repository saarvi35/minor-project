import json
import os
from unittest.mock import patch

from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import User
from companies.models import Company, CompanyUser, Role
from projects.models import Project
from tasks.models import Task


class MockGeminiResponse:
    def __init__(self, payload):
        self.payload = payload

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def read(self):
        return json.dumps(self.payload).encode("utf-8")


class AIProjectArchitectTests(TestCase):
    def setUp(self):
        self.company = Company.objects.create(name="Private Tenant Name", email="private@example.com", phone="9876500000", size="1-10")
        self.owner_user = User.objects.create_user(username="owner@private.example", email="owner@private.example", password="secure-pass-123")
        self.member_user = User.objects.create_user(username="member@private.example", email="member@private.example", password="secure-pass-123")
        owner_role = Role.objects.create(name="OWNER", company=self.company, level=100, can_manage_company=True, can_create_project=True, can_assign_task=True)
        employee_role = Role.objects.create(name="EMPLOYEE", company=self.company, level=40, can_view_assigned_tasks=True, can_update_task_status=True)
        self.owner = CompanyUser.objects.create(user=self.owner_user, company=self.company, role=owner_role, name="Private Owner", email="owner@private.example", status="ACTIVE")
        self.member = CompanyUser.objects.create(user=self.member_user, company=self.company, role=employee_role, name="Private Member", email="member@private.example", status="ACTIVE")
        self.client = APIClient()
        self.client.force_authenticate(self.owner_user)
        self.captured_prompt = ""
        self.captured_key_header = ""
        self.captured_url = ""

    def fake_urlopen(self, request, timeout):
        self.captured_prompt = json.loads(request.data.decode("utf-8"))["contents"][0]["parts"][0]["text"]
        self.captured_key_header = request.get_header("X-goog-api-key")
        self.captured_url = request.full_url
        return MockGeminiResponse({
            "candidates": [{"content": {"parts": [{"text": json.dumps({
                "project": {"name": "AI Generated Portal", "description": "Portal implementation", "priority": "HIGH", "estimated_duration_days": 30},
                "executive_summary": "Deliver a secure portal in planned phases.",
                "assumptions": ["Stakeholders provide requirements within one week."],
                "milestones": [{"title": "Design approved", "due_offset_days": 7, "outcome": "Ready for build"}],
                "risks": [{"risk": "Late requirements", "mitigation": "Hold weekly scope reviews", "severity": "HIGH"}],
                "tasks": [{"title": "Design portal flow", "description": "Create and validate the user flow.", "priority": "HIGH", "due_offset_days": 7, "suggested_candidate_id": "member_1", "acceptance_criteria": "Stakeholder approval recorded."}],
            })}]}}]
        })

    @patch.dict(os.environ, {"GEMINI_API_KEY": "test-key"})
    @patch("ai_insights.copilot.urlopen")
    def test_generated_plan_is_private_draft_then_creates_current_tenant_work(self, mock_urlopen):
        mock_urlopen.side_effect = self.fake_urlopen
        response = self.client.post("/api/ai/copilot/plans/", {"title": "Customer Portal", "brief": "Build a customer portal with secure login, profile updates, and a clear delivery plan for the next quarter."}, format="json")
        self.assertEqual(response.status_code, 201)
        plan = response.json()
        self.assertEqual(plan["status"], "DRAFT")
        self.assertEqual(Project.objects.filter(company=self.company).count(), 0)
        self.assertNotIn("owner@private.example", self.captured_prompt)
        self.assertNotIn("member@private.example", self.captured_prompt)
        self.assertNotIn("Private Tenant Name", self.captured_prompt)
        self.assertIn("member_1", self.captured_prompt)
        self.assertEqual(self.captured_key_header, "test-key")
        self.assertNotIn("test-key", self.captured_url)

        applied = self.client.post(f"/api/ai/copilot/plans/{plan['id']}/apply/", {}, format="json")
        self.assertEqual(applied.status_code, 201)
        self.assertEqual(Project.objects.filter(company=self.company, name="AI Generated Portal").count(), 1)
        self.assertEqual(Task.objects.filter(company=self.company, title="Design portal flow").count(), 1)
        self.assertEqual(Task.objects.get(company=self.company, title="Design portal flow").assigned_to_id, self.member.id)
