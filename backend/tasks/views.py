from django.db.models import Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated

from companies.utils import get_company_user, get_permission_dict

from .models import Task, TaskActivity, TaskComment, TaskNotification
from .serializers import TaskActivitySerializer, TaskCommentSerializer, TaskNotificationSerializer, TaskSerializer
from .services import notify_task_members, sync_project_progress
from workflows.services import evaluate_task_update_workflows


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

        task = serializer.save(created_by=company_user, company=company_user.company)
        TaskActivity.objects.create(
            task=task,
            actor=company_user,
            event_type="created",
            summary="created this task",
        )
        notify_task_members(task, company_user, "assigned", f"You were assigned to {task.title}")
        sync_project_progress(task.project)

    def perform_update(self, serializer):
        task = serializer.instance
        previous_project = task.project
        changed_fields = [
            field for field, value in serializer.validated_data.items()
            if getattr(task, field) != value
        ]
        updated_task = serializer.save()
        if changed_fields:
            actor = get_company_user(self.request.user)
            TaskActivity.objects.create(
                task=updated_task,
                actor=actor,
                event_type="updated",
                summary=f"updated {', '.join(changed_fields).replace('_', ' ')}",
            )
            notify_task_members(
                updated_task,
                actor,
                "updated",
                f"{updated_task.title} was updated: {', '.join(changed_fields).replace('_', ' ')}",
            )
            evaluate_task_update_workflows(updated_task, actor, changed_fields)
        sync_project_progress(previous_project)
        if updated_task.project_id != getattr(previous_project, "id", None):
            sync_project_progress(updated_task.project)

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

        project = instance.project
        instance.delete()
        sync_project_progress(project)

    @action(detail=True, methods=["get", "post"], url_path="comments")
    def comments(self, request, pk=None):
        task = self.get_object()
        if request.method == "GET":
            comments = task.comments.select_related("author__user").all()
            return Response(TaskCommentSerializer(comments, many=True).data)

        company_user = get_company_user(request.user)
        if not company_user:
            raise PermissionDenied("Company not found")
        serializer = TaskCommentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        comment = serializer.save(task=task, author=company_user)
        TaskActivity.objects.create(
            task=task,
            actor=company_user,
            event_type="commented",
            summary="added a comment",
        )
        notify_task_members(task, company_user, "commented", f"New comment on {task.title}")
        return Response(TaskCommentSerializer(comment).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"], url_path="activity")
    def activity(self, request, pk=None):
        task = self.get_object()
        activities = task.activities.select_related("actor__user").all()
        return Response(TaskActivitySerializer(activities, many=True).data)

    @action(detail=False, methods=["get"], url_path="notifications")
    def notifications(self, request):
        company_user = get_company_user(request.user)
        if not company_user:
            raise PermissionDenied("Company not found")
        notification_queryset = TaskNotification.objects.filter(recipient=company_user).select_related("task")
        return Response(
            {
                "unread_count": notification_queryset.filter(is_read=False).count(),
                "results": TaskNotificationSerializer(notification_queryset[:50], many=True).data,
            }
        )

    @action(detail=False, methods=["post"], url_path="notifications/read")
    def mark_notifications_read(self, request):
        company_user = get_company_user(request.user)
        if not company_user:
            raise PermissionDenied("Company not found")
        notification_ids = request.data.get("ids", [])
        queryset = TaskNotification.objects.filter(recipient=company_user, is_read=False)
        if notification_ids:
            queryset = queryset.filter(id__in=notification_ids)
        updated_count = queryset.update(is_read=True)
        return Response({"updated_count": updated_count})
