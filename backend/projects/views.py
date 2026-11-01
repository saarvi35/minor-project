from django.db.models import Q
from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from .models import Project
from .serializers import ProjectSerializer
from companies.models import CompanyUser
from companies.utils import get_company_user, get_permission_dict

class ProjectViewSet(viewsets.ModelViewSet):

    serializer_class = ProjectSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        company_user = get_company_user(self.request.user)
        if not company_user:
            return Project.objects.none()

        permissions_map = get_permission_dict(company_user.role)
        base_queryset = Project.objects.filter(company=company_user.company, is_active=True).select_related(
            "company", "manager__user", "manager__role", "client__user", "client__role"
        )

        if permissions_map.get("can_manage_company") or permissions_map.get("can_view_all_tasks"):
            return base_queryset
        if permissions_map.get("can_view_team_tasks"):
            return base_queryset.filter(Q(manager=company_user) | Q(tasks__assigned_to=company_user)).distinct()
        if permissions_map.get("can_view_assigned_tasks"):
            return base_queryset.filter(tasks__assigned_to=company_user).distinct()
        if permissions_map.get("can_view_project_progress"):
            return base_queryset.filter(client=company_user)
        return Project.objects.none()

    def _require_project_management(self):
        company_user = get_company_user(self.request.user)
        if not company_user:
            raise PermissionDenied("User not linked to any company")
        permissions_map = get_permission_dict(company_user.role)
        if not (permissions_map.get("can_manage_company") or permissions_map.get("can_create_project")):
            raise PermissionDenied("You don't have permission to manage projects")
        return company_user

    #  Create Project
    def perform_create(self, serializer):
        company_user = self._require_project_management()
        serializer.save(company=company_user.company)

    def perform_update(self, serializer):
        company_user = self._require_project_management()
        if not get_permission_dict(company_user.role).get("can_manage_company") and serializer.instance.manager_id != company_user.id:
            raise PermissionDenied("You can only update projects you manage.")
        serializer.save()

    def perform_destroy(self, instance):
        company_user = self._require_project_management()
        if not get_permission_dict(company_user.role).get("can_manage_company") and instance.manager_id != company_user.id:
            raise PermissionDenied("You can only delete projects you manage.")
        instance.is_active = False
        instance.save(update_fields=["is_active"])

    #  Assign Client to Project
    @action(detail=True, methods=["patch"])
    def assign_client(self, request, pk=None):
        company_user = self._require_project_management()
        project = self.get_object()
        if not get_permission_dict(company_user.role).get("can_manage_company") and project.manager_id != company_user.id:
            raise PermissionDenied("You can only manage projects you manage.")

        client_id = request.data.get("client")

        if not client_id:
            return Response(
                {"error": "Client ID required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        client = CompanyUser.objects.filter(id=client_id, company=project.company).first()
        if not client:
            return Response({"error": "Client must belong to this company"}, status=status.HTTP_400_BAD_REQUEST)
        if not client.role.can_view_project_progress:
            return Response({"error": "Selected member does not have client project access"}, status=status.HTTP_400_BAD_REQUEST)

        project.client = client
        project.save()

        return Response({"message": "Client assigned successfully"})

    # Soft Delete 
    @action(detail=True, methods=["patch"])
    def deactivate(self, request, pk=None):
        company_user = self._require_project_management()
        project = self.get_object()
        if not get_permission_dict(company_user.role).get("can_manage_company") and project.manager_id != company_user.id:
            raise PermissionDenied("You can only manage projects you manage.")
        project.is_active = False
        project.save()

        return Response({"message": "Project deactivated"})


