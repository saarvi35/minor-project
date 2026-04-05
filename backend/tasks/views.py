from django.db.models import Q
from rest_framework import viewsets
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated

from companies.utils import get_company_user, get_permission_dict

from .models import Task
from .serializers import TaskSerializer


class TaskViewSet(viewsets.ModelViewSet):
    serializer_class = TaskSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context.update({"request": self.request})
        return context

    def get_queryset(self):
        company_user = get_company_user(self.request.user)
        if not company_user:
            return Task.objects.none()

        permissions = get_permission_dict(company_user.role)

        if permissions.get("can_view_all_tasks"):
            return Task.objects.filter(company=company_user.company)

        if permissions.get("can_view_team_tasks"):
            return Task.objects.filter(company=company_user.company).filter(
                Q(project__manager=company_user)
                | Q(project__isnull=True, created_by=company_user)
            )

        if permissions.get("can_view_assigned_tasks"):
            return Task.objects.filter(assigned_to=company_user)

        return Task.objects.none()

    def perform_create(self, serializer):
        company_user = get_company_user(self.request.user)
        if not company_user:
            raise PermissionDenied("Company not found")

        permissions = get_permission_dict(company_user.role)
        if not permissions.get("can_assign_task"):
            raise PermissionDenied("You don't have permission to create tasks")

        serializer.save(created_by=company_user, company=company_user.company)

    def _ensure_task_update_permission(self, task, company_user):
        permissions = get_permission_dict(company_user.role)

        if permissions.get("can_view_all_tasks"):
            return

        if permissions.get("can_view_team_tasks"):
            if task.created_by != company_user:
                raise PermissionDenied("You can only update tasks created by you")
            return

        if permissions.get("can_view_assigned_tasks"):
            if task.assigned_to != company_user:
                raise PermissionDenied("You can only update your assigned task")
            return

        raise PermissionDenied("You don't have permission to update task")

    def update(self, request, *args, **kwargs):
        company_user = get_company_user(request.user)
        if not company_user:
            raise PermissionDenied("Company not found")

        task = self.get_object()
        self._ensure_task_update_permission(task, company_user)

        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        company_user = get_company_user(request.user)
        if not company_user:
            raise PermissionDenied("Company not found")

        task = self.get_object()
        self._ensure_task_update_permission(task, company_user)

        return super().partial_update(request, *args, **kwargs)

    def perform_destroy(self, instance):
        company_user = get_company_user(self.request.user)
        if not company_user:
            raise PermissionDenied("Company not found")

        permissions = get_permission_dict(company_user.role)
        if not permissions.get("can_assign_task"):
            raise PermissionDenied("You don't have permission to delete tasks")

        instance.delete()
