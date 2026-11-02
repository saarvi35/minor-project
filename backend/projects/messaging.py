"""Project message thread shared by a project's team and its client."""

from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from companies.utils import get_company_user, get_permission_dict
from tasks.models import Task

from .models import Project, ProjectMessage

PAGE_SIZE = 200


def can_use_project_thread(company_user, project):
    """Owner, the project manager, employees with work on the project, and its client."""
    if project.company_id != company_user.company_id or not project.is_active:
        return False
    permissions = get_permission_dict(company_user.role)
    if permissions.get("can_manage_company"):
        return True
    if project.manager_id == company_user.id:
        return True
    if project.client_id == company_user.id:
        return bool(permissions.get("can_view_project_progress"))
    if permissions.get("can_view_assigned_tasks"):
        return Task.objects.filter(
            company=company_user.company, project=project, assigned_to=company_user, is_archived=False
        ).exists()
    return False


class ProjectMessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.SerializerMethodField()
    sender_role = serializers.SerializerMethodField()
    is_mine = serializers.SerializerMethodField()

    class Meta:
        model = ProjectMessage
        fields = ["id", "sender_id", "sender_name", "sender_role", "body", "created_at", "is_mine"]

    def get_sender_name(self, obj):
        return obj.sender.name or "Team member"

    def get_sender_role(self, obj):
        return obj.sender.role.name

    def get_is_mine(self, obj):
        return obj.sender_id == self.context["company_user"].id


class ProjectMessageCreateSerializer(serializers.Serializer):
    body = serializers.CharField(max_length=2000)

    def validate_body(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Message cannot be empty.")
        return value


class ProjectMessagesAPI(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "project_messages"

    def _context(self, request, project_id):
        company_user = get_company_user(request.user)
        if not company_user:
            raise PermissionDenied("Your account is not linked to a company.")
        project = Project.objects.filter(id=project_id, company=company_user.company, is_active=True).first()
        if not project:
            return company_user, None
        if not can_use_project_thread(company_user, project):
            raise PermissionDenied("You are not a participant of this project.")
        return company_user, project

    def get(self, request, project_id):
        company_user, project = self._context(request, project_id)
        if not project:
            return Response({"error": "Project not found."}, status=404)
        queryset = ProjectMessage.objects.filter(project=project).select_related("sender__role")
        try:
            after = int(request.query_params.get("after", 0))
        except ValueError:
            after = 0
        if after > 0:
            rows = list(queryset.filter(id__gt=after)[:PAGE_SIZE])
        else:
            rows = list(queryset.order_by("-id")[:PAGE_SIZE])[::-1]
        data = ProjectMessageSerializer(rows, many=True, context={"company_user": company_user}).data
        return Response(data)

    def post(self, request, project_id):
        company_user, project = self._context(request, project_id)
        if not project:
            return Response({"error": "Project not found."}, status=404)
        serializer = ProjectMessageCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        message = ProjectMessage.objects.create(project=project, sender=company_user, body=serializer.validated_data["body"])
        return Response(ProjectMessageSerializer(message, context={"company_user": company_user}).data, status=201)
