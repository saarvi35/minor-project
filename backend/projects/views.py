from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from .models import Project
from .serializers import ProjectSerializer
from companies.utils import get_company_user

class ProjectViewSet(viewsets.ModelViewSet):

    serializer_class = ProjectSerializer
    permission_classes = [permissions.IsAuthenticated]

    # Only show projects of user's company
    def get_queryset(self):
        user = self.request.user

        company_user = user.companyuser_set.first()

        if not company_user:
            return Project.objects.none()

        return Project.objects.filter(company=company_user.company)

    #  Create Project
    def perform_create(self, serializer):
        company_user = get_company_user(self.request.user)
        if not company_user:
            raise PermissionDenied("User not linked to any company")

        serializer.save(
            company=company_user.company,
        )

    #  Assign Client to Project
    @action(detail=True, methods=["patch"])
    def assign_client(self, request, pk=None):
        project = self.get_object()

        client_id = request.data.get("client")

        if not client_id:
            return Response(
                {"error": "Client ID required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        project.client_id = client_id
        project.save()

        return Response({"message": "Client assigned successfully"})

    # Soft Delete 
    @action(detail=True, methods=["patch"])
    def deactivate(self, request, pk=None):
        project = self.get_object()
        project.is_active = False
        project.save()

        return Response({"message": "Project deactivated"})


