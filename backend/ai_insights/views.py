from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from companies.utils import get_company_user

from .serializers import TaskPrioritizationSerializer, WorkloadRecommendationSerializer
from .services import (
    build_ai_analytics_summary,
    build_delay_predictions,
    build_escalations,
    build_task_priorities,
    build_workload_balancing,
)


def get_request_company_user(request):
    company_user = get_company_user(request.user)
    if not company_user:
        return None, Response({"error": "Company user not found"}, status=404)
    return company_user, None


class DelayPredictionAPI(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        company_user, error = get_request_company_user(request)
        if error:
            return error

        return Response(build_delay_predictions(company_user))


class EscalationInsightsAPI(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        company_user, error = get_request_company_user(request)
        if error:
            return error

        return Response(build_escalations(company_user))


class AIAnalyticsSummaryAPI(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        company_user, error = get_request_company_user(request)
        if error:
            return error

        return Response(build_ai_analytics_summary(company_user))


class SmartTaskPrioritizationAPI(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        company_user, error = get_request_company_user(request)
        if error:
            return error

        serializer = TaskPrioritizationSerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)

        return Response(
            build_task_priorities(
                company_user,
                project_id=serializer.validated_data.get("project_id"),
                limit=serializer.validated_data.get("limit", 20),
            )
        )


class WorkloadBalancingAPI(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        company_user, error = get_request_company_user(request)
        if error:
            return error

        serializer = WorkloadRecommendationSerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)

        return Response(
            build_workload_balancing(
                company_user,
                project_id=serializer.validated_data.get("project_id"),
                priority=serializer.validated_data.get("priority", "MEDIUM"),
            )
        )
