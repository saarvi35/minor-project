from rest_framework import viewsets
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.decorators import action

from companies.utils import get_company_user, get_permission_dict

from .models import WorkflowRule, WorkflowRun
from .serializers import WorkflowRuleSerializer, WorkflowRunSerializer


class WorkflowRuleViewSet(viewsets.ModelViewSet):
    serializer_class = WorkflowRuleSerializer
    permission_classes = [IsAuthenticated]

    def get_company_user(self):
        company_user = get_company_user(self.request.user)
        if not company_user:
            raise PermissionDenied("Company user not found")
        permissions = get_permission_dict(company_user.role)
        if not (permissions.get("can_manage_company") or permissions.get("can_assign_task")):
            raise PermissionDenied("You don't have permission to manage workflows")
        return company_user

    def get_queryset(self):
        company_user = self.get_company_user()
        return WorkflowRule.objects.filter(company=company_user.company)

    def perform_create(self, serializer):
        company_user = self.get_company_user()
        serializer.save(company=company_user.company, created_by=company_user)

    @action(detail=False, methods=["get"], url_path="runs")
    def runs(self, request):
        company_user = self.get_company_user()
        runs = WorkflowRun.objects.filter(rule__company=company_user.company).select_related("rule", "task")[:100]
        return Response(WorkflowRunSerializer(runs, many=True).data)
